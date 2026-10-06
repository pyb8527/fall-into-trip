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

/** 기울기. 가까이 걸을 때는 많이 눕히고, 멀리 날 때는 세웁니다. */
const TILT_NEAR = 62;
const TILT_FAR = 35;

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
  /* 카메라가 지금 보고 있는 쪽. 다음 쪽으로 조금씩 돌립니다 — 한 번에 돌리면
     구간이 바뀔 때마다 화면이 홱 돕니다. */
  const heading = useRef(0);

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
          tilt: TILT_NEAR,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, ready]);

  /* 한 박자마다 — 지나온 길을 늘리고, 탈것을 옮기고, 카메라를 따라 붙입니다. */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || places.length === 0) {
      return;
    }
    const g = gmaps();
    const now = places[Math.min(step, places.length - 1)];
    const next = done ? null : (places[step + 1] ?? null);
    const t = ease(Math.min(1, Math.max(0, gone)));
    const at = next
      ? { lat: now.lat + (next.lat - now.lat) * t, lng: now.lng + (next.lng - now.lng) * t }
      : { lat: now.lat, lng: now.lng };

    /* 지나온 길 */
    const passed = places.slice(0, Math.min(step, places.length - 1) + 1).map((p) => ({ lat: p.lat, lng: p.lng }));
    const path = next ? [...passed, at] : passed;
    const color = (next ?? now).color;
    trail.current?.glow.setOptions({ path, strokeColor: color });
    trail.current?.core.setOptions({ path, strokeColor: color });

    /* 들른 곳은 채웁니다 */
    dots.current.forEach((d, i) => d.setIcon(dotIcon(g, places[i].color, i <= step)));

    if (done) {
      flier.current?.setMap(null);
      flier.current = null;
      /* 다 봤으면 물러나 전부를 비스듬히. */
      const bounds = new g.LatLngBounds();
      places.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      m.fitBounds(bounds, 48);
      g.event.addListenerOnce(m, 'idle', () => {
        m.moveCamera({ tilt: TILT_FAR + 10, heading: 0 });
      });
      return;
    }

    /* 카메라 — 가는 쪽을 보고, 먼 구간일수록 높이 올라갑니다. */
    const km = next ? distanceKm(now, next) : 0;
    const want = next ? bearing(now, next) : heading.current;
    heading.current = turnToward(heading.current, want, 0.12);
    const base = zoomFor(km);
    /* 가운데에서 가장 높이. 멀리 갈수록 더 올라가 앞뒤가 다 보입니다. */
    const lift = Math.sin(Math.min(1, Math.max(0, gone)) * Math.PI) * (km > 50 ? 2.2 : km > 5 ? 1.2 : 0.4);
    m.moveCamera({
      center: at,
      zoom: base - lift,
      heading: heading.current,
      tilt: km > 50 ? TILT_FAR : TILT_NEAR,
    });

    /* 탈것. 카메라가 가는 쪽을 보므로 지도 위에서는 늘 위(앞)를 봅니다. */
    const icon = flierIcon(g, (want - heading.current + 360) % 360, lift / 2.2, color);
    if (!flier.current) {
      flier.current = new g.Marker({ map: m, position: at, icon, zIndex: 999, clickable: false });
    } else {
      flier.current.setPosition(at);
      flier.current.setIcon(icon);
    }
  }, [places, step, gone, done, ready]);

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
 * 구간 길이에 맞는 배율. 1km 남짓 걷는 구간은 골목이 보이게, 수백 km 나는
 * 구간은 두 도시가 한 화면에 들어오게.
 */
function zoomFor(km: number) {
  if (km <= 0.05) {
    return 16.5;
  }
  return Math.max(5, Math.min(16.5, 16.2 - Math.log2(Math.max(0.3, km) / 0.4)));
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
