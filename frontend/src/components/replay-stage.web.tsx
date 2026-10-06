import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { gmaps, loadMaps } from '@/lib/gmaps.web';

/**
 * 동선 다시 보기 — 기울인 지도 위에서.
 *
 * <h3>왜 따로 두는가</h3>
 *
 * <p>평평한 지도 위로 비행기 그림 하나가 미끄러지는 것으로는 「다녀온 길」이
 * 아니라 <b>점이 움직이는 것</b>으로 보였습니다. 구글 지도를 벡터로 그리면
 * 비스듬히 눕히고 돌릴 수 있고, 큰 도시는 건물이 블록으로 솟습니다. 카메라가
 * 가는 쪽을 보며 따라가면 짧은 여행 영상처럼 읽힙니다.
 *
 * <p>사진처럼 보이는 3D 지도(Map Tiles · 3D Maps)는 쓰지 않습니다 — 따로
 * 과금되고 폰 웹뷰에서 무겁습니다. 벡터 지도는 지금 쓰는 지도와 같은
 * 셈입니다. Mapbox 도 안 씁니다 — 장소 데이터가 구글 것이라 구글이 아닌 지도
 * 위에 올리면 약관에 걸립니다.
 *
 * <h3>지도 ID 가 있어야 합니다</h3>
 *
 * <p>벡터 · 기울기 · 회전은 {@code mapId} 가 있는 지도에서만 됩니다
 * (EXPO_PUBLIC_GMAPS_MAP_ID, 콘솔에서 「JavaScript · 벡터 · 기울기와 회전」으로
 * 만든 것). 없으면 이 부품을 안 세우고 평평한 {@code TripMap} 을 씁니다
 * ({@link hasTiltMaps}).
 *
 * <p>{@code mapId} 를 쓰면 {@code styles} 가 무시됩니다. 일정 화면의 지도는
 * 그대로 {@code styles} 로 꾸미고, 이 화면만 콘솔의 기본 모양을 씁니다.
 *
 * <h3>그리는 것</h3>
 *
 * <ul>
 *   <li>갈 길 전체 — 날짜 색, 옅게</li>
 *   <li>지나온 길 — 날짜 색, 넓고 옅은 빛 위에 가는 선 한 겹. 지나가면서 늘어납니다</li>
 *   <li>들른 곳 — 지난 곳은 채운 점, 남은 곳은 테두리만</li>
 *   <li>지금 가는 것 — 날짜 색 비행기. 카메라가 가는 쪽을 보므로 늘 위를 봅니다</li>
 * </ul>
 */

export const MAP_ID = process.env.EXPO_PUBLIC_GMAPS_MAP_ID ?? null;

/** 기울인 지도를 쓸 수 있는지. 지도 ID 가 있어야 합니다. */
export const hasTiltMaps = () => Boolean(MAP_ID);

export type StagePlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 그날의 색. */
  color: string;
};

/** 다 보고 물러났을 때의 기울기. */
const TILT_FAR = 35;

type Goal = {
  lat: number;
  lng: number;
  /** 카메라가 볼 쪽(다음 구간과 섞인 것). */
  heading: number;
  zoom: number;
  /** 탈것이 실제로 가는 쪽. */
  legHeading: number;
  /** 0~1. 얼마나 떠 있는지. */
  lift: number;
  color: string;
};

type Cam = { lat: number; lng: number; heading: number; zoom: number; lift: number };

export function ReplayStage({
  places,
  step,
  gone,
  done,
  onReady,
  height = 360,
}: {
  places: StagePlace[];
  /** 지금 떠난 자리. places.length 와 같으면 다 본 것입니다. */
  step: number;
  /** 다음 자리까지 온 몫(0~1, 고르게). 여기서 뜨고 내리는 곡선을 입힙니다. */
  gone: number;
  done: boolean;
  onReady: () => void;
  height?: number;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  /* 상태로 둡니다 — 아래 그리기가 지도가 선 뒤에 다시 돌아야 합니다. */
  const [ready, setReady] = useState(false);
  const lines = useRef<any[]>([]);
  const trail = useRef<{ glow: any; core: any } | null>(null);
  const dots = useRef<any[]>([]);
  const flier = useRef<any>(null);
  /* 카메라와 탈것이 가야 할 자리(박자가 정함)와 지금 있는 자리(화면이 옮김). */
  const goal = useRef<Goal | null>(null);
  const cam = useRef<Cam | null>(null);
  /* 탈것 그림을 매 화면 새로 만들지 않으려고 — 각도 · 높이 · 색이 같으면 그대로. */
  const flierKey = useRef('');

  /* 지도를 한 번 세웁니다. */
  useEffect(() => {
    let alive = true;
    loadMaps()
      .then(() => {
        if (!alive || !box.current || !MAP_ID) {
          return;
        }
        const g = gmaps();
        map.current = new g.Map(box.current, {
          mapId: MAP_ID,
          renderingType: g.RenderingType?.VECTOR ?? 'VECTOR',
          center: places[0] ? { lat: places[0].lat, lng: places[0].lng } : { lat: 35.68, lng: 139.76 },
          zoom: 14,
          tilt: tiltFor(14),
          heading: 0,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          keyboardShortcuts: false,
          clickableIcons: false,
        });
        g.event.addListenerOnce(map.current, 'idle', () => {
          setReady(true);
          onReady();
        });
      })
      .catch(() => {
        /* 키가 없거나 못 받았습니다. 덮개가 계속 「가져오는 중」이면 안 되므로
           그래도 출발시킵니다 — 아래 글자 줄은 지도 없이도 읽힙니다. */
        onReady();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 갈 길 전체와 들를 곳. 곳이 바뀔 때(날짜를 고를 때)만 다시 그립니다. */
  useEffect(() => {
    if (!map.current || !ready) {
      return;
    }
    const g = gmaps();
    lines.current.forEach((l) => l.setMap(null));
    dots.current.forEach((d) => d.setMap(null));
    trail.current?.glow.setMap(null);
    trail.current?.core.setMap(null);
    lines.current = [];
    dots.current = [];

    for (let i = 0; i < places.length - 1; i++) {
      lines.current.push(
        new g.Polyline({
          map: map.current,
          path: [places[i], places[i + 1]].map((p) => ({ lat: p.lat, lng: p.lng })),
          strokeColor: places[i + 1].color,
          strokeOpacity: 0.28,
          strokeWeight: 3,
          geodesic: true,
          zIndex: 1,
        }),
      );
    }
    places.forEach((p, i) => {
      dots.current.push(
        new g.Marker({
          map: map.current,
          position: { lat: p.lat, lng: p.lng },
          icon: dotIcon(g, p.color, false),
          title: p.name,
          zIndex: 10 + i,
        }),
      );
    });
    trail.current = {
      glow: new g.Polyline({
        map: map.current,
        path: [],
        strokeOpacity: 0.22,
        strokeWeight: 14,
        geodesic: true,
        zIndex: 2,
      }),
      core: new g.Polyline({
        map: map.current,
        path: [],
        strokeOpacity: 1,
        strokeWeight: 4,
        geodesic: true,
        zIndex: 3,
      }),
    };
  }, [places, ready]);

  /*
    한 박자마다(Replay 가 1초에 스무 번) — 지나온 길을 늘리고, 카메라와 탈것이
    <b>가야 할 자리</b>만 정합니다. 실제로 옮기는 것은 아래 화면 갱신 고리입니다.

    <h3>왜 둘로 나누는가</h3>

    <p>처음에는 박자마다 카메라를 그 자리로 바로 옮겼습니다. 1초에 스무 번
    뚝뚝 옮기니 화면이 떨렸고, 무엇보다 <b>곳에 닿는 순간</b> 다음 구간에 맞춘
    배율 · 기울기 · 방향이 한꺼번에 바뀌어 덜컹했습니다 — 「도착할 때 끊기고
    바라보는 쪽이 갑자기 달라져서 이어지는 느낌이 없다」.

    <p>이제 박자는 목표만 정하고, 카메라는 매 화면(1초에 예순 번) 목표 쪽으로
    조금씩 다가갑니다. 그리고 목표 자체를 미리 섞습니다 — 구간의 마지막 3할
    동안 방향과 배율이 <b>다음 구간 것으로 서서히</b> 넘어가므로, 닿을 즈음엔
    이미 다음 쪽을 보고 있습니다. 머무는 동안에도 카메라는 마저 돌고 있어서
    멈춘 것이 아니라 숨 고르는 것으로 보입니다.
  */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || places.length === 0) {
      return;
    }
    const g = gmaps();
    const at0 = Math.min(step, places.length - 1);
    const now = places[at0];
    const next = done ? null : (places[at0 + 1] ?? null);
    const after = done ? null : (places[at0 + 2] ?? null);
    const raw = Math.min(1, Math.max(0, gone));
    const t = ease(raw);
    const pos = next
      ? { lat: now.lat + (next.lat - now.lat) * t, lng: now.lng + (next.lng - now.lng) * t }
      : { lat: now.lat, lng: now.lng };

    /* 지나온 길 */
    const passed = places.slice(0, at0 + 1).map((p) => ({ lat: p.lat, lng: p.lng }));
    const path = next ? [...passed, pos] : passed;
    const color = (next ?? now).color;
    trail.current?.glow.setOptions({ path, strokeColor: color });
    trail.current?.core.setOptions({ path, strokeColor: color });

    /* 들른 곳은 채웁니다 */
    dots.current.forEach((d, i) => d.setIcon(dotIcon(g, places[i].color, i <= at0)));

    if (done) {
      goal.current = null;
      flier.current?.setMap(null);
      flier.current = null;
      /* 다 봤으면 물러나 전부를 비스듬히. */
      const bounds = new g.LatLngBounds();
      places.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      m.fitBounds(bounds, 48);
      g.event.addListenerOnce(m, 'idle', () => {
        m.moveCamera({ tilt: TILT_FAR + 10, heading: 0 });
        cam.current = null;
      });
      return;
    }

    /* 이 구간과 다음 구간. 마지막 3할 동안 다음 것으로 섞습니다. */
    const km = next ? distanceKm(now, next) : 0;
    const legHeading = next ? bearing(now, next) : (cam.current?.heading ?? 0);
    const mix = next && after ? smooth((raw - 0.7) / 0.3) : 0;
    const nextKm = next && after ? distanceKm(next, after) : km;
    const nextHeading = next && after ? bearing(next, after) : legHeading;
    /* 가운데에서 가장 높이. 멀리 갈수록 더 올라가 앞뒤가 다 보입니다. */
    const lift = Math.sin(raw * Math.PI) * (km > 50 ? 2.4 : km > 5 ? 1.3 : 0.5);
    const zoom = zoomFor(km) * (1 - mix) + zoomFor(nextKm) * mix - lift;

    goal.current = {
      lat: pos.lat,
      lng: pos.lng,
      heading: blendAngle(legHeading, nextHeading, mix),
      zoom,
      legHeading,
      lift: lift / 2.4,
      color,
    };
  }, [places, step, gone, done, ready]);

  /*
    화면 갱신 고리. 카메라와 탈것을 목표 쪽으로 조금씩.

    <p>탈것은 빨리(목표에 거의 붙어서), 카메라 방향 · 배율 · 기울기는 천천히
    따라갑니다. 카메라 한가운데는 <b>탈것이 그려진 자리</b>입니다 — 둘을 따로
    따라가게 두면 탈것이 화면 안에서 흔들립니다.
  */
  useEffect(() => {
    if (!ready) {
      return;
    }
    const g = gmaps();
    let raf = 0;
    let last = performance.now();
    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      const m = map.current;
      const want = goal.current;
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      if (!m || !want) {
        return;
      }
      const c = cam.current ?? { ...want };
      const fast = 1 - Math.exp(-dt * 18);
      const slow = 1 - Math.exp(-dt * 3.2);
      c.lat += (want.lat - c.lat) * fast;
      c.lng += (want.lng - c.lng) * fast;
      c.zoom += (want.zoom - c.zoom) * slow;
      c.heading = turnToward(c.heading, want.heading, slow);
      c.lift += (want.lift - c.lift) * slow;
      cam.current = c;

      m.moveCamera({
        center: { lat: c.lat, lng: c.lng },
        zoom: c.zoom,
        heading: c.heading,
        tilt: tiltFor(c.zoom),
      });

      /* 탈것은 가는 쪽을 봅니다. 카메라가 돌아 있는 만큼 빼서 그립니다. */
      const rotation = (want.legHeading - c.heading + 360) % 360;
      const key = `${Math.round(rotation)}|${Math.round(c.lift * 20)}|${want.color}`;
      if (!flier.current) {
        flier.current = new g.Marker({
          map: m,
          position: { lat: c.lat, lng: c.lng },
          icon: flierIcon(g, rotation, c.lift, want.color),
          zIndex: 999,
          clickable: false,
        });
        flierKey.current = key;
      } else {
        flier.current.setPosition({ lat: c.lat, lng: c.lng });
        if (flierKey.current !== key) {
          flier.current.setIcon(flierIcon(g, rotation, c.lift, want.color));
          flierKey.current = key;
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <div ref={box} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

/* ------------------------------------------------------------------ 셈 */

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

/**
 * 구간 길이에 맞는 배율. 걷는 구간은 건물이 블록으로 서는 데까지(17 넘게 —
 * 16.5 로 막아 두었더니 3D 건물이 한 번도 안 섰습니다), 수백 km 나는 구간은
 * 두 도시가 한 화면에 들어오게.
 */
function zoomFor(km: number) {
  return Math.max(5, Math.min(17.8, 17.8 - Math.log2(Math.max(0.25, km) / 0.25)));
}

/**
 * 배율에 맞는 기울기. 가까울수록 눕힙니다 — 구글은 배율이 낮으면 많이 못
 * 눕히고, 멀리서 많이 눕히면 지평선만 보입니다. 배율과 함께 움직여야 날아오를 때
 * 자연스럽게 세워집니다.
 */
function tiltFor(zoom: number) {
  const k = Math.max(0, Math.min(1, (zoom - 9) / 8));
  return 30 + k * 37;
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

function dotIcon(g: any, color: string, passed: boolean) {
  return {
    path: g.SymbolPath.CIRCLE,
    scale: passed ? 6 : 5,
    fillColor: passed ? color : '#FFFFFF',
    fillOpacity: 1,
    strokeColor: color,
    strokeWeight: passed ? 2 : 2.5,
  };
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
