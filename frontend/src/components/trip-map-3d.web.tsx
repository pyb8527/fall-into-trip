import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { FollowButton } from '@/components/follow-button';
import { gmaps } from '@/lib/gmaps.web';
import { createJourney, distanceKm, type Journey, type JourneyPoint } from '@/lib/journey.web';
import type { LegPiece } from '@/lib/leg-path';
import { createTiltMap } from '@/lib/tilt-map.web';
import { legMs, vehicleFor } from '@/lib/vehicles';

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
 * <h3>역을 거쳐서</h3>
 *
 * <p>「이동 시간」(구글 경로선)으로 찾은 길을 따라가던 자리입니다. 그 셈은
 * 2026-10-13 에 걷어냈고(lib/directions), 이제는 사람이 이동에 적어 둔 역을
 * 거칩니다 — A → 타는 역(걸어서) → 내리는 역(타고) → B. 선과 탈것이 같은
 * 토막(places[].pieces, lib/leg-path)을 씁니다.
 *
 * <h3>어디를 골랐느냐에 따라</h3>
 *
 * <ul>
 *   <li><b>뒤쪽</b>(지금보다 앞 차례의 곳) — 연출 없이 그 자리로 한 번에 옮깁니다.
 *       되짚어 가는 모습은 지나온 길을 거꾸로 보여 줄 뿐 알려 주는 것이 없습니다.</li>
 *   <li><b>바로 다음 곳</b> — 그 한 구간을 갑니다.</li>
 *   <li><b>더 뒤의 곳</b>(1번에서 4번) — 사이의 곳과 역을 차례로 거칩니다. 곧게
 *       날아가면 그날 동선이 아니라 엉뚱한 지름길을 보여 줍니다. 토막이 많아지면
 *       전체가 {@link CHAIN_MS} 안에 들도록 빠르게 갑니다.</li>
 * </ul>
 *
 * <p>가는 도중에 또 고르면 <b>그 순간 자리</b>를 기준으로 같은 규칙을 씁니다 — 아직
 * 안 닿은 곳을 고르면 지금 자리에서 이어 가고, 이미 지난 곳을 고르면 한 번에 옮깁니다.
 */

/**
 * 여러 토막을 이어 갈 때 전체 시간의 상한.
 *
 * <p>한 구간은 탈것 · 거리로 2.4~7초입니다(lib/vehicles.legMs). 역을 거치면 한
 * 구간이 세 토막이 되고, 1번에서 5번까지면 열 토막이 넘습니다 — 제 빠르기로
 * 가면 1분 가까이 걸려 누른 사람이 기다리다 지칩니다. 가장 긴 한 구간보다 조금
 * 긴 10초에 맞춰 토막마다 같은 비율로 줄입니다.
 */
const CHAIN_MS = 10_000;

/** 줄여도 한 토막이 이보다 짧으면 탈것이 보이기도 전에 지나갑니다. */
const PIECE_MIN_MS = 700;

/** 역에서 잠깐 섭니다 — 갈아타는 자리라는 것이 보이게. */
const STATION_STOP_MS = 250;

/** 사이의 곳에서도 잠깐 섭니다. 역보다 조금 길게 — 들르는 곳이니까요. */
const PLACE_STOP_MS = 400;

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
  /** 다음 곳까지 적어 둔 이동 수단(place.move.mode). 없으면 거리로 고릅니다. */
  mode?: string | null;
  /**
   * 다음 곳(같은 날)까지 지나는 토막(lib/leg-path.legPieces). 역을 안 적었으면
   * 곧게 한 토막이고, 마지막 곳이면 없습니다.
   */
  pieces?: LegPiece[] | null;
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
  /* 손으로 카메라를 가져갔는지 — 그때만 「따라가기」가 섭니다. */
  const [following, setFollowing] = useState(true);
  const pins = useRef<any[]>([]);
  const lines = useRef<any[]>([]);
  /* 마지막으로 서 있던 곳. 새 곳을 고르면 여기서 출발합니다. */
  const standing = useRef<string | null>(null);
  /*
    지금 가고 있는 길 — 이어 가는 도중에 다시 고르면 「그 순간 자리」를 여기서
    읽습니다. toward 는 지금 향하는 곳, rest 는 그 구간에서 아직 안 지난 토막들
    (지금 지나는 토막 포함)입니다. 서 있으면 null 입니다.
  */
  const going = useRef<{ toward: string; rest: LegPiece[] } | null>(null);
  /* 고를 때마다 하나씩 올립니다. 앞에서 시작한 고리는 번호가 바뀐 것을 보고 멈춥니다. */
  const run = useRef(0);
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
        journey.current.onFollowChange(setFollowing);
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
        const pieces = piecesOf(p, next);
        const bent = pieces.length > 1;
        pieces.forEach((piece) => {
          /* 역을 거치는 구간은 타는 토막을 진하게, 걷는 토막을 옅게 — 어디서 타고
             어디서 내리는지가 선만 보고 읽힙니다. 역이 없는 구간은 옅게 곧게. */
          const strong = bent && piece.ride;
          lines.current.push(
            new g.Polyline({
              map: m,
              path: [
                { lat: piece.from.lat, lng: piece.from.lng },
                { lat: piece.to.lat, lng: piece.to.lng },
              ],
              strokeColor: p.color,
              strokeOpacity: strong ? 0.85 : 0.35,
              strokeWeight: strong ? 5 : 3,
              geodesic: true,
              zIndex: strong ? 2 : 1,
            }),
          );
        });
        /* 역 표시 — 번호 핀과 헷갈리지 않게 번호 없는 작은 동그라미. */
        pieces.slice(0, -1).forEach((piece) => {
          lines.current.push(
            new g.Marker({
              map: m,
              position: { lat: piece.to.lat, lng: piece.to.lng },
              icon: stationIcon(g, p.color),
              clickable: false,
              zIndex: 5,
            }),
          );
        });
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
    고른 곳이 바뀌면 — 앞에 서 있던 곳에서 거기까지 갑니다(규칙은 맨 위 문서).

    <p>처음 고를 때는 갈 출발점이 없어 그 자리에 내려섭니다(카메라는 내려앉듯
    다가갑니다).
  */
  useEffect(() => {
    const j = journey.current;
    if (!j || !ready || !activeId) {
      return;
    }
    const toIndex = places.findIndex((p) => p.id === activeId);
    if (toIndex < 0) {
      return;
    }
    const to = places[toIndex];
    const ticket = ++run.current;
    /* 새 곳을 골랐으면 가는 모습을 보여 줍니다 — 손으로 카메라를 가져가 있었어도
       다시 붙습니다. */
    j.follow();

    const atIndex = places.findIndex((p) => p.id === standing.current);
    const now = going.current;
    const towardIndex = now ? places.findIndex((p) => p.id === now.toward) : -1;
    /* 가는 중이면 지금 향하는 곳의 바로 앞까지를 지난 것으로 칩니다. 향하는 곳은
       아직 안 닿았으니 고르면 이어 갑니다. */
    const passed = towardIndex >= 0 ? towardIndex - 1 : atIndex;

    if (atIndex < 0 || toIndex < passed || (towardIndex < 0 && toIndex === atIndex)) {
      /* 처음 고름 · 뒤쪽 · 서 있는 그 자리 — 연출 없이 그 자리로. 처음 고를 때만
         카메라가 다가가고, 나머지는 한 번에 옮깁니다. */
      going.current = null;
      standing.current = to.id;
      j.park(pointOf(to), undefined, atIndex >= 0);
      return;
    }
    if (towardIndex >= 0 && toIndex === passed) {
      /* 가는 도중에 막 떠나온 곳을 골랐습니다 — 이것도 뒤쪽입니다. */
      going.current = null;
      standing.current = to.id;
      j.park(pointOf(to), undefined, true);
      return;
    }

    /* 앞으로 — 지금 자리에서 그곳까지 거칠 토막들을 차례로 늘어놓습니다. 가는
       도중이면 첫 구간은 아직 안 지난 토막부터입니다(journey 가 지금 자리에서 꺾음). */
    type Step = { piece: LegPiece; arrive: string | null; stop: number };
    const steps: Step[] = [];
    for (let i = passed; i < toIndex; i++) {
      const pieces = i === passed && now && towardIndex >= 0 ? now.rest : piecesOf(places[i], places[i + 1]);
      pieces.forEach((piece, k) => {
        const last = k === pieces.length - 1;
        steps.push({
          piece,
          arrive: last ? places[i + 1].id : null,
          stop: last ? (i + 1 === toIndex ? 0 : PLACE_STOP_MS) : STATION_STOP_MS,
        });
      });
    }
    if (steps.length === 0) {
      return;
    }
    /* 한 토막이면 제 빠르기 그대로, 여럿이면 전체가 CHAIN_MS 안에 들게. */
    const natural = steps.map((s) => naturalMs(s.piece));
    const total = natural.reduce((sum, ms) => sum + ms, 0);
    const scale = steps.length > 1 && total > CHAIN_MS ? CHAIN_MS / total : 1;

    (async () => {
      for (let k = 0; k < steps.length; k++) {
        if (run.current !== ticket) {
          return;
        }
        const { piece, arrive, stop } = steps[k];
        /* 지금 향하는 곳과 그 구간의 남은 토막 — 도중에 다시 고르면 여기서 읽습니다. */
        const rest: LegPiece[] = [];
        let towardId = to.id;
        for (let r = k; r < steps.length; r++) {
          rest.push(steps[r].piece);
          if (steps[r].arrive) {
            towardId = steps[r].arrive as string;
            break;
          }
        }
        going.current = { toward: towardId, rest };
        const color = places.find((p) => p.id === towardId)?.color ?? to.color;
        const ok = await j.travel(
          { lat: piece.from.lat, lng: piece.from.lng, color, mode: piece.mode, path: null },
          { lat: piece.to.lat, lng: piece.to.lng, color, mode: piece.mode, path: null },
          { ms: scale === 1 ? undefined : Math.max(PIECE_MIN_MS, natural[k] * scale) },
        );
        if (!ok || run.current !== ticket) {
          return;
        }
        if (arrive) {
          /* 곳에 닿았습니다 — 여기 서 있는 동안 고르면 이 곳에서 다시 셉니다. */
          standing.current = arrive;
          going.current = null;
        } else {
          /* 역에 섰습니다 — 그 구간은 아직 안 끝났으니 남은 토막만 들고 있습니다. */
          going.current = { toward: towardId, rest: rest.slice(1) };
        }
        if (stop > 0) {
          await new Promise((done) => setTimeout(done, stop));
        }
      }
      if (run.current === ticket) {
        going.current = null;
        standing.current = to.id;
      }
    })().catch(() => {
      /* 끊기면 다음 고른 곳이 이어 갑니다. */
    });
  }, [activeId, places, ready]);

  return (
    <View style={{ flex: 1 }}>
      <div ref={box} style={{ width: '100%', height: '100%' }} />
      <FollowButton visible={!following} onPress={() => journey.current?.follow()} />
    </View>
  );
}

function pointOf(p: Place3D): JourneyPoint {
  return { lat: p.lat, lng: p.lng, color: p.color, mode: p.mode ?? null, path: null };
}

/** 두 곳 사이 토막. 같은 날이 아니면(날을 건너면) 곧게 한 토막입니다. */
function piecesOf(a: Place3D, b: Place3D): LegPiece[] {
  if (a.dayIndex === b.dayIndex && a.pieces && a.pieces.length > 0) {
    return a.pieces;
  }
  return [{ from: a, to: b, ride: true, mode: a.mode ?? null }];
}

/** 이 토막을 제 빠르기로 갈 때 걸리는 시간 — journey.travel 이 쓰는 것과 같은 표. */
function naturalMs(piece: LegPiece) {
  const km = distanceKm(piece.from, piece.to);
  return legMs(vehicleFor(piece.mode, km), km);
}

/** 역 — 장소 핀(번호 동그라미)보다 작고 속이 흰 동그라미. */
function stationIcon(g: any, color: string) {
  return {
    path: g.SymbolPath.CIRCLE,
    scale: 5,
    fillColor: '#FFFFFF',
    fillOpacity: 1,
    strokeColor: color,
    strokeWeight: 2.5,
  };
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
