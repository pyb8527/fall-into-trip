/**
 * 동선 다시 보기의 탈것 — 무엇을 타는지, 얼마나 걸리는지, 어떻게 움직이는지,
 * 카메라를 얼마나 붙일지. 모양(3D 모델)은 lib/vehicle-scene 이 그립니다.
 *
 * <h3>무엇을 타는지</h3>
 *
 * <p>구간마다 고릅니다(곳 i 에서 i+1 까지).
 * <ol>
 *   <li>사람이 적어 둔 이동(place.move.mode, 「다음 장소까지 이동 적기」)이 있으면 그것</li>
 *   <li>없으면 거리로 — 1.2km 까지 걷기, 30km 까지 차, 300km 까지 기차, 그 너머는 비행기</li>
 * </ol>
 * 거리로 고른 것은 어림입니다. 틀려도 되는 자리라(동선을 돌아보는 연출) 경로를
 * 구글에 다시 묻지 않습니다 — 묻는 순간 이 화면이 요금을 냅니다.
 *
 * <h3>모양</h3>
 *
 * <p>처음에는 상자 몇 개를 쌓은 모양을 코드로 지었습니다. 「모형이 너무
 * 이상하다, 자연스럽지 않다」여서 디자이너가 만든 glTF 로 바꿨습니다
 * (lib/vehicle-scene · public/models/LICENSES.txt).
 */

export type Vehicle = 'walk' | 'car' | 'bus' | 'train' | 'boat' | 'plane';

/** 적어 둔 수단(Leg 의 일곱) → 탈것. 택시와 차는 같은 모양입니다. */
const FROM_MODE: Record<string, Vehicle> = {
  transit: 'train',
  bus: 'bus',
  walk: 'walk',
  taxi: 'car',
  car: 'car',
  flight: 'plane',
  ferry: 'boat',
};

export function vehicleFor(mode: string | null | undefined, km: number): Vehicle {
  if (mode && FROM_MODE[mode]) {
    return FROM_MODE[mode];
  }
  if (km <= 1.2) {
    return 'walk';
  }
  if (km <= 30) {
    return 'car';
  }
  if (km <= 300) {
    return 'train';
  }
  return 'plane';
}

/** 화면에서 탈것이 차지할 크기(픽셀, 긴 쪽). 배율이 바뀌어도 이 크기로 보이게 맞춥니다. */
export const VEHICLE_PX: Record<Vehicle, number> = {
  /*
    처음 값(26 · 34 …)은 사람과 차가 점처럼 보였고, 키운 값(44~76)은 모델의
    각진 면과 텍스처 픽셀이 보여 어색했습니다. 그 사이로 줄입니다. 기차는 세
    칸을 이어 길어졌으므로(긴 쪽 기준) 더 크게 둡니다.
  */
  walk: 38,
  car: 44,
  bus: 50,
  train: 104,
  boat: 56,
  plane: 62,
};

/* ------------------------------------------------------------------ 박자 */

/**
 * 한 구간을 가는 데 걸리는 시간(밀리초).
 *
 * <h3>왜 탈것마다 다른가</h3>
 *
 * <p>모든 구간이 1.25초였습니다. 400m 걷는 길과 400km 나는 길이 똑같이 걸려서,
 * 탈것을 바꿔 그려도 같은 점이 모양만 바꿔 미끄러지는 것으로 보였습니다.
 *
 * <h3>화면 위의 빠르기로 셉니다</h3>
 *
 * <p>처음에는 1.3~2.4초로 두었더니 「걸어가는 건지 순간이동인지 모르겠다, 기차도
 * 너무 빠르다」였습니다. 걷기는 카메라를 바짝 붙여 두므로(아래 cameraFor)
 * 400m 가 화면 위로 수백 픽셀입니다 — 그것을 1.5초에 지나가면 걷는 것이
 * 아니라 미끄러지는 것입니다. 그래서 걷기는 거리에 거의 비례해 늘리고(1km 에
 * 3초 더), 다른 탈것은 거리가 두 배가 될 때마다 조금씩 늘립니다.
 *
 * <p>실제 비율대로 하지는 않습니다 — 그러면 비행기 한 구간이 몇 분입니다. 위로
 * 막아 여러 날을 이어 볼 때 한 구간이 길게 끌지 않게 합니다.
 */
export function legMs(vehicle: Vehicle, km: number): number {
  const d = Math.max(0, km);
  let ms: number;
  switch (vehicle) {
    case 'walk':
      ms = 2600 + d * 3000;
      return clampMs(ms, 2400, 7000);
    case 'car':
    case 'bus':
      ms = 2600 + Math.log2(d / 2 + 1) * 700;
      return clampMs(ms, 2400, 6000);
    case 'train':
      ms = 3400 + Math.log2(d / 20 + 1) * 700;
      return clampMs(ms, 3000, 6000);
    case 'boat':
      ms = 4000 + Math.log2(d / 10 + 1) * 600;
      return clampMs(ms, 3500, 6500);
    case 'plane':
    default:
      ms = 3600 + Math.log2(d / 300 + 1) * 600;
      return clampMs(ms, 3200, 6000);
  }
}

function clampMs(ms: number, lo: number, hi: number) {
  return Math.round(Math.max(lo, Math.min(hi, ms)));
}

/**
 * 탈것마다 카메라를 얼마나 붙일지.
 *
 * <p>{@code zoom} 은 그 구간을 가는 동안의 배율, {@code lift} 는 구간 한가운데에서
 * 얼마나 물러날지(배율 단위)입니다.
 *
 * <h3>걷기는 물러나지 않습니다</h3>
 *
 * <p>구간 길이에 맞춰 배율을 정하고 가운데에서 물러나게 했더니, 1km 걷는 길에서도
 * 배율이 16 아래로 내려가 3D 건물이 사라졌습니다 — 「굳이 축소해서 3D 가
 * 없어지는 것보다 확대해 놓고 걸어가는 게 낫다」. 걷기는 건물이 서는 배율에
 * 붙여 두고 탈것을 따라 미끄러지기만 합니다. 다음 곳이 화면 밖이어도 됩니다 —
 * 걸어가는 길을 보는 것이 이 자리의 일입니다.
 *
 * <p>차와 버스도 가까이 두고 조금만 물러납니다. 기차 · 배 · 비행기는 두 곳이
 * 한 화면에 들어오도록 물러납니다 — 거기서는 건물보다 어디서 어디로 가는지가
 * 먼저입니다.
 */
export function cameraFor(vehicle: Vehicle, km: number): { zoom: number; lift: number } {
  /* 구간 전체가 한 화면에 들어오는 배율. */
  const fit = Math.max(5, Math.min(17.8, 17.8 - Math.log2(Math.max(0.25, km) / 0.25)));
  switch (vehicle) {
    case 'walk':
      return { zoom: 17.6, lift: 0 };
    case 'car':
    case 'bus':
      return { zoom: Math.max(15.4, Math.min(17.2, fit + 1.6)), lift: km > 5 ? 0.7 : 0.2 };
    case 'train':
      return { zoom: Math.max(11, Math.min(15.6, fit + 1.4)), lift: 1.0 };
    case 'boat':
      return { zoom: Math.max(11, Math.min(15.4, fit + 1.2)), lift: 0.9 };
    case 'plane':
    default:
      return { zoom: fit, lift: 2.4 };
  }
}

/**
 * 구간 안에서 얼마나 왔는지(0~1, 고르게) → 실제로 간 몫.
 *
 * <ul>
 *   <li>사람 — 거의 고르게. 걷는 사람은 출발할 때 밀어내지 않습니다</li>
 *   <li>차 · 버스 — 살짝 출발하고 살짝 섭니다</li>
 *   <li>기차 — 천천히 붙어 오래 같은 속도로 달리고 천천히 섭니다</li>
 *   <li>배 — 기차보다 더 느긋하게 붙고 섭니다</li>
 *   <li>비행기 — 활주하듯 밀어내고 내려앉듯 늦춥니다(가운데가 가장 빠름)</li>
 * </ul>
 */
export function easeFor(vehicle: Vehicle, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  switch (vehicle) {
    case 'walk':
      return x * 0.9 + smoothstep(x) * 0.1;
    case 'car':
    case 'bus':
      return smoothstep(x);
    case 'train':
      return rampCruise(x, 0.22);
    case 'boat':
      return rampCruise(x, 0.32);
    case 'plane':
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}

function smoothstep(x: number) {
  return x * x * (3 - 2 * x);
}

/**
 * 붙고(ramp) · 달리고(cruise) · 서는 곡선. 앞뒤 ramp 몫 동안 속도가 0 에서
 * 순항까지 고르게 오르내리고, 가운데는 같은 속도입니다. 넓이가 1 이 되게
 * 순항 속도를 맞춥니다.
 */
function rampCruise(x: number, ramp: number) {
  const v = 1 / (1 - ramp); // 순항 속도
  if (x < ramp) {
    return (v * x * x) / (2 * ramp);
  }
  if (x > 1 - ramp) {
    const r = 1 - x;
    return 1 - (v * r * r) / (2 * ramp);
  }
  return (v * ramp) / 2 + v * (x - ramp);
}
