import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { gmaps } from '@/lib/gmaps.web';
import { aimAlong, createJourney, type Journey, type JourneyPoint } from '@/lib/journey.web';
import { createTiltMap } from '@/lib/tilt-map.web';

export { hasTiltMaps, MAP_ID } from '@/lib/tilt-map.web';

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
 * 과금되고 폰 웹뷰에서 무겁습니다. Mapbox 도 안 씁니다 — 장소 데이터가 구글
 * 것이라 구글이 아닌 지도 위에 올리면 약관에 걸립니다.
 *
 * <h3>무엇을 하고 무엇을 맡기는가</h3>
 *
 * <p>지도는 lib/tilt-map, 카메라와 3D 탈것은 lib/journey 가 합니다(여행 상세의
 * 「3D」 보기와 같은 것). 여기는 <b>동선에만 있는 것</b> — 갈 길 전체 · 지나온 길 ·
 * 들른 곳 점 — 과, 박자(step · gone)를 목표로 바꿔 넘기는 일만 합니다.
 *
 * <ul>
 *   <li>갈 길 전체 — 날짜 색, 옅게</li>
 *   <li>지나온 길 — 날짜 색, 넓고 옅은 빛 위에 가는 선 한 겹. 지나가면서 늘어납니다</li>
 *   <li>들른 곳 — 지난 곳은 채운 점, 남은 곳은 테두리만</li>
 * </ul>
 */

export type StagePlace = JourneyPoint & {
  id: string;
  name: string;
};

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
  /** 다음 자리까지 온 몫(0~1, 고르게). 탈것의 곡선은 lib/journey 가 입힙니다. */
  gone: number;
  done: boolean;
  onReady: () => void;
  height?: number;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const journey = useRef<Journey | null>(null);
  /* 상태로 둡니다 — 아래 그리기가 지도가 선 뒤에 다시 돌아야 합니다. */
  const [ready, setReady] = useState(false);
  const lines = useRef<any[]>([]);
  const trail = useRef<{ glow: any; core: any } | null>(null);
  const dots = useRef<any[]>([]);

  /* 지도를 한 번 세웁니다. */
  useEffect(() => {
    let alive = true;
    if (!box.current) {
      return;
    }
    const first = places[0] ?? { lat: 35.68, lng: 139.76 };
    createTiltMap(box.current, { lat: first.lat, lng: first.lng })
      .then((made) => {
        if (!alive) {
          return;
        }
        map.current = made;
        journey.current = createJourney(made);
        /* 3D 탈것을 받을 때까지(길어야 4초) 출발을 미룹니다 — 첫 구간부터 제
           탈것이 서게(lib/journey 의 ready). */
        return Promise.race([
          journey.current.ready,
          new Promise<void>((resolve) => setTimeout(resolve, 4000)),
        ]);
      })
      .then(() => {
        if (!alive || !journey.current) {
          return;
        }
        setReady(true);
        onReady();
      })
      .catch(() => {
        /* 키나 지도 ID 가 없거나 못 받았습니다. 덮개가 계속 「가져오는 중」이면
           안 되므로 그래도 출발시킵니다 — 아래 글자 줄은 지도 없이도 읽힙니다. */
        onReady();
      });
    return () => {
      alive = false;
      journey.current?.dispose();
      journey.current = null;
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
    가야 할 자리를 lib/journey 에 넘깁니다. 옮기는 것은 그쪽 화면 갱신 고리입니다.
  */
  useEffect(() => {
    const j = journey.current;
    if (!j || !ready || places.length === 0) {
      return;
    }
    const g = gmaps();
    const at0 = Math.min(step, places.length - 1);
    const now = places[at0];
    const next = done ? null : (places[at0 + 1] ?? null);
    const after = done ? null : (places[at0 + 2] ?? null);

    if (done) {
      dots.current.forEach((d, i) => d.setIcon(dotIcon(g, places[i].color, true)));
      trail.current?.glow.setOptions({ path: places.map((p) => ({ lat: p.lat, lng: p.lng })) });
      trail.current?.core.setOptions({ path: places.map((p) => ({ lat: p.lat, lng: p.lng })) });
      /* 다 봤으면 물러나 전부를 비스듬히. */
      j.overview(places);
      return;
    }

    const aim = aimAlong(now, next, after, gone);
    j.aim(aim);

    /* 지나온 길 */
    const passed = places.slice(0, at0 + 1).map((p) => ({ lat: p.lat, lng: p.lng }));
    const path = next ? [...passed, { lat: aim.lat, lng: aim.lng }] : passed;
    trail.current?.glow.setOptions({ path, strokeColor: aim.color });
    trail.current?.core.setOptions({ path, strokeColor: aim.color });

    /* 들른 곳은 채웁니다 */
    dots.current.forEach((d, i) => d.setIcon(dotIcon(g, places[i].color, i <= at0)));
  }, [places, step, gone, done, ready]);

  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <div ref={box} style={{ width: '100%', height: '100%' }} />
    </View>
  );
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
