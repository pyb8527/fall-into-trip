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
