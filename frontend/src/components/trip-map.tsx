import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MapPlace, TripMapProps } from '@/components/map-types';
import { Colors, Radius, Spacing, Tap } from '@/constants/theme';
import { Badge, Body, Caption, IconButton, Row, Subtitle } from '@/ui';

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

export type { MapPlace } from '@/components/map-types';

export function TripMap({ places, activeId, onSelect, height = 300 }: TripMapProps) {
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

  /** 같은 날끼리 이어 동선을 그립니다. */
  const routes = useMemo(() => {
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
      initialRegion={region}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}>
      {routes.map((list) => (
        <Polyline
          key={`route-${list[0].dayIndex}`}
          coordinates={list.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor={list[0].color}
          strokeWidth={3}
          /* 점선으로 둬야 실제 도로 경로와 헷갈리지 않습니다. */
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
        <Marker
          key={p.id}
          coordinate={{ latitude: p.lat, longitude: p.lng }}
          title={p.name}
          onPress={() => pick(p.id)}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 1 }}>
          <Pin place={p} active={p.id === activeId} />
        </Marker>
      ))}
    </MapView>
  );

  const chosen = full && sheetId ? (places.find((p) => p.id === sheetId) ?? null) : null;

  return (
    <>
      <View style={[styles.frame, { height }]}>
        {full ? null : body}
        {full ? null : (
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
 * 핀.
 *
 * 날짜 색 방울 안에 순번. 겹쳐 있어도 몇 번째인지 읽히도록 흰 테두리를
 * 두릅니다. 고른 것은 조금 키웁니다.
 */
function Pin({ place, active }: { place: MapPlace; active: boolean }) {
  const size = active ? 34 : 28;
  return (
    <View style={styles.pinWrap}>
      <View
        style={[
          styles.pin,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: place.color,
            borderWidth: active ? 3 : 2,
          },
        ]}>
        <Body small strong style={styles.pinText}>
          {place.order}
        </Body>
      </View>
      {/* 방울 아래 꼬리. 정확히 어느 점을 가리키는지 보이게 합니다. */}
      <View style={[styles.pinTail, { borderTopColor: place.color }]} />
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
    backgroundColor: Colors.fill,
  },
  fullWrap: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  overlay: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },

  pinWrap: {
    alignItems: 'center',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#FFFFFF',
  },
  pinText: {
    color: '#FFFFFF',
  },
  pinTail: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
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
