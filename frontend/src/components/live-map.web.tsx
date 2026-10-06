import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FollowButton } from '@/components/follow-button';
import { Colors, Elevation, Radius, Spacing } from '@/constants/theme';
import { gmaps, loadMaps } from '@/lib/gmaps.web';
import type { Here } from '@/lib/here';
import { aimAt, bearing, createJourney, distanceKm, type Journey } from '@/lib/journey.web';
import { createTiltMap, hasTiltMaps } from '@/lib/tilt-map.web';
import type { Vehicle } from '@/lib/vehicles';
import { Body, Caption, Icon } from '@/ui';

/**
 * 「지금 여기」 — 내가 움직이는 대로 지도가 따라가는 지도.
 *
 * <h3>두 자리에서 씁니다</h3>
 *
 * <ul>
 *   <li>따로 둔 메뉴(app/here) — 내 자리만.</li>
 *   <li>여행 상세의 「지금 여기」 — 내 자리에 더해 갈 곳(target)과 위치를 알리고 있는
 *       동행자(mates). 갈 곳이 있을 때만 그쪽 안내 띠가 섭니다.</li>
 * </ul>
 *
 * <h3>점이 튀지 않게</h3>
 *
 * <p>위치는 1~5초마다 한 번 옵니다. 그대로 찍으면 점이 툭툭 건너뜁니다. 새 자리가
 * 오면 <b>지금 그려진 자리에서 새 자리까지</b>를 직전 간격만큼의 시간 동안 고르게
 * 옮깁니다 — 걷는 사람이 미끄러지듯 이어서 갑니다.
 *
 * <h3>2D 와 3D</h3>
 *
 * <p>2D 는 파란 점 · 정확도 원 · 가는 쪽 화살표. 3D(지도 ID 가 있을 때)는 내 자리에
 * 사람(lib/journey · vehicle-scene)이 서 있다가 움직이면 걷고, 빠르면(초속 7m 넘게
 * — 시속 25km) 차로, 더 빠르면(초속 25m — 시속 90km) 기차로 바뀝니다.
 *
 * <h3>손으로 움직이면</h3>
 *
 * <p>밀거나 확대 · 돌리면 따라가기를 멈추고 「내 위치 따라가기」 단추가 섭니다.
 *
 * <h3>안 하는 것</h3>
 *
 * <p>화면을 끄거나 앱을 뒤로 보내면 멈춥니다(웹 · 웹뷰라 뒤에서 위치를 못 받음).
 * 걸어온 길을 서버에 남기지 않습니다.
 */

export type LiveTarget = { id: string; lat: number; lng: number; name: string; color: string };
export type LiveMate = { id: string; name: string; lat: number; lng: number; face: string };

/** 내 점의 색 — 지도 앱들이 쓰는 「나」의 파랑. 날짜 색과 안 겹칩니다. */
const ME = '#2F80ED';
/** 이보다 빠르면(m/s) 탈것으로 봅니다. */
const CAR_SPEED = 7;
const TRAIN_SPEED = 25;
/** 안내 띠의 대략의 높이(따라가기 단추를 그 위로 올리는 데). */
const GUIDE_H = 64;

export function LiveMap({
  here,
  threeD,
  target,
  mates,
  bottomInset = 0,
}: {
  here: Here | null;
  /** 3D 로 볼지. 지도 ID 가 없으면 무시하고 2D 입니다. */
  threeD: boolean;
  target?: LiveTarget | null;
  mates?: LiveMate[];
  /** 아래를 덮는 것(판 · 띠)의 높이. 안내 띠와 단추를 그 위에 둡니다. */
  bottomInset?: number;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const journey = useRef<Journey | null>(null);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const followRef = useRef(true);
  const tilt = hasTiltMaps();
  const use3d = threeD && tilt;
  const use3dRef = useRef(use3d);
  useEffect(() => {
    use3dRef.current = use3d;
  }, [use3d]);

  /* 그려진 자리와 다음 자리(부드럽게 잇기). */
  const shown = useRef<{ lat: number; lng: number } | null>(null);
  const leg = useRef<{ from: { lat: number; lng: number }; to: { lat: number; lng: number }; at: number; ms: number } | null>(null);
  const lastFixAt = useRef(0);
  const heading = useRef(0);
  const speed = useRef(0);

  const dot = useRef<any>(null);
  const ring = useRef<any>(null);
  const toward = useRef<{ pin: any; line: any } | null>(null);
  const others = useRef(new Map<string, any>());
  const [guide, setGuide] = useState<{ meters: number; turn: number } | null>(null);

  /* 지도를 한 번 세웁니다. 지도 ID 가 있으면 기울일 수 있는 지도, 없으면 평평한 지도. */
  useEffect(() => {
    let alive = true;
    if (!box.current) {
      return;
    }
    const center = here ? { lat: here.lat, lng: here.lng } : { lat: 37.5665, lng: 126.978 };
    const made = tilt
      ? createTiltMap(box.current, center, 17)
      : loadMaps().then(() => {
          const g = gmaps();
          return new g.Map(box.current, {
            center,
            zoom: 17,
            disableDefaultUI: true,
            gestureHandling: 'greedy',
            clickableIcons: false,
          });
        });
    made
      .then((m: any) => {
        if (!alive) {
          return;
        }
        map.current = m;
        const g = gmaps();
        /* 2D 에서 손으로 밀면 따라가기를 멈춥니다(3D 는 journey 가 알아서). */
        g.event.addListener(m, 'dragstart', () => {
          if (!use3dRef.current) {
            followRef.current = false;
            setFollowing(false);
          }
        });
        if (tilt) {
          journey.current = createJourney(m);
          journey.current.onFollowChange((on) => {
            followRef.current = on;
            setFollowing(on);
          });
        }
        setReady(true);
      })
      .catch(() => {
        /* 지도를 못 받았습니다 — 빈 자리로 둡니다. */
      });
    return () => {
      alive = false;
      journey.current?.dispose();
      journey.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 새 자리가 오면 — 지금 그려진 자리에서 거기까지를 직전 간격 동안 옮깁니다. */
  useEffect(() => {
    if (!here) {
      return;
    }
    const now = performance.now();
    const to = { lat: here.lat, lng: here.lng };
    const from = shown.current ?? to;
    const gap = lastFixAt.current ? now - lastFixAt.current : 0;
    lastFixAt.current = now;
    leg.current = { from, to, at: now, ms: Math.max(300, Math.min(4000, gap || 300)) };

    const moved = distanceKm(from, to) * 1000;
    /* 가는 쪽 — 기기가 알려 주면 그것, 아니면 움직인 쪽(3m 넘게 움직였을 때만 —
       서서 떨리는 값으로 돌지 않게). */
    if (here.heading != null) {
      heading.current = here.heading;
    } else if (moved > 3) {
      heading.current = bearing(from, to);
    }
    speed.current = here.speed ?? (gap > 0 ? moved / (gap / 1000) : 0);
  }, [here]);

  /* 2D · 3D 를 바꿀 때 — 3D 면 사람이 서고 파란 점은 걷습니다. 2D 면 반대. */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) {
      return;
    }
    if (!use3d) {
      journey.current?.aim(null);
      m.moveCamera({ tilt: 0, heading: 0 });
    } else {
      journey.current?.follow();
    }
    followRef.current = true;
    setFollowing(true);
  }, [use3d, ready]);

  /* 화면 갱신 고리 — 자리를 잇고, 점(또는 사람)과 카메라와 갈 곳 선을 옮깁니다. */
  useEffect(() => {
    if (!ready) {
      return;
    }
    const g = gmaps();
    let raf = 0;
    let lastGuide = 0;
    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      const m = map.current;
      const l = leg.current;
      if (!m || !l) {
        return;
      }
      const t = Math.min(1, (nowMs - l.at) / l.ms);
      const pos = { lat: l.from.lat + (l.to.lat - l.from.lat) * t, lng: l.from.lng + (l.to.lng - l.from.lng) * t };
      shown.current = pos;

      if (use3dRef.current && journey.current) {
        dot.current?.setMap(null);
        ring.current?.setMap(null);
        const v: Vehicle = speed.current > TRAIN_SPEED ? 'train' : speed.current > CAR_SPEED ? 'car' : 'walk';
        /* 따라가는 동안만 목표를 줍니다. 손으로 가져가 있으면 journey 가 카메라를
           놓고 사람만 그 자리에 그립니다. */
        journey.current.aim(
          aimAt({ ...pos, color: ME }, { heading: heading.current, vehicle: v, still: speed.current < 0.4 }),
        );
      } else {
        if (!dot.current) {
          dot.current = new g.Marker({ map: m, position: pos, icon: meIcon(g, heading.current), zIndex: 999, clickable: false });
          ring.current = new g.Circle({
            map: m,
            center: pos,
            radius: 10,
            strokeWeight: 0,
            fillColor: ME,
            fillOpacity: 0.12,
            clickable: false,
          });
        } else {
          if (!dot.current.getMap()) {
            dot.current.setMap(m);
            ring.current.setMap(m);
          }
          dot.current.setPosition(pos);
          dot.current.setIcon(meIcon(g, heading.current));
          ring.current.setCenter(pos);
        }
        ring.current.setRadius(Math.max(5, Math.min(200, here?.accuracy ?? 10)));
        /* 2D 는 늘 평평하게 — 기울인 지도(지도 ID)를 같이 쓰므로 3D 에서 돌아오면
           기울기 · 방향이 남아 있습니다. */
        if (followRef.current) {
          m.moveCamera({ center: pos, tilt: 0, heading: 0 });
        }
      }

      /* 갈 곳 — 내 자리에서 거기까지 점선. 안내 띠는 0.5초에 한 번만 고칩니다. */
      if (toward.current) {
        toward.current.line.setPath([pos, { lat: target!.lat, lng: target!.lng }]);
      }
      if (target && nowMs - lastGuide > 500) {
        lastGuide = nowMs;
        const meters = distanceKm(pos, target) * 1000;
        const view = use3dRef.current ? (m.getHeading?.() ?? 0) : 0;
        setGuide({ meters, turn: (bearing(pos, target) - view + 360) % 360 });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ready, target, here?.accuracy]);

  /* 갈 곳 핀과 선. */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) {
      return;
    }
    const g = gmaps();
    toward.current?.pin.setMap(null);
    toward.current?.line.setMap(null);
    toward.current = null;
    setGuide(null);
    if (!target) {
      return;
    }
    toward.current = {
      pin: new g.Marker({
        map: m,
        position: { lat: target.lat, lng: target.lng },
        icon: { path: g.SymbolPath.CIRCLE, scale: 10, fillColor: target.color, fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
        title: target.name,
        zIndex: 50,
      }),
      line: new g.Polyline({
        map: m,
        path: [],
        strokeOpacity: 0,
        icons: [
          {
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: target.color, scale: 3 },
            offset: '0',
            repeat: '14px',
          },
        ],
        zIndex: 40,
      }),
    };
  }, [target, ready]);

  /* 동행자 — 위치를 알리고 있는 사람들. 이름 첫 글자 대신 고른 얼굴(이모지)을 답니다. */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) {
      return;
    }
    const g = gmaps();
    const keep = new Set((mates ?? []).map((p) => p.id));
    others.current.forEach((marker, id) => {
      if (!keep.has(id)) {
        marker.setMap(null);
        others.current.delete(id);
      }
    });
    (mates ?? []).forEach((p) => {
      const at = { lat: p.lat, lng: p.lng };
      const had = others.current.get(p.id);
      if (had) {
        had.setPosition(at);
        return;
      }
      others.current.set(
        p.id,
        new g.Marker({
          map: m,
          position: at,
          title: p.name,
          label: { text: p.face, fontSize: '16px' },
          icon: { path: g.SymbolPath.CIRCLE, scale: 15, fillColor: '#FFFFFF', fillOpacity: 1, strokeColor: Colors.accent, strokeWeight: 2 },
          zIndex: 100,
        }),
      );
    });
  }, [mates, ready]);

  function follow() {
    if (use3d) {
      journey.current?.follow();
    } else {
      followRef.current = true;
      setFollowing(true);
    }
  }

  return (
    <View style={styles.fill}>
      <div ref={box} style={{ width: '100%', height: '100%' }} />

      {!here ? (
        <View pointerEvents="none" style={styles.waiting}>
          <Caption tone="secondary">내 위치를 찾고 있어요</Caption>
        </View>
      ) : null}

      {target && guide ? (
        <View pointerEvents="none" style={[styles.guide, { bottom: bottomInset + Spacing.s3 }]}>
          <View style={{ transform: [{ rotate: `${guide.turn}deg` }] }}>
            <Icon name="arrow-up" size={20} tone="accent" />
          </View>
          <View style={styles.guideText}>
            <Caption tone="secondary">다음 · {target.name}</Caption>
            <Body small strong>
              {fmtDistance(guide.meters)}
              {guide.meters > 30 ? ` · 걸어서 ${Math.max(1, Math.round(guide.meters / 75))}분` : ' · 거의 다 왔어요'}
            </Body>
          </View>
        </View>
      ) : null}

      {/* 안내 띠가 서 있으면 그 위로 올립니다. */}
      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { bottom: bottomInset + (target && guide ? GUIDE_H + Spacing.s3 : 0) }]}>
        <FollowButton visible={!following && !!here} label="내 위치 따라가기" onPress={follow} />
      </View>
    </View>
  );
}

function fmtDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

/** 내 점 — 파란 동그라미에 가는 쪽을 가리키는 작은 삼각형. */
function meIcon(g: any, heading: number) {
  return {
    path: 'M 0,-14 L 5,-6 L -5,-6 Z M 0,-6 m -7,7 a 7,7 0 1,0 14,0 a 7,7 0 1,0 -14,0',
    fillColor: ME,
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 2,
    rotation: heading,
    scale: 1.1,
    anchor: new g.Point(0, 1),
  };
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  waiting: {
    position: 'absolute',
    top: Spacing.s5,
    alignSelf: 'center',
    paddingHorizontal: Spacing.s3,
    paddingVertical: Spacing.s2,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Elevation.float,
  },
  guide: {
    position: 'absolute',
    left: Spacing.s3,
    right: Spacing.s3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    paddingHorizontal: Spacing.s4,
    paddingVertical: Spacing.s3,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Elevation.float,
  },
  guideText: {
    flex: 1,
  },
});
