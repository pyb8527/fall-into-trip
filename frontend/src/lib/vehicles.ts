/**
 * 동선 다시 보기의 탈것 — 무엇을 타는지 고르고, 그 모양을 상자 몇 개로 짓습니다.
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
 * <h3>모양은 파일이 아니라 코드로</h3>
 *
 * <p>glTF 모델을 받아 오면 탈것 여섯에 파일 여섯이고, 앱 색과 맞추려면 다시
 * 손봐야 합니다. 상자 몇 개를 쌓은 낮은 다각형 모양이면 코드 몇 줄이고,
 * 날짜 색을 그대로 입힐 수 있고, 지도 위에서 손톱만 하게 보이는 크기에서는
 * 오히려 또렷합니다.
 *
 * <p>좌표는 미터, x 는 동쪽, y 는 북쪽(앞), z 는 위입니다. 모든 탈것은 <b>앞이
 * +y</b> 를 보게 짓습니다 — 돌릴 때는 북쪽에서 시계 방향 각(heading)의 음수를
 * yaw 로 줍니다(deck.gl 은 반시계로 돌립니다).
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
  /* 처음 값(26 · 34 …)은 걷는 사람과 차가 지도 위에서 점처럼 보였습니다. */
  walk: 44,
  car: 52,
  bus: 58,
  train: 76,
  boat: 64,
  plane: 72,
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

/* ------------------------------------------------------------------ 모양 */

type Rgb = [number, number, number];

export type MeshData = {
  positions: { value: Float32Array; size: 3 };
  normals: { value: Float32Array; size: 3 };
  colors: { value: Float32Array; size: 3 };
  /** 긴 쪽 길이(미터). 화면 크기를 맞출 때 나눕니다. */
  length: number;
};

class Builder {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];

  /** 가운데(cx,cy,cz), 크기(sx,sy,sz)인 상자. 면마다 법선을 따로 둡니다(각진 그늘). */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: Rgb) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color); // 위
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [0, 0, -1], color); // 아래
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], color); // 앞
    this.quad([x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y0, z0], [0, -1, 0], color); // 뒤
    this.quad([x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [1, 0, 0], color); // 오른쪽
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], color); // 왼쪽
  }

  /**
   * 앞으로 갈수록 좁아지는 쐐기 — 기수 · 뱃머리. 뒤(y0)는 sx 폭, 앞(y1)은 끝.
   */
  wedge(cx: number, y0: number, y1: number, cz: number, sx: number, sz: number, color: Rgb) {
    const xl = cx - sx / 2, xr = cx + sx / 2;
    const zb = cz - sz / 2, zt = cz + sz / 2;
    const tip: number[] = [cx, y1, cz];
    this.tri([xl, y0, zt], [xr, y0, zt], tip, color);
    this.tri([xr, y0, zb], [xl, y0, zb], tip, color);
    this.tri([xr, y0, zt], [xr, y0, zb], tip, color);
    this.tri([xl, y0, zb], [xl, y0, zt], tip, color);
  }

  private quad(a: number[], b: number[], c: number[], d: number[], normal: number[], color: Rgb) {
    this.push(a, normal, color);
    this.push(b, normal, color);
    this.push(c, normal, color);
    this.push(a, normal, color);
    this.push(c, normal, color);
    this.push(d, normal, color);
  }

  private tri(a: number[], b: number[], c: number[], color: Rgb) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = u[1] * v[2] - u[2] * v[1];
    const ny = u[2] * v[0] - u[0] * v[2];
    const nz = u[0] * v[1] - u[1] * v[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    const normal = [nx / len, ny / len, nz / len];
    this.push(a, normal, color);
    this.push(b, normal, color);
    this.push(c, normal, color);
  }

  private push(at: number[], normal: number[], color: Rgb) {
    this.p.push(at[0], at[1], at[2]);
    this.n.push(normal[0], normal[1], normal[2]);
    this.c.push(color[0], color[1], color[2]);
  }

  done(length: number): MeshData {
    return {
      positions: { value: new Float32Array(this.p), size: 3 },
      normals: { value: new Float32Array(this.n), size: 3 },
      colors: { value: new Float32Array(this.c), size: 3 },
      length,
    };
  }
}

const WHITE: Rgb = [1, 1, 1];
const GLASS: Rgb = [0.16, 0.2, 0.28];
const DARK: Rgb = [0.12, 0.12, 0.14];

function shade(color: Rgb, k: number): Rgb {
  return [color[0] * k, color[1] * k, color[2] * k];
}

/** "#6D5BF6" → 0~1 세 값. 못 읽으면 앱 보라색. */
export function rgbOf(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? parseInt(m[1], 16) : 0x6d5bf6;
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

const cache = new Map<string, MeshData>();

/** 탈것 모양. 날짜 색을 입혀 짓고, 같은 색은 다시 짓지 않습니다. */
export function meshOf(vehicle: Vehicle, hex: string): MeshData {
  const key = `${vehicle}|${hex}`;
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const color = rgbOf(hex);
  const b = new Builder();
  let length = 1;

  switch (vehicle) {
    case 'walk': {
      /* 사람 — 다리 둘, 몸, 머리. 날짜 색 옷. */
      b.box(-0.13, 0, 0.4, 0.18, 0.22, 0.8, DARK);
      b.box(0.13, 0, 0.4, 0.18, 0.22, 0.8, DARK);
      b.box(0, 0, 1.15, 0.56, 0.34, 0.75, color);
      b.box(0, 0.02, 1.75, 0.36, 0.36, 0.4, [0.98, 0.84, 0.72]);
      b.box(0, -0.2, 1.2, 0.4, 0.18, 0.5, shade(color, 0.7)); // 가방
      length = 1.9;
      break;
    }
    case 'car': {
      b.box(0, 0, 0.55, 1.8, 4.2, 0.7, color);
      b.box(0, -0.25, 1.15, 1.5, 2.1, 0.55, WHITE);
      b.box(0, 0.83, 1.15, 1.4, 0.05, 0.4, GLASS); // 앞유리
      for (const [x, y] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) {
        b.box(x, y, 0.32, 0.3, 0.64, 0.64, DARK);
      }
      length = 4.2;
      break;
    }
    case 'bus': {
      b.box(0, 0, 1.6, 2.5, 10, 2.6, color);
      b.box(0, 0, 2.05, 2.56, 9, 0.75, GLASS); // 창 띠
      b.box(0, 0, 3.0, 2.3, 9.6, 0.15, WHITE); // 지붕
      for (const [x, y] of [[-1.2, 3.2], [1.2, 3.2], [-1.2, -3.2], [1.2, -3.2]]) {
        b.box(x, y, 0.45, 0.35, 0.9, 0.9, DARK);
      }
      length = 10;
      break;
    }
    case 'train': {
      /* 세 칸. 앞 칸은 기수가 둥글게(쐐기) 빠집니다. */
      for (const y of [-11, 0]) {
        b.box(0, y, 1.8, 2.8, 10.4, 3.0, WHITE);
        b.box(0, y, 2.3, 2.86, 9.4, 0.7, GLASS);
        b.box(0, y, 1.0, 2.86, 10.4, 0.35, color);
      }
      b.box(0, 11, 1.8, 2.8, 8, 3.0, WHITE);
      b.box(0, 11, 1.0, 2.86, 8, 0.35, color);
      b.box(0, 10.6, 2.3, 2.86, 6.6, 0.7, GLASS);
      b.wedge(0, 15, 19, 1.8, 2.8, 3.0, color);
      length = 35;
      break;
    }
    case 'boat': {
      b.box(0, -1, 0.7, 4.2, 10, 1.4, WHITE);
      b.wedge(0, 4, 8, 0.7, 4.2, 1.4, WHITE);
      b.box(0, -1, 0.15, 4.25, 13.5, 0.3, color); // 흘수선
      b.box(0, -2, 2.0, 3.0, 5, 1.4, color);
      b.box(0, -0.8, 2.2, 3.06, 2.4, 0.6, GLASS);
      b.box(0, -3, 3.3, 0.6, 0.6, 1.4, DARK); // 굴뚝
      length = 14;
      break;
    }
    case 'plane': {
      b.box(0, 0, 0, 2.4, 22, 2.6, WHITE); // 동체
      b.wedge(0, 11, 15, 0, 2.4, 2.6, WHITE); // 기수
      b.box(0, 11.5, 0.6, 1.6, 1.4, 0.6, GLASS); // 조종석 창
      b.box(0, 1, -0.2, 26, 4.2, 0.4, color); // 주날개
      b.box(-6, 1.6, -1.1, 1.3, 2.6, 1.3, shade(color, 0.75)); // 엔진
      b.box(6, 1.6, -1.1, 1.3, 2.6, 1.3, shade(color, 0.75));
      b.box(0, -10, 0.3, 9, 2.4, 0.3, color); // 꼬리 수평
      b.box(0, -10, 2.8, 0.4, 3.2, 4.6, color); // 꼬리 수직
      length = 26;
      break;
    }
  }

  const mesh = b.done(length);
  cache.set(key, mesh);
  return mesh;
}
