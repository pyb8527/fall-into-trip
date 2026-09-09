import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MapPlace, TripMapProps } from '@/components/map-types';
import { gmaps, hasMaps, loadMaps } from '@/lib/gmaps.web';
import { QUIET_MAP } from '@/lib/map-style';
import { Colors, Radius, Spacing, Tap } from '@/constants/theme';
import { Badge, Body, Caption, IconButton, Row, Subtitle } from '@/ui';

/**
 * 지도 (웹).
 *
 * <p>구글 지도 JS API 로 그립니다. 앱(iOS·Android)에서는 이 파일 대신
 * trip-map.tsx 가 잡힙니다.
 *
 * <p>키(EXPO_PUBLIC_GMAPS_KEY)가 없으면 아무것도 그리지 않고 빠집니다.
 * 자리만 남겨 두거나 오류를 띄우면, 쓰는 사람은 자기가 뭘 잘못한 줄 압니다.
 *
 * <p>전체화면은 브라우저가 주는 것을 그대로 씁니다. 지도 div 를 다른 곳으로
 * 옮기거나 position:fixed 로 덮으면, 스크롤 컨테이너가 만든 쌓임 문맥에 갇혀
 * 뒤 내용이 지도 위로 올라옵니다.
 */

export type { MapPlace } from '@/components/map-types';

/**
 * 장소 하나를 고를 때 들어가는 확대 정도.
 *
 * 골목과 건물 이름이 보이기 시작하는 눈금입니다. 이미 이보다 더 당겨 놓았다면
 * 건드리지 않습니다 — 들여다보던 것을 뒤로 물리면 성가십니다.
 */
const FOCUS_ZOOM = 16;

/**
 * 핀 그림.
 *
 * <p>물방울 안에 흰 원, 그 안에 그림(없으면 번호). 그림은 SVG 안에 글자로
 * 넣지 않고 구글 지도의 <b>라벨</b>로 얹습니다. SVG 를 그림 파일처럼 그릴
 * 때는 이모지 글꼴이 딸려 오지 않는 브라우저가 있어, 라멘 대신 네모가
 * 뜨는 일이 생깁니다.
 *
 * <p>다녀온 곳은 물방울 속을 날짜 색으로 채우고, 아직인 곳은 어둡게 비워
 * 둡니다. 지도가 체크리스트처럼 읽혀, 채워질수록 얼마나 돌았는지가 한눈에
 * 보입니다.
 *
 * <p>안 간 곳을 잿빛으로 만들지는 않았습니다. 여행 전에는 아무 데도 안 갔으니
 * 지도가 통째로 잿빛이 됩니다. 채워지는 쪽으로 달라지게 하는 편이 두 시기에
 * 모두 맞습니다.
 */
function pinIcon(color: string, active: boolean, visited: boolean) {
  const stroke = active ? 3.4 : 2.6;
  /* 흰 테두리가 지도의 길·건물에서 핀을 떼어 놓습니다. */
  const rim = '#FFFFFF';
  const face = visited ? color : '#FFFFFF';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">
<path d="M20 4C11.7 4 5 10.7 5 19c0 10.7 13.3 27 13.9 27.7a1.4 1.4 0 0 0 2.2 0C21.7 46 35 29.7 35 19 35 10.7 28.3 4 20 4z"
 fill="${color}" stroke="${rim}" stroke-width="${stroke}"/>
<circle cx="20" cy="19" r="9" fill="${face}"/>
</svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

/**
 * 핀 위에 얹는 글자.
 *
 * <p>그림이 있으면 그림을, 없으면 번호를 얹습니다. 그림이 있을 때 번호가
 * 사라지는 것은 감수합니다 — 둘 다 넣으면 열두 픽셀 안에 두 가지를 우겨넣는
 * 셈이라 어느 쪽도 안 읽힙니다. 순서는 아래 목록이 말해 줍니다.
 */
function pinLabel(place: MapPlace, visited: boolean) {
  if (place.emoji) {
    return { text: place.emoji, fontSize: '13px' };
  }
  /* 날짜 색이 파스텔이라 그것으로 번호를 쓰면 흰 방울 안에서 읽히지
     않습니다. 색은 방울이 맡고 번호는 늘 짙게 씁니다. */
  return {
    text: String(place.order),
    color: Colors.onDay,
    fontSize: '11px',
    fontWeight: '700',
  };
}

export function TripMap({
  places,
  activeId,
  onSelect,
  routes,
  here,
  mates,
  notes,
  height = 300,
  chrome = true,
  bleed = false,
}: TripMapProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);
  /* 전체화면에서 핀을 눌렀을 때 아래에 뜨는 카드. 목록의 선택과 따로 둡니다 —
     카드를 닫았다고 목록 선택까지 풀 이유는 없습니다. */
  const [sheetId, setSheetId] = useState<string | null>(null);

  const wrap = useRef<HTMLDivElement | null>(null);
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const circles = useRef<any[]>([]);
  const lines = useRef<any[]>([]);

  /**
   * 마지막으로 화면을 맞춘 장소 묶음.
   *
   * 핀을 고르는 것만으로 화면이 다시 맞춰지면(축소되면) 보던 자리를 잃습니다.
   * 장소가 실제로 바뀌었을 때만 맞춥니다.
   */
  const fitted = useRef('');

  /* 콜백이 매번 새로 만들어져도 마커를 다시 그리지 않도록 최신 것만 담아 둡니다. */
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!hasMaps()) {
      return;
    }
    let alive = true;
    loadMaps()
      .then(() => {
        if (!alive || !host.current) {
          return;
        }
        map.current = new (gmaps().Map)(host.current, {
          center: { lat: 37.5665, lng: 126.978 },
          zoom: 12,
          /* 조용한 지도. 땅·물·길만 겨우 구별되게 눌러 두어, 그 위에 얹히는
             우리 핀과 동선이 화면에서 가장 진한 것이 됩니다. */
          styles: QUIET_MAP as unknown as unknown[],
          backgroundColor: Colors.abyss,
          disableDefaultUI: true,
          /* 확대·축소 단추는 두지 않습니다. 손가락으로 벌리고 오므리는 것이
             더 빠르고, 그 자리를 내 위치 단추에 씁니다. */
          zoomControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          maxZoom: 18,
        });
        /* 첫 배치가 늦게 잡히는 기기를 위해 한 박자 뒤 한 번 더 재게 합니다. */
        gmaps().event.addListenerOnce(map.current, 'idle', () => {
          gmaps().event.trigger(map.current, 'resize');
        });
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          setFailed(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  /*
    지도가 붙은 자리의 크기가 바뀌면 다시 재라고 알려 줍니다.

    지도는 만들어질 때의 크기를 기억합니다. 그때 자리가 아직 0 이면 타일을
    한 장도 그리지 않고, 나중에 자리가 생겨도 스스로는 알아채지 못합니다.
    폰에서는 글꼴·안전영역 때문에 첫 배치가 한 박자 늦게 잡혀 이 일이
    자주 생깁니다. 회전이나 주소창이 접힐 때도 마찬가지입니다.
  */
  useEffect(() => {
    if (!ready || !host.current || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!map.current) {
        return;
      }
      const center = map.current.getCenter();
      gmaps().event.trigger(map.current, 'resize');
      if (center) {
        map.current.setCenter(center);
      }
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [ready]);

  /* 브라우저가 알려 주는 전체화면 상태를 따라갑니다. ESC 로 빠져나가는 것도
     여기로 들어옵니다. 크기가 바뀌었으니 지도에 다시 재라고 알려 줍니다. */
  useEffect(() => {
    const onChange = () => {
      const isFull = document.fullscreenElement === wrap.current;
      setFull(isFull);
      if (!isFull) {
        setSheetId(null);
      }
      if (map.current) {
        const center = map.current.getCenter();
        gmaps().event.trigger(map.current, 'resize');
        if (center) {
          map.current.setCenter(center);
        }
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        /* 브라우저가 거절하면 그대로 둡니다. */
      });
    } else {
      wrap.current?.requestFullscreen().catch(() => {
        /* 전체화면을 막아 둔 환경이면 그냥 지금 크기로 씁니다. */
      });
    }
  }, []);

  /* 장소가 바뀌면 마커·원·동선을 통째로 다시 만듭니다. 몇십 개 수준이라
     하나씩 맞춰 고치는 것보다 지우고 다시 그리는 편이 단순하고 안전합니다. */
  /*
    지금 내 자리.

    장소 핀과 따로 그립니다. 장소가 바뀔 때마다 위치까지 다시 그리면 걸어
    다니는 동안 화면이 쉴 새 없이 깜빡입니다.
  */
  const meDot = useRef<any>(null);
  const meRing = useRef<any>(null);

  useEffect(() => {
    if (!ready || !map.current) {
      return;
    }
    const g = gmaps();

    if (!here) {
      meDot.current?.setMap(null);
      meRing.current?.setMap(null);
      meDot.current = null;
      meRing.current = null;
      return;
    }

    const at = { lat: here.lat, lng: here.lng };
    if (meDot.current) {
      meDot.current.setPosition(at);
      meRing.current.setCenter(at);
      meRing.current.setRadius(here.accuracy);
      return;
    }

    /* 바깥 원은 "이 안쪽 어딘가" 라는 뜻입니다. 실내나 지하에서는 꽤 큽니다. */
    meRing.current = new g.Circle({
      center: at,
      radius: here.accuracy,
      map: map.current,
      strokeColor: Colors.accentInk,
      strokeOpacity: 0.35,
      strokeWeight: 1,
      fillColor: Colors.accentInk,
      fillOpacity: 0.08,
      zIndex: 1,
    });
    meDot.current = new g.Marker({
      position: at,
      map: map.current,
      zIndex: 999,
      title: '지금 내 위치',
      icon: {
        path: g.SymbolPath.CIRCLE,
        scale: 7,
        /* 내 자리는 점 하나뿐이라 파스텔로 찍으면 밝은 지도에 묻힙니다.
           같은 계열에서 짙은 쪽으로 찍습니다. */
        fillColor: Colors.accentInk,
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2.5,
      },
    });
  }, [ready, here]);

  useEffect(() => {
    if (!ready || !map.current) {
      return;
    }
    const g = gmaps();

    markers.current.forEach((m) => m.setMap(null));
    markers.current.clear();
    circles.current.forEach((c) => c.setMap(null));
    circles.current = [];
    lines.current.forEach((l) => l.setMap(null));
    lines.current = [];

    places.forEach((p) => {
      const marker = new g.Marker({
        position: { lat: p.lat, lng: p.lng },
        title: p.name,
        map: map.current,
        zIndex: 100 + p.order,
        icon: {
          url: pinIcon(p.color, false, p.detail.visited),
          scaledSize: new g.Size(40, 49),
          anchor: new g.Point(20, 49),
          /* 글자를 물방울 한가운데 원에 맞춥니다. 안 맞추면 핀 아래
             꼬리 쪽에 찍힙니다. */
          labelOrigin: new g.Point(20, 17),
        },
        label: pinLabel(p, p.detail.visited),
      });
      marker.addListener('click', () => {
        selectRef.current(p.id);
        setSheetId(p.id);
      });
      markers.current.set(p.id, marker);

      if (p.radius) {
        circles.current.push(
          new g.Circle({
            center: { lat: p.lat, lng: p.lng },
            radius: p.radius,
            map: map.current,
            strokeColor: p.color,
            strokeOpacity: 0.3,
            strokeWeight: 1.5,
            fillColor: p.color,
            fillOpacity: 0.07,
            clickable: false,
            zIndex: 1,
          }),
        );
      }
    });

    /*
      실제 경로를 받았으면 그것을 그리고 끝냅니다. 아래 점선은 "이 순서로
      간다" 는 뜻일 뿐 지나는 길이 아니라, 둘을 겹쳐 그리면 어느 쪽이 진짜
      길인지 알 수 없게 됩니다.
    */
    const drawn = (routes ?? []).filter((r) => r.points.length > 1);
    if (drawn.length > 0) {
      drawn.forEach((line) => {
        lines.current.push(
          new g.Polyline({
            path: line.points,
            map: map.current,
            strokeColor: line.color,
            strokeOpacity: 0.9,
            strokeWeight: 4,
            zIndex: 2,
          }),
        );
      });
    } else {

      /* 실제 경로가 없을 때만 같은 날끼리 잇습니다. 점선으로 둬야 도로와
         헷갈리지 않습니다. */
      const byDay = new Map<number, MapPlace[]>();
      places.forEach((p) => {
        const list = byDay.get(p.dayIndex) ?? [];
        list.push(p);
        byDay.set(p.dayIndex, list);
      });
      byDay.forEach((list) => {
        if (list.length < 2) {
          return;
        }
        lines.current.push(
          new g.Polyline({
            path: list.map((p) => ({ lat: p.lat, lng: p.lng })),
            map: map.current,
            strokeOpacity: 0,
            zIndex: 2,
            icons: [
              {
                icon: {
                  path: 'M 0,-1 0,1',
                  strokeColor: list[0].color,
                  strokeOpacity: 0.85,
                  strokeWeight: 2.4,
                  scale: 3,
                },
                offset: '0',
                repeat: '13px',
              },
            ],
          }),
        );
      });
    }

    /*
      보이는 곳이 모두 들어오게 맞춥니다.

      단, 장소 묶음이 실제로 바뀌었을 때만입니다. 핀을 고르거나 다녀옴을
      켜는 것만으로 다시 맞추면, 들여다보던 자리가 매번 축소되어 튕겨
      나갑니다. 공항처럼 멀리 떨어진 곳은 빼야 나머지가 좁쌀만 해지지 않습니다.
    */
    const key = places.map((p) => `${p.id}@${p.lat},${p.lng}`).join('|');
    if (key === fitted.current) {
      return;
    }
    fitted.current = key;

    const core = places.filter((p) => p.fit);
    const target = core.length >= 2 ? core : places;
    if (target.length === 1) {
      map.current.setCenter({ lat: target[0].lat, lng: target[0].lng });
      map.current.setZoom(15);
    } else if (target.length > 1) {
      const bounds = new g.LatLngBounds();
      target.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.current.fitBounds(bounds, { top: 48, right: 40, bottom: 40, left: 40 });
    }
  }, [ready, places, routes]);

  /*
    동행자와 임시 핀.

    장소 핀과 따로 그립니다. 일정에 넣어 둔 곳과 "지금 저기 있다" 는 성격이
    다른데, 같은 모양으로 두면 지도만 보고는 구별이 안 됩니다.
  */
  const mateMarks = useRef<any[]>([]);

  useEffect(() => {
    if (!ready || !map.current) {
      return;
    }
    const g = gmaps();
    mateMarks.current.forEach((m) => m.setMap(null));
    mateMarks.current = [];

    for (const mate of mates ?? []) {
      mateMarks.current.push(
        new g.Marker({
          position: { lat: mate.lat, lng: mate.lng },
          map: map.current,
          title: `${mate.name} 님이 지금 있는 곳`,
          zIndex: 800,
          label: { text: mate.name.slice(0, 1), color: '#FFFFFF', fontSize: '11px', fontWeight: '700' },
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: Colors.success,
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2.5,
          },
        }),
      );
    }

    for (const note of notes ?? []) {
      mateMarks.current.push(
        new g.Marker({
          position: { lat: note.lat, lng: note.lng },
          map: map.current,
          title: note.label ?? '잠깐 꽂아 둔 곳',
          zIndex: 700,
          /* 네모로 둡니다. 동그란 것은 사람, 물방울은 일정입니다. */
          icon: {
            path: 'M -7 -7 L 7 -7 L 7 7 L -7 7 Z',
            fillColor: Colors.warning,
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
        }),
      );
    }
  }, [ready, mates, notes]);

  /** 내가 있는 자리로 지도를 옮깁니다. 어디까지 갔는지 놓쳤을 때 쓰는 단추입니다. */
  const goHere = useCallback(() => {
    if (!map.current || !here) {
      return;
    }
    map.current.panTo({ lat: here.lat, lng: here.lng });
    /* 이미 가까이 보고 있으면 그대로 둡니다. 누를 때마다 확대되면 답답합니다. */
    if ((map.current.getZoom() ?? 0) < 15) {
      map.current.setZoom(16);
    }
  }, [here]);

  /* 고른 장소를 크게 하고, 그 자리로 옮기면서 들여다볼 만큼 당깁니다. */
  useEffect(() => {
    if (!ready) {
      return;
    }
    const g = gmaps();
    places.forEach((p) => {
      const marker = markers.current.get(p.id);
      if (!marker) {
        return;
      }
      const active = p.id === activeId;
      marker.setIcon({
        url: pinIcon(p.color, active, p.detail.visited),
        scaledSize: new g.Size(active ? 50 : 40, active ? 61 : 49),
        anchor: new g.Point(active ? 25 : 20, active ? 61 : 49),
        labelOrigin: new g.Point(active ? 25 : 20, active ? 21 : 17),
      });
      marker.setLabel(pinLabel(p, p.detail.visited));
      marker.setZIndex(active ? 999 : 100 + p.order);
    });
    const chosen = places.find((p) => p.id === activeId);
    if (chosen && map.current) {
      map.current.panTo({ lat: chosen.lat, lng: chosen.lng });
      if ((map.current.getZoom() ?? 0) < FOCUS_ZOOM) {
        map.current.setZoom(FOCUS_ZOOM);
      }
    }
  }, [ready, activeId, places]);

  /*
    키가 없거나 스크립트를 못 받아 왔을 때.

    작은 자리에 얹혀 있을 때는 아예 비웁니다 — 빈 회색 판이나 오류를 띄우면
    쓰는 사람은 자기가 뭘 잘못한 줄 압니다.

    다만 지도가 화면을 통째로 채우는 자리(일정 화면)에서는 그럴 수 없습니다.
    화면 절반이 비어 있으면 그것이야말로 고장으로 보입니다. 거기서는
    한 줄만 조용히 남깁니다.

    훅을 모두 부른 뒤에 빠집니다. 위에서 빠지면 부르는 훅의 수가 렌더마다
    달라져, 스크립트를 못 받은 순간 지도가 아니라 화면 전체가 무너집니다.
  */
  if (!hasMaps() || failed) {
    if (!bleed) {
      return null;
    }
    return (
      <View style={styles.blank}>
        <Caption tone="muted">지도를 불러오지 못했습니다. 아래 일정은 그대로 볼 수 있습니다.</Caption>
      </View>
    );
  }

  const chosen = full && sheetId ? (places.find((p) => p.id === sheetId) ?? null) : null;

  return (
    <div
      ref={wrap}
      style={{
        position: 'relative',
        width: '100%',
        height: full || bleed ? '100%' : height,
        borderRadius: full || bleed ? 0 : Radius.lg,
        overflow: 'hidden',
        backgroundColor: Colors.abyss,
      }}>
      <div ref={host} style={{ width: '100%', height: '100%' }} />

      {/* 글자 대신 모양으로 둡니다. 앱 쪽과 같아야 같은 화면으로 읽힙니다. */}
      {chrome ? (
        <View style={styles.overlay}>
          {here ? <IconButton name="crosshair" label="내 위치로" onPress={goHere} /> : null}
          <IconButton
            name={full ? 'minimize' : 'maximize'}
            label={full ? '전체화면 닫기' : '전체화면으로 보기'}
            onPress={toggleFull}
          />
        </View>
      ) : null}

      {chosen ? <PlaceSheet place={chosen} onClose={() => setSheetId(null)} /> : null}
    </div>
  );
}

/**
 * 전체화면에서 핀을 눌렀을 때 아래에서 올라오는 카드.
 *
 * 지도를 덜 가리도록 아래쪽만, 내용만큼만 차지합니다.
 */
function PlaceSheet({ place, onClose }: { place: MapPlace; onClose: () => void }) {
  const d = place.detail;
  return (
    <View style={styles.sheet}>
      <View style={styles.grip} />

      <Row style={styles.sheetHead}>
        <Row gap={Spacing.sm} style={styles.sheetTitle}>
          <View style={[styles.order, { backgroundColor: place.color }]}>
            <Body small strong style={styles.orderText}>
              {place.order}
            </Body>
          </View>
          <Subtitle>{place.name}</Subtitle>
        </Row>
        {d.visited ? <Badge label="다녀옴" tone="success" /> : null}
      </Row>

      {d.sub ? <Caption>{d.sub}</Caption> : null}

      <Row gap={Spacing.sm}>
        <Badge label={d.dayLabel} tone="muted" />
        {d.time ? (
          <Caption tone="accent" strong>
            {d.time}
          </Caption>
        ) : null}
        {d.cat ? <Caption>{d.cat}</Caption> : null}
        {d.cost ? <Caption>{d.cost}</Caption> : null}
      </Row>

      {d.note ? (
        <Body small tone="secondary">
          {d.note}
        </Body>
      ) : null}

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        style={({ pressed }) => [styles.sheetClose, pressed && styles.chipPressed]}>
        <Body small strong tone="secondary">
          닫기
        </Body>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.abyss,
  },
  overlay: {
    flexDirection: 'row',
    gap: Spacing.xs,
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    /* 지도가 만든 층 위로 올려야 눌립니다. */
    zIndex: 2,
  },
  chip: {
    minHeight: Tap.min,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  chipPressed: {
    backgroundColor: Colors.fill,
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.fillPressed,
    marginBottom: Spacing.sm,
  },
  sheetHead: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  sheetTitle: {
    flexShrink: 1,
    alignItems: 'center',
  },
  order: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    color: '#FFFFFF',
  },
  sheetClose: {
    minHeight: Tap.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.fill,
  },
});
