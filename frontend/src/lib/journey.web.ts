import { gmaps } from '@/lib/gmaps.web';
import { tiltFor } from '@/lib/tilt-map.web';
import type { VehicleScene } from '@/lib/vehicle-scene.web';
import { cameraFor, easeFor, legMs, type Vehicle, VEHICLE_PX, vehicleFor } from '@/lib/vehicles';

/**
 * 기울인 지도 위를 오가는 것 — 카메라와 3D 탈것.
 *
 * <h3>왜 따로 두는가</h3>
 *
 * <p>동선 다시 보기(components/replay-stage) 안에 있던 것을 떼어 냈습니다. 여행
 * 상세에 「3D」 보기를 두고 <b>장소를 누르면 그리로 가는</b> 것을 붙일 자리입니다
 * — 같은 카메라, 같은 탈것, 같은 빠르기라야 두 화면이 같은 앱으로 보입니다.
 *
 * <h3>두 가지로 부립니다</h3>
 *
 * <ul>
 *   <li>{@link Journey.aim} — 바깥이 박자를 쥘 때. 동선 다시 보기는 「멈추기 ·
 *       이어서」와 날짜 고르기가 있어서 박자를 화면이 셉니다. 박자마다
 *       {@link aimAlong} 으로 목표를 정해 넘깁니다.</li>
 *   <li>{@link Journey.travel} — 한 곳에서 다른 곳으로 한 번. 여행 상세에서 장소를
 *       눌렀을 때입니다. 탈것 · 시간 · 곡선을 스스로 정해 가고, 닿으면 약속을
 *       풉니다. 가는 도중에 다시 부르면 지금 자리에서 새 곳으로 꺾습니다.</li>
 * </ul>
 *
 * <h3>카메라는 목표를 따라갈 뿐입니다</h3>
 *
 * <p>목표를 정하는 쪽(박자 · travel)과 옮기는 쪽(화면 갱신 고리)을 나눴습니다.
 * 박자마다 카메라를 바로 옮겼더니 떨렸고, 곳에 닿는 순간 배율 · 방향이 한꺼번에
 * 바뀌어 덜컹했습니다. 이제 카메라는 매 화면 목표 쪽으로 조금씩 다가가고,
 * 탈것은 거의 붙어서, 카메라 한가운데는 탈것이 그려진 자리입니다.
 */

export type JourneyPoint = {
  lat: number;
  lng: number;
  /** 다음 곳까지 적어 둔 이동 수단(place.move.mode). 없으면 거리로 고릅니다. */
  mode?: string | null;
  /** 그날의 색. 평평한 비행기 그림(3D 를 못 받았을 때)에 씁니다. */
  color: string;
  /**
   * 다음 곳까지 실제로 가는 길(구글 경로의 선, 풀어 둔 것 — lib/polyline).
   *
   * <p>있으면 탈것이 이 길을 따라가고 길이 꺾이는 대로 방향을 틉니다. 없으면
   * 두 곳을 곧게 잇습니다. 여행 상세에서 「이동 시간」으로 길을 찾아 두었으면
   * 그 구간의 선(GapOption.polyline)을 넘기면 됩니다 — 「일자로 달리지 말고
   * 찾은 길대로」.
   */
  path?: { lat: number; lng: number }[] | null;
};

/** 카메라와 탈것이 가야 할 자리. */
export type Aim = {
  lat: number;
  lng: number;
  /** 카메라가 볼 쪽(다음 구간과 섞인 것, 비껴 보는 각 포함). */
  heading: number;
  zoom: number;
  /** 탈것이 실제로 가는 쪽. */
  legHeading: number;
  /** 0~1. 얼마나 떠 있는지(비행기). */
  lift: number;
  color: string;
  vehicle: Vehicle;
  /** 곳에 머무는 중인지. 걷는 사람은 이때 멈춰 섭니다. */
  still: boolean;
};

/** 카메라가 가는 쪽에서 비껴 보는 각. 탈것을 4분의 3 쪽에서 보게 됩니다. */
const SIDE_VIEW = 28;

/** 다 보고 물러났을 때의 기울기. */
const TILT_FAR = 35;

/**
 * 구간(now → next) 위 어디쯤을 겨눌지.
 *
 * @param raw  구간 안에서 온 몫(0~1, 고르게). 탈것의 곡선은 여기서 입힙니다
 * @param after next 다음 곳. 있으면 구간 마지막 3할 동안 방향 · 배율을 그 구간
 *              것으로 섞어, 닿을 즈음엔 이미 다음 쪽을 봅니다
 */
export function aimAlong(
  now: JourneyPoint,
  next: JourneyPoint | null,
  after: JourneyPoint | null,
  raw: number,
  prevHeading = 0,
): Aim {
  const x = Math.min(1, Math.max(0, raw));
  const km = next ? distanceKm(now, next) : 0;
  const vehicle: Vehicle = next ? vehicleFor(now.mode, km) : 'walk';
  const t = easeFor(vehicle, x);
  const road = next ? routeOf(now, next) : null;
  const pos = road
    ? pointAlong(road, t)
    : next
      ? { lat: now.lat + (next.lat - now.lat) * t, lng: now.lng + (next.lng - now.lng) * t }
      : { lat: now.lat, lng: now.lng };

  /* 길을 따라갈 때는 지금 자리의 길 방향을 봅니다 — 조금 앞을 내다봐서, 짧게
     꺾인 마디마다 탈것이 파르르 돌지 않게. */
  const legHeading = road
    ? bearing(pointAlong(road, Math.max(0, t - 0.01)), pointAlong(road, Math.min(1, t + 0.03)))
    : next
      ? bearing(now, next)
      : prevHeading;
  const mix = next && after ? smooth((x - 0.7) / 0.3) : 0;
  const nextKm = next && after ? distanceKm(next, after) : km;
  const nextHeading = next && after ? bearing(next, after) : legHeading;
  /* 카메라 배율은 탈것이 정합니다. 걷기는 건물이 서는 배율에 붙어 물러나지
     않고, 기차 · 비행기는 가운데에서 물러납니다. */
  const here = cameraFor(vehicle, km);
  const nextVehicle: Vehicle = next && after ? vehicleFor(next.mode, nextKm) : vehicle;
  const there = cameraFor(nextVehicle, nextKm);
  const arc = Math.sin(x * Math.PI);

  return {
    lat: pos.lat,
    lng: pos.lng,
    /* 바로 뒤가 아니라 비스듬히 뒤에서 — 바로 뒤에서 보면 기차가 막대 하나로 줄어듭니다. */
    heading: (blendAngle(legHeading, nextHeading, mix) + SIDE_VIEW) % 360,
    zoom: here.zoom * (1 - mix) + there.zoom * mix - arc * here.lift,
    legHeading,
    lift: vehicle === 'plane' ? arc : 0,
    color: (next ?? now).color,
    vehicle,
    still: x <= 0 || !next,
  };
}

export type Journey = {
  /**
   * 3D 탈것을 받았거나(또는 못 받기로 끝났거나) 하면 풀립니다. 처음 출발을 이것
   * 뒤로 미루면 첫 구간부터 제 탈것이 섭니다 — 안 미루면 three 와 모델을 받는
   * 몇 초 동안 첫 구간이 탈것 없이(또는 엉뚱한 그림으로) 지나갑니다.
   */
  ready: Promise<void>;
  /** 목표를 직접 정합니다(박자를 바깥이 쥘 때). null 이면 탈것을 걷습니다. */
  aim(aim: Aim | null): void;
  /**
   * from 에서 to 까지 한 번 갑니다. 닿으면 true, 다른 travel · aim · overview 로
   * 끊기면 false 로 풉니다.
   */
  travel(from: JourneyPoint, to: JourneyPoint, opts?: { after?: JourneyPoint | null }): Promise<boolean>;
  /* from.path 가 있으면 그 길로 갑니다(JourneyPoint.path). */
  /** 그 곳에 내려 섭니다(움직이지 않고). */
  park(at: JourneyPoint, heading?: number): void;
  /** 탈것을 걷고 곳들이 다 들어오게 물러나 비스듬히 봅니다. */
  overview(points: { lat: number; lng: number }[]): void;
  dispose(): void;
};

/** 기울인 지도(lib/tilt-map)에 카메라와 탈것을 붙입니다. */
export function createJourney(map: any): Journey {
  const g = gmaps();
  let goal: Aim | null = null;
  let cam: { lat: number; lng: number; heading: number; zoom: number; lift: number } | null = null;
  let scene: VehicleScene | null = null;
  let flier: any = null;
  let flierKey = '';
  let alive = true;
  /* 지금 가고 있는 travel. 새로 부르면 앞의 것을 끊습니다. */
  let trip: { cancel: () => void } | null = null;

  /*
    3D 탈것은 따로 받습니다 — 파일 통째로 import() 한 번(lib/vehicle-scene 문서).

    <p>받는 동안에는 아무것도 안 그립니다. 처음에는 그동안 평평한 비행기 그림을
    세웠는데, 첫 구간이 기차인데도 비행기가 날아갔습니다. 평평한 그림은 3D 를
    <b>못 받았을 때만</b> 씁니다.
  */
  let flat = false;
  const ready = import('@/lib/vehicle-scene.web')
    .then(({ createVehicleScene }) => createVehicleScene(map))
    .then((made) => {
      if (!alive) {
        made.dispose();
        return;
      }
      scene = made;
      return made.ready;
    })
    .catch(() => {
      flat = true;
    });

  let raf = 0;
  let last = performance.now();
  const frame = (nowMs: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (nowMs - last) / 1000);
    last = nowMs;
    const want = goal;
    if (!want) {
      return;
    }
    const c = cam ?? { lat: want.lat, lng: want.lng, heading: want.heading, zoom: want.zoom, lift: want.lift };
    const fast = 1 - Math.exp(-dt * 18);
    const slow = 1 - Math.exp(-dt * 3.2);
    c.lat += (want.lat - c.lat) * fast;
    c.lng += (want.lng - c.lng) * fast;
    c.zoom += (want.zoom - c.zoom) * slow;
    c.heading = turnToward(c.heading, want.heading, slow);
    c.lift += (want.lift - c.lift) * slow;
    cam = c;

    map.moveCamera({
      center: { lat: c.lat, lng: c.lng },
      zoom: c.zoom,
      heading: c.heading,
      tilt: tiltFor(c.zoom),
    });

    if (scene) {
      /* 크기는 화면 픽셀로 — 그 자리의 1픽셀이 몇 m 인지로 나눕니다. */
      const mpp = (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / Math.pow(2, c.zoom);
      scene.draw({
        vehicle: want.vehicle,
        lat: c.lat,
        lng: c.lng,
        altitude: want.vehicle === 'plane' ? mpp * (6 + c.lift * 90) : 0,
        heading: want.legHeading,
        meters: mpp * VEHICLE_PX[want.vehicle],
        still: want.still,
        dt,
      });
      return;
    }

    if (!flat) {
      return;
    }
    /* 3D 를 못 받았을 때 — 가는 쪽을 보는 평평한 비행기. 카메라가 돈 만큼 뺍니다. */
    const rotation = (want.legHeading - c.heading + 360) % 360;
    const key = `${Math.round(rotation)}|${Math.round(c.lift * 20)}|${want.color}`;
    if (!flier) {
      flier = new g.Marker({
        map,
        position: { lat: c.lat, lng: c.lng },
        icon: flierIcon(g, rotation, c.lift, want.color),
        zIndex: 999,
        clickable: false,
      });
      flierKey = key;
    } else {
      flier.setPosition({ lat: c.lat, lng: c.lng });
      if (flierKey !== key) {
        flier.setIcon(flierIcon(g, rotation, c.lift, want.color));
        flierKey = key;
      }
    }
  };
  raf = requestAnimationFrame(frame);

  function hideVehicle() {
    scene?.hide();
    flier?.setMap(null);
    flier = null;
  }

  function cancelTrip() {
    trip?.cancel();
    trip = null;
  }

  return {
    ready: ready.then(() => undefined),

    aim(next) {
      cancelTrip();
      goal = next;
      if (!next) {
        hideVehicle();
      }
    },

    travel(from, to, opts) {
      cancelTrip();
      /*
        가는 도중이면 지금 탈것이 있는 자리에서 꺾습니다 — 처음 곳으로 순간이동하지
        않게. 그때는 찾아 둔 길(from.path)이 지금 자리에서 시작하지 않으므로 곧게
        갑니다.
      */
      const moving = Boolean(cam && goal && !goal.still);
      const start: JourneyPoint = moving && cam ? { ...from, lat: cam.lat, lng: cam.lng, path: null } : from;
      const road = routeOf(start, to);
      const km = road ? pathKm(road) : distanceKm(start, to);
      const vehicle = vehicleFor(start.mode, distanceKm(start, to));
      /* 시간은 실제로 가는 길이로 — 굽은 길은 곧은 길보다 깁니다. */
      const ms = legMs(vehicle, km);
      const after = opts?.after ?? null;
      return new Promise<boolean>((resolve) => {
        let stopped = false;
        let tick = 0;
        const began = performance.now();
        const step = () => {
          if (stopped) {
            return;
          }
          const raw = Math.min(1, (performance.now() - began) / ms);
          goal = aimAlong(start, to, after, raw, cam?.heading ?? 0);
          if (raw >= 1) {
            goal = aimAlong(to, null, null, 0, goal.legHeading);
            trip = null;
            resolve(true);
            return;
          }
          tick = requestAnimationFrame(step);
        };
        trip = {
          cancel: () => {
            stopped = true;
            cancelAnimationFrame(tick);
            resolve(false);
          },
        };
        tick = requestAnimationFrame(step);
      });
    },

    park(at, heading) {
      cancelTrip();
      goal = aimAlong(at, null, null, 0, heading ?? cam?.heading ?? 0);
    },

    overview(points) {
      cancelTrip();
      goal = null;
      hideVehicle();
      if (points.length === 0) {
        return;
      }
      const bounds = new g.LatLngBounds();
      points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds, 48);
      g.event.addListenerOnce(map, 'idle', () => {
        map.moveCamera({ tilt: TILT_FAR + 10, heading: 0 });
        cam = null;
      });
    },

    dispose() {
      alive = false;
      cancelTrip();
      cancelAnimationFrame(raf);
      hideVehicle();
      scene?.dispose();
      scene = null;
    },
  };
}

/* ------------------------------------------------------------------ 셈 */

/**
 * 이 구간에 따라갈 길. 끝이 두 곳에서 너무 멀면(200m 넘게) 다른 구간의 선을
 * 잘못 넘긴 것으로 보고 안 씁니다 — 엉뚱한 길로 날아가는 것보다 곧게 가는 편이
 * 낫습니다. 끝을 두 곳에 맞춰 이어 붙여, 길 끝에서 곳까지 툭 건너뛰지 않게.
 */
function routeOf(from: JourneyPoint, to: { lat: number; lng: number }) {
  const path = from.path;
  if (!path || path.length < 2) {
    return null;
  }
  const head = path[0];
  const tail = path[path.length - 1];
  if (distanceKm(head, from) > 0.2 || distanceKm(tail, to) > 0.2) {
    return null;
  }
  return [{ lat: from.lat, lng: from.lng }, ...path, { lat: to.lat, lng: to.lng }];
}

/** 길의 길이(km). */
function pathKm(path: { lat: number; lng: number }[]) {
  let sum = 0;
  for (let i = 1; i < path.length; i++) {
    sum += distanceKm(path[i - 1], path[i]);
  }
  return sum;
}

/** 길 위에서 처음부터 t(0~1) 만큼 간 자리. 길이로 나눕니다(마디 수가 아니라). */
function pointAlong(path: { lat: number; lng: number }[], t: number) {
  const total = pathKm(path);
  if (total <= 0) {
    return { lat: path[0].lat, lng: path[0].lng };
  }
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = distanceKm(path[i - 1], path[i]);
    if (want <= seg || i === path.length - 1) {
      const k = seg > 0 ? Math.min(1, want / seg) : 0;
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * k,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * k,
      };
    }
    want -= seg;
  }
  const end = path[path.length - 1];
  return { lat: end.lat, lng: end.lng };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** 북쪽에서 시계 방향 각도. */
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const mid = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dx = (b.lng - a.lng) * Math.cos(mid);
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    return 0;
  }
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** 짧은 쪽으로 돌립니다. 350° 에서 10° 로 갈 때 340° 를 거꾸로 돌지 않습니다. */
function turnToward(from: number, to: number, rate: number) {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * rate + 360) % 360;
}

/** 0~1 을 부드럽게. 0 아래는 0, 1 위는 1. */
function smooth(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** 두 방향 사이를 짧은 쪽으로 섞습니다. */
function blendAngle(a: number, b: number, k: number) {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * k + 360) % 360;
}

/** trip-map.web 의 비행기와 같은 모양. 여기서는 돌리는 각이 카메라 기준입니다. */
function flierIcon(g: any, rotation: number, lift: number, color: string) {
  return {
    path: 'M 0,-10 L 3,-2 L 11,3 L 11,5 L 3,3 L 2,8 L 6,11 L 6,12 L 0,10 L -6,12 L -6,11 L -2,8 L -3,3 L -11,5 L -11,3 L -3,-2 Z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 1.6,
    rotation,
    scale: 1.1 + lift * 0.5,
    anchor: new g.Point(0, 0),
  };
}
