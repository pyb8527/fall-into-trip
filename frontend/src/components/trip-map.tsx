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
}: TripMapProps) {
  const map = useRef<MapView | null>(null);
  const [full, setFull] = useState(false);
  /* 전체화면에서 핀을 눌렀을 때 아래에 뜨는 카드. 목록의 선택과 따로 둡니다. */
  const [sheetId, setSheetId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

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
      moveOnMarkerPress={false}>
      {/*
        실제 경로를 받았으면 그것을 그립니다. 없을 때만 장소끼리 잇습니다.
        그 선은 "이 순서로 간다" 는 뜻일 뿐 지나는 길이 아니므로, 실제 길과
        헷갈리지 않게 점선으로 둡니다.
      */}
      {drawn.length > 0
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

      {places.map((p) => (
        <PlacePin key={p.id} place={p} active={p.id === activeId} onPress={pick} />
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
  onPress,
}: {
  place: MapPlace;
  active: boolean;
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
      /* 물방울 아래 뾰족한 끝이 실제 좌표를 가리킵니다. */
      anchor={{ x: 0.5, y: 1 }}>
      <Pin place={place} active={active} />
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
function Pin({ place, active }: { place: MapPlace; active: boolean }) {
  const size = active ? 36 : 30;
  const border = active ? 3 : 2.5;
  /* 다녀온 곳은 속을 색으로 채우고 표시를 얹습니다. 아직인 곳은 흰 속에 번호.
     지도가 체크리스트처럼 읽혀, 채워질수록 얼마나 돌았는지 보입니다. */
  const visited = place.detail.visited;
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
          {place.emoji ? (
            /* 그림이 있으면 번호 대신 그림입니다. 둘 다 넣으면 열몇
               픽셀 안에서 어느 쪽도 안 읽힙니다. 순서는 목록이 말해 줍니다. */
            <Body small style={styles.pinEmoji}>
              {place.emoji}
            </Body>
          ) : (
            <Body small strong style={styles.pinNumber}>
              {place.order}
            </Body>
          )}
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
  pinNumber: {
    /* 날짜 색이 파스텔이라 그것으로 번호를 쓰면 읽히지 않습니다. 색은 방울이
       맡고 번호는 늘 짙게 씁니다. */
    color: Colors.onDay,
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
