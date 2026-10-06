import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { gmaps } from '@/lib/gmaps.web';
import { createJourney, type Journey, type JourneyPoint } from '@/lib/journey.web';
import { createTiltMap } from '@/lib/tilt-map.web';

/**
 * 여행 상세의 「3D」 보기 — 기울인 지도에서 장소를 누르면 그리로 갑니다.
 *
 * <h3>평평한 지도와 무엇이 다른가</h3>
 *
 * <p>평평한 TripMap 은 일정을 <b>짜는</b> 지도입니다 — 동행자 얼굴, 꽂아 둔 깃발,
 * 내 위치, 전체화면, 장소 판. 이것은 일정을 <b>미리 걸어 보는</b> 지도입니다.
 * 장소(일정 줄이든 핀이든)를 고르면 앞에 고른 곳에서 그곳까지 탈것이 갑니다 —
 * 동선 다시 보기(요약 화면)와 같은 탈것 · 빠르기 · 카메라(lib/journey).
 *
 * <p>둘을 한 지도로 합치지 않습니다. 기울이려면 지도 ID 가 있어야 하고, 지도 ID 를
 * 쓰면 평평한 지도의 꾸밈(styles)이 무시됩니다(docs/plan-trip-3d.md). 그래서
 * 「3D」 단추는 지도 자리의 지도를 갈아 끼웁니다.
 *
 * <h3>찾은 길대로</h3>
 *
 * <p>「이동 시간」으로 길을 찾아 둔 날이면, 붙어 있는 두 곳(1번 → 2번) 사이는 그
 * 길대로 갑니다(places[].path). 떨어진 두 곳(1번 → 5번)이나 길을 안 찾은 구간은
 * 곧게 갑니다.
 */

export type Place3D = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 몇째 날인지. 같은 날끼리 선으로 잇습니다. */
  dayIndex: number;
  /** 그날 안에서 몇 번째인지. 핀에 적습니다. */
  order: number;
  color: string;
  /** 다음 곳까지의 이동 수단 — 적어 둔 것, 없으면 「이동 시간」에서 고른 것. */
  mode?: string | null;
  /** 다음 곳까지 찾아 둔 길(풀어 둔 점들). 없으면 곧게. */
  path?: { lat: number; lng: number }[] | null;
};

export function TripMap3D({
  places,
  activeId,
  onSelect,
}: {
  places: Place3D[];
  activeId: string | null;
  onSelect: (placeId: string) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const journey = useRef<Journey | null>(null);
  const [ready, setReady] = useState(false);
  const pins = useRef<any[]>([]);
  const lines = useRef<any[]>([]);
  /* 마지막으로 서 있던 곳. 새 곳을 고르면 여기서 출발합니다. */
  const standing = useRef<string | null>(null);
  /* 핀 누르기는 그때그때의 onSelect 를 불러야 합니다(핀은 곳이 바뀔 때만 다시 그림). */
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  /* 지도를 한 번 세웁니다. */
  useEffect(() => {
    let alive = true;
    if (!box.current) {
      return;
    }
    const first = places.find((p) => p.id === activeId) ?? places[0] ?? { lat: 35.68, lng: 139.76 };
    createTiltMap(box.current, { lat: first.lat, lng: first.lng })
      .then((made) => {
        if (!alive) {
          return;
        }
        map.current = made;
        journey.current = createJourney(made);
        setReady(true);
      })
      .catch(() => {
        /* 지도 ID 가 없거나 못 받았습니다 — 부르는 쪽이 hasTiltMaps 로 거르므로
           여기 오는 것은 받다가 끊긴 때뿐입니다. 빈 자리로 둡니다. */
      });
    return () => {
      alive = false;
      journey.current?.dispose();
      journey.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 핀과 선. 곳이 바뀔 때(날짜를 고를 때, 고칠 때)만 다시 그립니다. */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) {
      return;
    }
    const g = gmaps();
    pins.current.forEach((p) => p.setMap(null));
    lines.current.forEach((l) => l.setMap(null));
    pins.current = [];
    lines.current = [];

    places.forEach((p, i) => {
      const next = places[i + 1];
      if (next && next.dayIndex === p.dayIndex) {
        const road = p.path && p.path.length >= 2 ? p.path : null;
        lines.current.push(
          new g.Polyline({
            map: m,
            path: road ?? [
              { lat: p.lat, lng: p.lng },
              { lat: next.lat, lng: next.lng },
            ],
            strokeColor: p.color,
            /* 찾은 길은 진하게, 곧게 이은 것은 옅게 — 어느 구간이 진짜 길인지 갈립니다. */
            strokeOpacity: road ? 0.85 : 0.35,
            strokeWeight: road ? 5 : 3,
            geodesic: !road,
            zIndex: road ? 2 : 1,
          }),
        );
      }
      const pin = new g.Marker({
        map: m,
        position: { lat: p.lat, lng: p.lng },
        icon: pinIcon(g, p.color),
        label: { text: String(p.order), color: '#FFFFFF', fontSize: '11px', fontWeight: '700' },
        title: p.name,
        zIndex: 10 + i,
      });
      pin.addListener('click', () => select.current(p.id));
      pins.current.push(pin);
    });

    /* 서 있던 곳이 이 목록에 없으면(다른 날로 옮김) 전부를 비스듬히 봅니다. */
    if (!standing.current || !places.some((p) => p.id === standing.current)) {
      standing.current = null;
      journey.current?.overview(places);
    }
  }, [places, ready]);

  /*
    고른 곳이 바뀌면 — 앞에 서 있던 곳에서 거기까지 갑니다.

    <p>처음 고를 때는 갈 출발점이 없어 그 자리에 내려섭니다(카메라는 내려앉듯
    다가갑니다). 가는 도중에 또 고르면 journey 가 지금 자리에서 꺾습니다.
  */
  useEffect(() => {
    const j = journey.current;
    if (!j || !ready || !activeId) {
      return;
    }
    const to = places.find((p) => p.id === activeId);
    if (!to) {
      return;
    }
    const fromIndex = places.findIndex((p) => p.id === standing.current);
    const from = fromIndex >= 0 ? places[fromIndex] : null;
    standing.current = to.id;
    if (!from || from.id === to.id) {
      j.park(pointOf(to, null));
      return;
    }
    /* 붙어 있는 두 곳(같은 날 바로 다음)일 때만 찾아 둔 길을 씁니다. */
    const adjacent = places[fromIndex + 1]?.id === to.id && from.dayIndex === to.dayIndex;
    j.travel(pointOf(from, adjacent ? from.path ?? null : null), pointOf(to, null)).catch(() => {
      /* 끊기면 다음 고른 곳이 이어 갑니다. */
    });
  }, [activeId, places, ready]);

  return (
    <View style={{ flex: 1 }}>
      <div ref={box} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

function pointOf(p: Place3D, path: { lat: number; lng: number }[] | null): JourneyPoint {
  return { lat: p.lat, lng: p.lng, color: p.color, mode: p.mode ?? null, path };
}

/** 번호를 얹는 동그라미. 고른 곳은 탈것이 말하므로 핀은 늘 같은 모양입니다. */
function pinIcon(g: any, color: string) {
  return {
    path: g.SymbolPath.CIRCLE,
    scale: 11,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 2,
  };
}
