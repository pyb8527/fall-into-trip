import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MapPlace, TripMapProps } from '@/components/map-types';
import { QUIET_MAP } from '@/lib/map-style';
import { Colors, Radius, Spacing, Tap } from '@/constants/theme';
import { Badge, Body, Caption, Icon, IconButton, Row, Subtitle } from '@/ui';

/**
 * 지도 (앱).
 *
 * <p>안드로이드는 구글 지도, iOS 는 애플 지도를 씁니다. 웹은 이 파일 대신
 * trip-map.web.tsx 가 잡혀 구글 지도 JS API 로 그립니다.
 *
 * <p>핀은 그림 파일이 아니라 화면 요소로 그립니다. 날짜 색과 순번을 그대로
 * 얹을 수 있고, 크기를 바꿔도 뭉개지지 않습니다.
 */

/** 장소 하나를 고를 때 들여다볼 만큼. 웹 쪽 FOCUS_ZOOM 과 같은 눈금입니다. */
const FOCUS_SPAN = 0.006;

/** 여러 곳을 한 화면에 담을 때 가장자리에 두는 여유. */
const PAD = 1.35;

/**
 * 핀을 그림으로 굽는 동안 열어 두는 시간.
 *
 * 글꼴이 늦게 잡히는 기기까지 여유를 두되, 이 시간 동안은 핀마다 매 프레임
 * 다시 구우므로 길게 잡으면 지도가 무거워집니다.
 */
const DRAW_MS = 400;

/**
 * 별을 묶는 간격(화면 픽셀).
 *
 * 별 하나가 21픽셀이라 이보다 좁으면 서로 겹칩니다. 조금 넉넉하게 잡아야
 * 스쳐 지나가듯 붙은 것까지 묶입니다.
 */
const CLUMP_PX = 46;

/** 한자리에 몰려 하나로 묶인 별. */
type Clump = {
  key: string;
  lat: number;
  lng: number;
  color: string;
  members: MapPlace[];
};

/**
 * 묶인 별.
 *
 * <p>수가 많을수록 조금씩 키웁니다 — 세 개와 서른 개가 같은 크기면 묶였다는
 * 것만 알 뿐 얼마나 몰렸는지는 모릅니다. 다만 끝없이 커지지는 않게 막습니다.
 */
function ClumpPin({ color, count }: { color: string; count: number }) {
  const r = Math.min(38, 25 + Math.log10(count) * 12);
  return (
    <View
      style={[
        styles.chip,
        {
          width: r,
          height: r,
          borderRadius: r / 2,
          borderWidth: 2.2,
          borderColor: color,
          backgroundColor: '#FFFFFF',
        },
      ]}>
      <Body small strong style={{ color }}>
        {count}
      </Body>
    </View>
  );
}

export type { MapPlace } from '@/components/map-types';

/* here·mates·notes 는 앱에서 아직 채워지지 않습니다. 위치가 있어야 뜻이 있는
   값들인데 앱 GPS 가 다음 빌드에 열립니다. 위치 권한이 매니페스트에 박히는
   것이라 다음 빌드 때 열립니다(docs/design.md). 그때 showsUserLocation 을
   켜면 됩니다. */
export function TripMap({
  places,
  activeId,
  onSelect,
  routes,
  height = 300,
  chrome = true,
  bleed = false,
  link = true,
  fitAt,
  shape = 'default',
  panTo,
}: TripMapProps) {
  const map = useRef<MapView | null>(null);
  const [full, setFull] = useState(false);
  /* 전체화면에서 핀을 눌렀을 때 아래에 뜨는 카드. 목록의 선택과 따로 둡니다. */
  const [sheetId, setSheetId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  /* 지금 보고 있는 자리와 지도의 크기. 둘 다 있어야 "화면에서 몇 픽셀
     떨어졌나" 를 잴 수 있습니다. 별을 묶는 데만 씁니다. */
  const [view, setView] = useState<{ lat: number; lng: number; dLat: number; dLng: number } | null>(
    null,
  );
  const [size, setSize] = useState({ w: 0, h: 0 });

  /**
   * 처음 보여 줄 범위.
   *
   * 공항처럼 멀리 떨어진 곳(fit=false)은 뺍니다. 그것까지 넣으면 나머지가
   * 좁쌀만 해집니다.
   */
  const region = useMemo(() => {
    const core = places.filter((p) => p.fit);
    const target = core.length >= 2 ? core : places;
    if (target.length === 0) {
      return { latitude: 37.5665, longitude: 126.978, latitudeDelta: 0.2, longitudeDelta: 0.2 };
    }
    const lats = target.map((p) => p.lat);
    const lngs = target.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * PAD, FOCUS_SPAN),
      longitudeDelta: Math.max((maxLng - minLng) * PAD, FOCUS_SPAN),
    };
  }, [places]);

  /** 일정에 없는 자리로 옮깁니다. 꽂아 둔 깃발처럼 고를 id 가 없는 것들. */
  useEffect(() => {
    if (!panTo || !map.current) {
      return;
    }
    map.current.animateToRegion(
      {
        latitude: panTo.lat,
        longitude: panTo.lng,
        latitudeDelta: FOCUS_SPAN,
        longitudeDelta: FOCUS_SPAN,
      },
      300,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panTo?.at]);

  /** 넣어 둔 곳을 모두 한 화면에. 바깥에서 값을 바꿔 부릅니다. */
  useEffect(() => {
    if (!fitAt || !map.current || places.length === 0) {
      return;
    }
    map.current.fitToCoordinates(
      places.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitAt]);

  /** 받은 경로 중 그릴 수 있는 것만. */
  const drawn = useMemo(() => (routes ?? []).filter((r) => r.points.length > 1), [routes]);

  /** 실제 경로가 없을 때 같은 날끼리 이어 두는 선. */
  const hops = useMemo(() => {
    const byDay = new Map<number, MapPlace[]>();
    places.forEach((p) => {
      const list = byDay.get(p.dayIndex) ?? [];
      list.push(p);
      byDay.set(p.dayIndex, list);
    });
    return [...byDay.values()].filter((list) => list.length >= 2);
  }, [places]);

  /*
    장소 묶음이 실제로 바뀌었을 때만 화면을 다시 맞춥니다. 핀을 고르거나
    다녀옴을 켜는 것만으로 다시 맞추면 들여다보던 자리가 매번 튕겨 나갑니다.
  */
  const fitted = useRef('');
  useEffect(() => {
    const key = places.map((p) => `${p.id}@${p.lat},${p.lng}`).join('|');
    if (key === fitted.current || !map.current) {
      return;
    }
    fitted.current = key;
    map.current.animateToRegion(region, 350);
  }, [places, region]);

  /* 고른 장소로 옮기면서 들여다볼 만큼 당깁니다. */
  useEffect(() => {
    const chosen = places.find((p) => p.id === activeId);
    if (!chosen || !map.current) {
      return;
    }
    map.current.animateToRegion(
      {
        latitude: chosen.lat,
        longitude: chosen.lng,
        latitudeDelta: FOCUS_SPAN,
        longitudeDelta: FOCUS_SPAN,
      },
      350,
    );
  }, [activeId, places]);

  /*
    가까이 몰린 별을 하나로 묶습니다.

    보석함은 한 동네에 여남은 곳이 몰리는 일이 흔합니다. 그대로 찍으면 별이
    서로 덮여 몇 개가 있는지도 모릅니다. 화면에서 몇 픽셀 떨어져 있는지로
    묶으므로, 당기면 저절로 흩어지고 밀면 다시 뭉칩니다.

    묶는 것은 별 모양일 때뿐입니다. 일정의 물방울 핀은 번호가 순서를 말해
    주는 것이라 묶으면 그 순서가 사라집니다.
  */
  const { loners, clumps } = useMemo(() => {
    const none = { loners: places, clumps: [] as Clump[] };
    if (shape !== 'star' || !view || size.w === 0 || size.h === 0) {
      return none;
    }

    /* 한 칸의 크기를 각도로 환산합니다. 배율이 낮을수록(멀리 볼수록) 같은
       46픽셀이 더 넓은 땅을 덮으므로, 자연히 더 많이 묶입니다. */
    const cellLng = (view.dLng / size.w) * CLUMP_PX;
    const cellLat = (view.dLat / size.h) * CLUMP_PX;
    if (!(cellLng > 0) || !(cellLat > 0)) {
      return none;
    }

    const bins = new Map<string, MapPlace[]>();
    places.forEach((p) => {
      /* 고른 것은 묶지 않습니다. 눌러서 고른 별이 숫자 뒤로 사라지면 어디를
         골랐는지 알 수 없습니다. */
      if (p.id === activeId) {
        return;
      }
      const key = `${Math.floor(p.lng / cellLng)}:${Math.floor(p.lat / cellLat)}`;
      const bin = bins.get(key) ?? [];
      bin.push(p);
      bins.set(key, bin);
    });

    const loners: MapPlace[] = places.filter((p) => p.id === activeId);
    const clumps: Clump[] = [];
    bins.forEach((bin, key) => {
      if (bin.length < 2) {
        loners.push(...bin);
        return;
      }
      clumps.push({
        key,
        lat: bin.reduce((n, p) => n + p.lat, 0) / bin.length,
        lng: bin.reduce((n, p) => n + p.lng, 0) / bin.length,
        color: bin[0].color,
        members: bin,
      });
    });
    return { loners, clumps };
  }, [places, activeId, shape, view, size]);

  /** 묶음을 누르면 그 안이 다 보일 만큼 당깁니다. */
  const spread = useCallback((group: Clump) => {
    const lats = group.members.map((p) => p.lat);
    const lngs = group.members.map((p) => p.lng);
    map.current?.animateToRegion(
      {
        latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
        longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
        latitudeDelta: Math.max((Math.max(...lats) - Math.min(...lats)) * PAD, FOCUS_SPAN),
        longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * PAD, FOCUS_SPAN),
      },
      350,
    );
  }, []);

  const pick = useCallback(
    (id: string) => {
      onSelect(id);
      setSheetId(id);
    },
    [onSelect],
  );

  const body = (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      /* 안드로이드는 구글 지도로 통일합니다. 기기마다 다른 지도가 뜨면
         같은 화면을 설명하기 어렵습니다. iOS 는 애플 지도를 그대로 씁니다. */
      provider={PROVIDER_GOOGLE}
      /* 구글은 기기가 어두운 테마면 지도도 어둡게 칠합니다. 웹에는 그런 동작이
         없어 같은 화면이 둘로 갈립니다. 밝은 쪽으로 못박습니다. 이 값은 지도를
         만들 때 한 번만 읽히므로 첫 그림부터 넘겨야 합니다. */
      userInterfaceStyle="light"
      /* 웹과 같은 값을 씁니다. 둘이 갈리면 같은 여행을 폰과 브라우저에서 볼 때
         다른 지도가 됩니다. iOS 는 애플 지도라 이 값이 먹지 않습니다. */
      customMapStyle={QUIET_MAP as unknown as never[]}
      initialRegion={region}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
      /* 손을 뗀 뒤에만 다시 셉니다. 끄는 동안 매 프레임 다시 묶으면 별이
         깜빡입니다. */
      onRegionChangeComplete={(r) =>
        setView({
          lat: r.latitude,
          lng: r.longitude,
          dLat: r.latitudeDelta,
          dLng: r.longitudeDelta,
        })
      }>
      {/*
        실제 경로를 받았으면 그것을 그립니다. 없을 때만 장소끼리 잇습니다.
        그 선은 "이 순서로 간다" 는 뜻일 뿐 지나는 길이 아니므로, 실제 길과
        헷갈리지 않게 점선으로 둡니다.
      */}
      {drawn.length === 0 && !link ? null : drawn.length > 0
        ? drawn.map((line) => (
            <Polyline
              key={line.id}
              coordinates={line.points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
              strokeColor={line.color}
              strokeWidth={4}
            />
          ))
        : hops.map((list) => (
            <Polyline
              key={`hop-${list[0].dayIndex}`}
              coordinates={list.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
              strokeColor={list[0].color}
              strokeWidth={3}
              lineDashPattern={[6, 8]}
            />
          ))}

      {places.map((p) =>
        p.radius ? (
          <Circle
            key={`circle-${p.id}`}
            center={{ latitude: p.lat, longitude: p.lng }}
            radius={p.radius}
            strokeColor={p.color}
            fillColor={`${p.color}14`}
            strokeWidth={1.5}
          />
        ) : null,
      )}

      {clumps.map((group) => (
        <Marker
          key={group.key}
          coordinate={{ latitude: group.lat, longitude: group.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          onPress={() => spread(group)}>
          <ClumpPin color={group.color} count={group.members.length} />
        </Marker>
      ))}

      {loners.map((p) => (
        <PlacePin
          key={p.id}
          place={p}
          active={p.id === activeId}
          shape={shape}
          onPress={pick}
        />
      ))}
    </MapView>
  );

  const chosen = full && sheetId ? (places.find((p) => p.id === sheetId) ?? null) : null;

  return (
    <>
      <View style={[styles.frame, bleed ? styles.frameBleed : { height }]}>
        {full ? null : body}
        {full || !chrome ? null : (
          <View style={styles.overlay}>
            <IconButton name="maximize" label="전체화면으로 보기" onPress={() => setFull(true)} />
          </View>
        )}
      </View>

      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)}>
        <View style={styles.fullWrap}>
          {full ? body : null}
          <View style={[styles.overlay, { top: insets.top + Spacing.md }]}>
            <IconButton
              name="minimize"
              label="전체화면 닫기"
              onPress={() => {
                setFull(false);
                setSheetId(null);
              }}
            />
          </View>
          {chosen ? (
            <PlaceSheet
              place={chosen}
              bottom={insets.bottom}
              onClose={() => setSheetId(null)}
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

/**
 * 핀 하나.
 *
 * <p>지도는 화면 요소로 만든 핀을 그림 한 장으로 구워 얹습니다. 언제 구울지는
 * tracksViewChanges 가 정합니다. 계속 켜 두면 핀 수만큼 매 프레임 다시 구워
 * 지도가 버벅이고, 처음부터 꺼 두면 아직 자리도 못 잡은 빈 그림이 구워져
 * 핀이 반쪽으로 나옵니다. 그래서 잠깐 켰다 끕니다.
 *
 * <p>고른 핀은 커지므로 그때도 다시 구워야 합니다.
 */
function PlacePin({
  place,
  active,
  shape,
  onPress,
}: {
  place: MapPlace;
  active: boolean;
  shape: 'default' | 'star';
  onPress: (id: string) => void;
}) {
  const [drawing, setDrawing] = useState(true);

  useEffect(() => {
    setDrawing(true);
    const timer = setTimeout(() => setDrawing(false), DRAW_MS);
    return () => clearTimeout(timer);
  }, [active, place.color, place.order, place.detail.visited]);

  return (
    <Marker
      coordinate={{ latitude: place.lat, longitude: place.lng }}
      title={place.name}
      onPress={() => onPress(place.id)}
      tracksViewChanges={drawing}
      /* 물방울은 아래 뾰족한 끝이 좌표를 가리키고, 동그란 그림 판은 한가운데가
         좌표에 얹힙니다. */
      anchor={place.emoji || shape === 'star' ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 }}>
      <Pin place={place} active={active} shape={shape} />
    </Marker>
  );
}

/**
 * 핀 모양.
 *
 * <p>웹은 SVG 로 물방울을 그립니다. 여기서는 SVG 를 쓸 수 없어, 정사각형의
 * 네 귀퉁이 중 하나만 깎지 않고 둥글린 뒤 45도 돌려 같은 모양을 만듭니다.
 * 남겨 둔 귀퉁이가 아래를 가리키는 끝이 됩니다.
 *
 * <p>돌린 각도는 안에 든 숫자에도 그대로 옮겨붙으므로, 숫자는 돌아가지 않는
 * 층에 따로 얹습니다.
 */
function Pin({
  place,
  active,
  shape,
}: {
  place: MapPlace;
  active: boolean;
  shape: 'default' | 'star';
}) {
  const visited = place.detail.visited;

  /*
    보석함처럼 순서도 갈래도 앞세울 것이 없는 자리.

    전부 같은 동그라미에 별 하나입니다. 어디에 얼마나 담겼는지만 보이면
    되므로, 그림도 번호도 얹지 않습니다.

    별은 이모지가 아니라 글자표(U+2605)입니다. 이모지는 기기마다 다르게
    생기지만 이것은 어디서나 같은 별입니다.
  */
  if (shape === 'star') {
    /* 담아 둔 곳은 한 동네에 여남은 개가 몰립니다. 장소 핀만큼 키우면 서로
       덮어 몇 개가 있는지도 안 보입니다. 고른 것만 눈에 띄게 둡니다. */
    const r = active ? 27 : 21;
    return (
      <View
        style={[
          styles.chip,
          {
            width: r,
            height: r,
            borderRadius: r / 2,
            borderWidth: active ? 3 : 2.4,
            borderColor: place.color,
            backgroundColor: '#FFFFFF',
            elevation: active ? 6 : 3,
            shadowOpacity: active ? 0.32 : 0.2,
          },
        ]}>
        {/* 앱에서는 아직 선으로 그린 별을 못 씁니다 — SVG 를 쓰려면 앱을
            다시 빌드해야 합니다(docs/design.md). 그때까지는 글자표로 둡니다. */}
        <Body small strong style={{ color: place.color }}>
          ★
        </Body>
      </View>
    );
  }

  /*
    그림이 있으면 그림만 찍습니다.

    물방울을 씌우고 그 안 흰 원에 그림을 넣었더니 열 몇 픽셀로 쪼그라들어
    무엇인지 알아볼 수 없었습니다. 라멘인지 온천인지가 보이라고 넣은 것이
    안 보이면 넣은 뜻이 없습니다. 대신 동그란 판을 깔아 지도의 건물·글자에서
    떼어 놓습니다.
  */
  if (place.emoji) {
    const r = active ? 34 : 29;
    return (
      <View
        style={[
          styles.chip,
          {
            width: r,
            height: r,
            borderRadius: r / 2,
            borderWidth: active ? 3 : 2.4,
            borderColor: place.color,
            backgroundColor: visited ? place.color : '#FFFFFF',
            elevation: active ? 6 : 3,
            shadowOpacity: active ? 0.32 : 0.2,
          },
        ]}>
        <Body style={[styles.pinEmoji, { fontSize: active ? 20 : 17 }]}>{place.emoji}</Body>
      </View>
    );
  }

  const size = active ? 36 : 30;
  const border = active ? 3 : 2.5;
  /* 45도 돌리면 대각선이 가로가 됩니다. 잘리지 않게 그만큼 자리를 잡아 둡니다. */
  const box = Math.ceil(size * 1.42);
  /* 방울 한가운데에서 아래 끝까지. 이 끝이 좌표에 닿습니다. */
  const tall = Math.ceil(size * 1.21);
  const dot = Math.round(size * 0.58);

  return (
    <View style={{ width: box, height: tall }}>
      <View
        style={[
          styles.pin,
          {
            width: size,
            height: size,
            left: (box - size) / 2,
            borderRadius: size / 2,
            borderBottomRightRadius: 2,
            backgroundColor: place.color,
            borderWidth: border,
            /* 고른 것을 조금 더 띄웁니다. */
            elevation: active ? 6 : 3,
            shadowOpacity: active ? 0.32 : 0.2,
          },
        ]}
      />
      <View style={[styles.pinFace, { height: size, width: box }]}>
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              /* 다녀온 곳은 속을 날짜 색으로 채우고, 아직인 곳은 희게 비워
                 둡니다. 지도가 채워지는 체크리스트처럼 읽힙니다. */
              backgroundColor: visited ? place.color : '#FFFFFF',
            },
          ]}>
          <Body small strong style={{ color: visited ? Colors.onDay : Colors.text }}>
            {place.order}
          </Body>
        </View>
      </View>
    </View>
  );
}

/** 전체화면에서 핀을 눌렀을 때 아래에서 올라오는 카드. */
function PlaceSheet({
  place,
  bottom,
  onClose,
}: {
  place: MapPlace;
  bottom: number;
  onClose: () => void;
}) {
  const d = place.detail;
  return (
    <View style={[styles.sheet, { paddingBottom: bottom + Spacing.xl }]}>
      <View style={styles.grip} />
      <Row style={styles.sheetHead}>
        <Row gap={Spacing.sm} style={styles.sheetTitle}>
          <View style={[styles.order, { backgroundColor: place.color }]}>
            <Body small strong style={styles.pinText}>
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
        style={({ pressed }) => [styles.sheetClose, pressed && styles.sheetClosePressed]}>
        <Body small strong tone="secondary">
          닫기
        </Body>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.abyss,
  },
  /* 지도가 화면을 꽉 채울 때. 모서리를 둥글리면 그 틈으로 바탕이 비칩니다. */
  frameBleed: {
    flex: 1,
    borderRadius: 0,
  },
  fullWrap: {
    flex: 1,
    backgroundColor: Colors.abyss,
  },
  overlay: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },

  pin: {
    position: 'absolute',
    top: 0,
    borderColor: '#FFFFFF',
    /* 남겨 둔 귀퉁이가 아래를 향하도록 돌립니다. */
    transform: [{ rotate: '45deg' }],
    shadowColor: '#191F28',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
  },
  /* 돌아간 방울 위에 얹는, 돌아가지 않는 층. */
  pinFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 그림 핀. 물방울이 아니라 동그란 판이라 좌표 한가운데에 얹힙니다. */
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
  },
  pinEmoji: {
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  pinText: {
    color: '#FFFFFF',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
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
  sheetClose: {
    minHeight: Tap.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.fill,
  },
  sheetClosePressed: {
    backgroundColor: Colors.fillPressed,
  },
});
