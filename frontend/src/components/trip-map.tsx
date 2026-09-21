import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MapPlace, TripMapProps } from '@/components/map-types';
import { QUIET_MAP } from '@/lib/map-style';
import { Colors, Radius, Spacing, Tap } from '@/constants/theme';
import { Badge, Body, Caption, Chip, Icon, IconButton, Row, Subtitle } from '@/ui';

/**
 * 지도 (앱).
 *
 * <p>안드로이드도 iOS 도 구글 지도입니다. 웹은 이 파일 대신 trip-map.web.tsx
 * 가 잡히는데, 그쪽도 구글 지도입니다 — 셋 다 같은 지도를 다른 SDK 로
 * 그립니다. 웹 SDK 가 DOM 요소에 그리는 것이라 RN 에서 못 쓸 뿐입니다.
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

/**
 * 사람이 서 있는 자리 — 지도에 얹는 것까지.
 *
 * <p>나와 동행자가 같은 것을 씁니다. 굽는 법도 다른 핀들과 같습니다.
 */
function FaceMark({
  lat,
  lng,
  face,
  color,
  title,
  layer,
}: {
  lat: number;
  lng: number;
  face: string;
  color: string;
  title: string;
  layer: number;
}) {
  /* 얼굴과 색이 바뀔 때만 다시 굽습니다. 자리가 바뀌는 것은 그림이 아니라
     얹히는 곳이 바뀌는 것이라 다시 구울 일이 아닙니다. */
  const drawing = useBake([face, color]);

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      title={title}
      tracksViewChanges={drawing}
      zIndex={layer}>
      <FacePin face={face} color={color} />
    </Marker>
  );
}

/** 잠깐 꽂아 둔 깃발 — 지도에 얹는 것까지. */
function FlagMark({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  /* 늘 같은 그림이라 한 번만 굽습니다. */
  const drawing = useBake([]);

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      /* 깃대 아래 끝이 자리입니다. */
      anchor={{ x: 0.3, y: 1 }}
      title={title}
      tracksViewChanges={drawing}
      zIndex={700}>
      <FlagPin color={Colors.warning} />
    </Marker>
  );
}

/**
 * 사람이 서 있는 자리.
 *
 * <p>장소 핀(물방울)과 생김새를 달리합니다. 같은 모양으로 두면 지도만 보고는
 * 일정에 넣어 둔 곳과 지금 누가 서 있는 자리를 구별할 수 없습니다.
 *
 * <p>나와 동행자가 같은 판을 씁니다. 색만 다릅니다 — 나만 다른 모양으로 두면
 * 지도에서 내가 어디 있는지를 다른 규칙으로 찾아야 합니다.
 */
function FacePin({ face, color }: { face: string; color: string }) {
  const r = 30;
  return (
    <View
      style={[
        styles.chip,
        {
          width: r,
          height: r,
          borderRadius: r / 2,
          borderWidth: 3,
          borderColor: color,
          backgroundColor: '#FFFFFF',
        },
      ]}>
      <Text style={styles.face}>{face}</Text>
    </View>
  );
}

/**
 * 잠깐 꽂아 둔 깃발.
 *
 * <p>깃대와 깃폭을 네모 둘로 세웁니다. 앱 마커는 화면 요소를 그대로 얹으므로
 * 그림 파일이 필요 없습니다.
 */
function FlagPin({ color }: { color: string }) {
  return (
    <View style={styles.flag}>
      <View style={[styles.flagCloth, { backgroundColor: color }]} />
      <View style={[styles.flagPole, { backgroundColor: color }]} />
    </View>
  );
}

export type { MapPlace } from '@/components/map-types';

/*
  내 자리·동행자·깃발은 한동안 앱에서 비어 있었습니다. 위치 권한이 매니페스트에
  박히는 것이라 GPS 가 열리는 빌드를 기다렸는데, 그 빌드가 나온 뒤에도 이 파일은
  값을 받지 않은 채였습니다. 그래서 일정 화면은 넘기고 지도는 버리는, 아무도
  틀렸다고 말해 주지 않는 상태가 이어졌습니다.

  <p>showsUserLocation 은 안 씁니다. 그것은 기기가 그리는 파란 점이라 동행자와
  생김새가 달라지고, 색도 자리도 우리가 못 정합니다. 나도 동행자와 같은 방식으로
  그립니다.
*/
export function TripMap({
  places: all,
  activeId,
  onSelect,
  routes,
  routesPending = false,
  traveler,
  here,
  mates,
  myFace,
  notes,
  dayFilter = false,
  height = 300,
  chrome = true,
  bleed = false,
  link = true,
  fitAt,
  shape = 'default',
  panTo,
  follow,
  bottomInset = 0,
  goHereAt,
}: TripMapProps) {
  /*
    어느 날만 볼지.

    <p>지도 안에 둡니다. 밖에서 걸러 넘기면 작은 지도만 걸러지고 전체화면으로
    펴는 순간 다시 전부가 됩니다 — 정작 날짜별로 보고 싶은 때는 크게 펼쳤을
    때입니다.
  */
  const [dayPick, setDayPick] = useState<number | null>(null);
  const shown = useMemo(
    () => (dayPick === null ? all : all.filter((p) => p.dayIndex === dayPick)),
    [all, dayPick],
  );
  /** 찍을 곳이 있는 날만. 빈 날을 고르면 아무 일도 안 일어납니다. */
  const dayList = useMemo(() => {
    const seen = new Map<number, string>();
    all.forEach((p) => {
      if (!seen.has(p.dayIndex)) {
        seen.set(p.dayIndex, p.detail?.dayLabel || `${p.dayIndex + 1}일차`);
      }
    });
    return [...seen.entries()];
  }, [all]);

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

  /*
    지도가 다 섰는지.

    <p>안드로이드 지도는 <b>서기 전에 받은 카메라 명령을 조용히 버립니다.</b>
    실패했다고 말해 주지 않아서, 부른 쪽은 옮겼다고 믿고 지도는 처음 자리에
    그대로 있습니다.

    <p>처음 들어왔을 때 동선이 판 뒤에 깔려 있던 것이 이것이었습니다. 판에
    덮인 만큼을 셈에 넣은 맞춤은 지도 크기를 잰 직후에 갔는데, 그때는 아직
    지도가 서는 중이었습니다. 그래서 덮인 것을 모르던 첫 맞춤만 남았습니다.

    <p>웹은 원래 준비된 뒤에 맞춥니다(구글 지도 JS 가 idle 을 알려 줍니다).
    그래서 웹만 멀쩡했습니다. 앱도 같은 신호를 기다립니다.
  */
  const [ready, setReady] = useState(false);

  /**
   * 처음 보여 줄 범위.
   *
   * 공항처럼 멀리 떨어진 곳(fit=false)은 뺍니다. 그것까지 넣으면 나머지가
   * 좁쌀만 해집니다.
   */
  const region = useMemo(() => {
    const core = shown.filter((p) => p.fit);
    const target = core.length >= 2 ? core : shown;
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
  }, [shown]);

  /**
   * 아래가 판에 덮인 만큼 카메라를 어긋냅니다.
   *
   * <h3>지도에게 시키지 않습니다</h3>
   *
   * <p>처음에는 mapPadding 으로 줬습니다. 지도에게 "쓸 수 있는 자리" 를
   * 알려 주는 값이라 한 줄이면 끝나는 일이었는데, <b>여행 상세에 들어가면
   * 앱이 꺼졌습니다.</b> 안드로이드 쪽은 지도 객체가 준비되기 전에 padding 이
   * 들어오면 그대로 넘어집니다. 화면에 들어서자마자 넘기는 값이라 늘 그
   * 자리였습니다.
   *
   * <p>그래서 네이티브에 안 맡기고 여기서 셉니다. 보이는 자리는 위쪽
   * (높이 - 덮인 만큼)뿐이므로, 두 가지를 합니다 — 담을 것이 그 좁은 자리에
   * 다 들어가게 <b>조금 물러나고</b>, 가운데가 그 자리의 한가운데에 오게
   * <b>아래로 내려다봅니다</b>.
   *
   * <p>화면 높이를 아직 모르면(첫 그림) 그냥 둡니다. 모르는 채로 세면 엉뚱한
   * 데를 보게 되고, 어차피 곧 다시 잽니다.
   */
  const frame = useCallback(
    (r: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => {
      const hide = full ? 0 : bottomInset;
      if (hide <= 0 || size.h <= 0 || hide >= size.h) {
        return r;
      }
      const grow = size.h / (size.h - hide);
      const latitudeDelta = r.latitudeDelta * grow;
      return {
        ...r,
        latitudeDelta,
        /* 화면은 아래로 갈수록 위도가 낮아집니다. 가운데를 덮인 만큼의
           절반 아래로 옮기면, 담긴 것은 그만큼 위로 올라와 판을 피합니다. */
        latitude: r.latitude - (hide / 2 / size.h) * latitudeDelta,
      };
    },
    [full, bottomInset, size.h],
  );

  /** 일정에 없는 자리로 옮깁니다. 꽂아 둔 깃발처럼 고를 id 가 없는 것들. */
  useEffect(() => {
    if (!panTo || !map.current) {
      return;
    }
    map.current.animateToRegion(
      frame({
        latitude: panTo.lat,
        longitude: panTo.lng,
        latitudeDelta: FOCUS_SPAN,
        longitudeDelta: FOCUS_SPAN,
      }),
      300,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panTo?.at]);

  /*
    옮겨 달라고 해 놓고 아직 못 옮긴 것.

    <p>앱에서는 십자를 누를 때 <b>그제야</b> 위치 권한을 묻습니다. 그래서
    누른 그 순간에는 내 자리가 아직 없습니다 — 물어보고, 허락받고, 위성이나
    기지국을 잡기까지 몇 초가 걸립니다.

    <p>그동안 goHere 는 그냥 돌아섰고, 그 한 번은 버려졌습니다. 잠시 뒤 자리가
    와도 아무도 다시 부르지 않았습니다. 눌렀는데 아무 일도 안 일어나는 것으로
    보였던 것이 이것입니다.

    <p>그래서 "옮겨 달라" 를 적어 둡니다. 자리가 오면 그때 옮기고 지웁니다.
  */
  const wanted = useRef(false);

  /** 내가 있는 자리로 지도를 옮깁니다. 어디까지 갔는지 놓쳤을 때 쓰는 단추입니다. */
  const goHere = useCallback(() => {
    if (!map.current || !here) {
      /* 아직 자리를 모릅니다. 오면 그때 옮깁니다. */
      wanted.current = true;
      return;
    }
    wanted.current = false;
    /*
      이미 가까이 보고 있으면 그대로 둡니다. 누를 때마다 당겨지면 답답합니다.
      지금 얼마나 보고 있는지는 마지막으로 손을 뗀 자리(view)가 알려 줍니다.
    */
    const span = view && view.dLat < FOCUS_SPAN * 2 ? view.dLat : FOCUS_SPAN;
    map.current.animateToRegion(
      frame({
        latitude: here.lat,
        longitude: here.lng,
        latitudeDelta: span,
        longitudeDelta: span,
      }),
      350,
    );
  }, [here, view, frame]);

  /*
    바깥에서 "내 위치로" 를 눌렀을 때.

    <p>단추가 지도 밖(일정 화면)에도 있습니다. 값이 바뀌기만 하면 움직입니다 —
    같은 자리에서 두 번 눌러도 두 번 다 가야 하므로 자리가 아니라 "눌렀다" 는
    것만 넘겨받습니다.
  */
  useEffect(() => {
    if (goHereAt) {
      goHere();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goHereAt]);

  /* 기다리던 자리가 왔습니다. 이제 옮깁니다. */
  useEffect(() => {
    if (here && wanted.current) {
      goHere();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);

  /** 넣어 둔 곳을 모두 한 화면에. 바깥에서 값을 바꿔 부릅니다. */
  useEffect(() => {
    if (!fitAt || !map.current || shown.length === 0) {
      return;
    }
    map.current.fitToCoordinates(
      shown.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      {
        /* 이쪽은 여백을 받는 자리가 원래 있습니다. 덮인 만큼을 그냥 더합니다. */
        edgePadding: { top: 60, right: 50, bottom: 60 + (full ? 0 : bottomInset), left: 50 },
        animated: true,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitAt]);

  /** 받은 경로 중 그릴 수 있는 것만. */
  const drawn = useMemo(() => (routes ?? []).filter((r) => r.points.length > 1), [routes]);

  /**
   * 실제 경로를 못 받은 구간만 이어 두는 선.
   *
   * <h3>전에는 전부 아니면 전무였습니다</h3>
   *
   * <p>실제 경로가 하나라도 오면 그것들만 그리고 점선은 통째로 건너뛰었
   * 습니다. 그런데 구글은 <b>구간을 가려 가며</b> 줍니다 — 일본에서 대중교통을
   * 아예 안 주는 자리가 있고, 공항처럼 먼 구간이 대개 그렇습니다.
   *
   * <p>그러면 다섯 구간 중 넷만 실선이 그려지고 <b>한 구간은 아무 선도 없이
   * 비었습니다.</b> 길이 한가운데서 끊긴 것처럼 보이는 것이 이것입니다.
   *
   * <p>이제 구간마다 봅니다. 받은 구간은 실선, 못 받은 구간만 점선.
   */
  const hops = useMemo(() => {
    /* 실제 경로가 덮은 구간. id 는 "떠나는곳-닿는곳" 입니다. */
    const covered = new Set(drawn.map((r) => r.id));
    const byDay = new Map<number, MapPlace[]>();
    shown.forEach((p) => {
      const list = byDay.get(p.dayIndex) ?? [];
      list.push(p);
      byDay.set(p.dayIndex, list);
    });
    const out: { id: string; from: MapPlace; to: MapPlace }[] = [];
    byDay.forEach((list) => {
      for (let i = 0; i < list.length - 1; i++) {
        const from = list[i];
        const to = list[i + 1];
        if (!covered.has(`${from.id}-${to.id}`)) {
          out.push({ id: `${from.id}-${to.id}`, from, to });
        }
      }
    });
    return out;
  }, [shown, drawn]);

  /*
    장소 묶음이 실제로 바뀌었을 때만 화면을 다시 맞춥니다. 핀을 고르거나
    다녀옴을 켜는 것만으로 다시 맞추면 들여다보던 자리가 매번 튕겨 나갑니다.

    <p><b>잰 뒤에 한 번 더 맞춥니다.</b> 첫 그림에서는 지도 높이를 아직 몰라
    (size.h 가 0) 판에 덮인 만큼을 셀 수가 없습니다. 그대로 두면 처음 들어왔을
    때 동선이 판 뒤에 깔려 안 보였습니다 — 정작 제일 보고 싶은 순간입니다.

    <p>그래서 "쟀는지" 를 열쇠에 넣습니다. 0 에서 실제 높이로 바뀌는 그 한 번만
    다시 맞추고, 그 뒤로는 판을 아무리 끌어도 다시 안 맞춥니다. 끌 때마다
    맞추면 보던 자리가 손을 따라 계속 달아납니다.
  */
  const fitted = useRef('');
  useEffect(() => {
    if (!ready || size.h === 0 || !map.current) {
      /* 아직 셀 수도 옮길 수도 없습니다. 준비되면 이 효과가 다시 돕니다. */
      return;
    }
    const key = shown.map((p) => `${p.id}@${p.lat},${p.lng}`).join('|');
    if (key === fitted.current) {
      return;
    }
    fitted.current = key;
    map.current.animateToRegion(frame(region), 350);
  }, [shown, region, frame, size.h, ready]);

  /* 고른 장소로 옮기면서 들여다볼 만큼 당깁니다. */
  useEffect(() => {
    const chosen = shown.find((p) => p.id === activeId);
    if (!chosen || !map.current) {
      return;
    }
    if (follow) {
      /* 따라가되 당기지 않습니다. 앞뒤 곳까지 한 화면에 넣으면 동선이
         남은 채로 눈길만 옮겨 가고, 먼 구간에서는 저절로 물러납니다. */
      const at = shown.indexOf(chosen);
      const near = [shown[at - 1], chosen, shown[at + 1]].filter(Boolean);
      const lats = near.map((p) => p.lat);
      const lngs = near.map((p) => p.lng);
      map.current.animateToRegion(
        frame({
          latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
          longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
          latitudeDelta: Math.max(FOCUS_SPAN, (Math.max(...lats) - Math.min(...lats)) * 1.8),
          longitudeDelta: Math.max(FOCUS_SPAN, (Math.max(...lngs) - Math.min(...lngs)) * 1.8),
        }),
        350,
      );
      return;
    }
    map.current.animateToRegion(
      frame({
        latitude: chosen.lat,
        longitude: chosen.lng,
        latitudeDelta: FOCUS_SPAN,
        longitudeDelta: FOCUS_SPAN,
      }),
      350,
    );
  }, [activeId, shown, follow, frame]);

  /*
    가까이 몰린 별을 하나로 묶습니다.

    보석함은 한 동네에 여남은 곳이 몰리는 일이 흔합니다. 그대로 찍으면 별이
    서로 덮여 몇 개가 있는지도 모릅니다. 화면에서 몇 픽셀 떨어져 있는지로
    묶으므로, 당기면 저절로 흩어지고 밀면 다시 뭉칩니다.

    묶는 것은 별 모양일 때뿐입니다. 일정의 물방울 핀은 번호가 순서를 말해
    주는 것이라 묶으면 그 순서가 사라집니다.
  */
  const { loners, clumps } = useMemo(() => {
    const none = { loners: shown, clumps: [] as Clump[] };
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
    shown.forEach((p) => {
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

    const loners: MapPlace[] = shown.filter((p) => p.id === activeId);
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
  }, [shown, activeId, shape, view, size]);

  /** 묶음을 누르면 그 안이 다 보일 만큼 당깁니다. */
  const spread = useCallback((group: Clump) => {
    const lats = group.members.map((p) => p.lat);
    const lngs = group.members.map((p) => p.lng);
    map.current?.animateToRegion(
      frame({
        latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
        longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
        latitudeDelta: Math.max((Math.max(...lats) - Math.min(...lats)) * PAD, FOCUS_SPAN),
        longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * PAD, FOCUS_SPAN),
      }),
      350,
    );
  }, [frame]);

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
      /* 양쪽 다 구글 지도로 못박습니다. 이 값을 안 주면 iOS 는 애플 지도가
         뜨는데, 그러면 같은 자리를 두고 지도 셋이 서로 다른 이름과 다른
         길을 말하게 됩니다. 아래 customMapStyle 도 구글에만 먹습니다. */
      provider={PROVIDER_GOOGLE}
      /* 구글은 기기가 어두운 테마면 지도도 어둡게 칠합니다. 웹에는 그런 동작이
         없어 같은 화면이 둘로 갈립니다. 밝은 쪽으로 못박습니다. 이 값은 지도를
         만들 때 한 번만 읽히므로 첫 그림부터 넘겨야 합니다. */
      userInterfaceStyle="light"
      /* 웹과 같은 값을 씁니다. 둘이 갈리면 같은 여행을 폰과 브라우저에서 볼 때
         다른 지도가 됩니다. 위에서 구글로 못박았으므로 iOS 에도 먹습니다. */
      customMapStyle={QUIET_MAP as unknown as never[]}
      initialRegion={region}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      onMapReady={() => setReady(true)}
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
        받은 구간은 실선, 못 받은 구간은 점선. 점선은 "이 순서로 간다" 는
        뜻일 뿐 지나는 길이 아니므로 생김새를 달리 둡니다.
      */}
      {drawn.map((line) => (
        <Polyline
          key={line.id}
          coordinates={line.points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor={line.color}
          strokeWidth={4}
        />
      ))}
      {/* 묻고 있는 동안에는 점선도 안 그립니다. 점선은 "길을 못 찾았다" 는
          뜻인데, 찾는 중에 그렇게 말하면 틀린 말입니다. */}
      {link && !routesPending
        ? hops.map((hop) => (
            <Polyline
              key={`hop-${hop.id}`}
              coordinates={[
                { latitude: hop.from.lat, longitude: hop.from.lng },
                { latitude: hop.to.lat, longitude: hop.to.lng },
              ]}
              strokeColor={hop.from.color}
              strokeWidth={3}
              lineDashPattern={[6, 8]}
            />
          ))
        : null}

      {/*
        길 위를 지나가는 것.

        <p>이모지를 씁니다 — 앱 쪽 마커는 화면 요소를 그대로 얹을 수 있어서
        돌리는 것도 크기를 바꾸는 것도 됩니다. 웹은 마커 글자를 못 돌려
        선으로 그리는데, 같은 자리에 같은 뜻이면 생김새가 조금 달라도
        됩니다.

        <p>✈️ 는 오른쪽(동쪽)을 보고 있습니다. 북쪽이 0 인 heading 으로
        맞추려면 90 도를 빼야 합니다.
      */}
      {traveler ? (
        <Marker
          coordinate={{ latitude: traveler.lat, longitude: traveler.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          rotation={traveler.heading - 90}
          flat
          tracksViewChanges={false}
          zIndex={900}>
          <Text style={{ fontSize: 20 + traveler.lift * 8 }}>✈️</Text>
        </Marker>
      ) : null}

      {shown.map((p) =>
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

      {/*
        지금 내가 있는 자리.

        <p>바깥 원은 "이 안쪽 어딘가" 라는 뜻입니다. 실내나 지하에서는 꽤
        커지는데, 그것이 맞는 말입니다 — 점 하나로 찍으면 지하철 안에서도
        한 자리를 정확히 아는 것처럼 보입니다.
      */}
      {/* 정확도를 모르면(here 가 0 을 줍니다) 원을 안 그립니다. 반지름 0 인
          원은 "한 자리를 정확히 안다" 는 말이 되는데, 0 은 그 반대입니다. */}
      {here && here.accuracy > 0 ? (
        <Circle
          center={{ latitude: here.lat, longitude: here.lng }}
          radius={here.accuracy}
          strokeColor={`${Colors.accentInk}59`}
          fillColor={`${Colors.accentInk}14`}
          strokeWidth={1}
        />
      ) : null}
      {here ? (
        <FaceMark
          lat={here.lat}
          lng={here.lng}
          face={myFace ?? ''}
          color={Colors.accentInk}
          title="지금 내 위치"
          layer={999}
        />
      ) : null}

      {/* 동행자. 나와 같은 동그란 판이고 색만 다릅니다. */}
      {(mates ?? []).map((mate) => (
        <FaceMark
          key={`mate-${mate.id}`}
          lat={mate.lat}
          lng={mate.lng}
          /* 고른 동물, 안 골랐으면 이름 첫 글자. 첫 글자만으로는 "지영" 과
             "지훈" 이 지도에서 같아 보입니다. */
          face={mate.face}
          color={Colors.success}
          title={`${mate.name} 님이 지금 있는 곳`}
          layer={800}
        />
      ))}

      {/* 잠깐 꽂아 둔 깃발. 꽂는 단추가 깃발이니 지도에도 깃발이 서야
          누른 것과 찍힌 것이 같은 것인 줄 압니다. */}
      {(notes ?? []).map((note) => (
        <FlagMark
          key={`note-${note.id}`}
          lat={note.lat}
          lng={note.lng}
          title={note.label ?? '잠깐 꽂아 둔 곳'}
        />
      ))}

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

  const chosen = full && sheetId ? (shown.find((p) => p.id === sheetId) ?? null) : null;

  /*
    날짜 띠.

    <p>작은 지도와 전체화면 양쪽에 같은 것을 답니다. 전체화면에서는 위쪽
    안전영역만큼 내려 앉힙니다.
  */
  const dayRail =
    dayFilter && dayList.length > 1 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayRail}
        contentContainerStyle={styles.dayRailInner}>
        <Row gap={Spacing.xs} style={styles.dayRailRow}>
          <Chip label="전체" selected={dayPick === null} onPress={() => setDayPick(null)} />
          {dayList.map(([index, label]) => (
            <Chip
              key={index}
              label={label}
              selected={dayPick === index}
              onPress={() => setDayPick(dayPick === index ? null : index)}
            />
          ))}
        </Row>
      </ScrollView>
    ) : null;

  return (
    <>
      <View style={[styles.frame, bleed ? styles.frameBleed : { height }]}>
        {full ? null : body}
        {/* 지도 위에서 말합니다. 판 안 목록에도 같은 안내가 있지만, 판을
            내리고 지도를 보는 동안에는 그것이 안 보입니다. */}
        {routesPending && !full ? (
          <View style={styles.pending} pointerEvents="none">
            <ActivityIndicator size="small" color={Colors.textSecondary} />
            <Caption tone="secondary">길 찾는 중</Caption>
          </View>
        ) : null}
        {full ? null : dayRail}
        {full || !chrome ? null : (
          <View style={styles.overlay}>
            {here ? <IconButton name="crosshair" label="내 위치로" onPress={goHere} /> : null}
            <IconButton name="maximize" label="전체화면으로 보기" onPress={() => setFull(true)} />
          </View>
        )}
      </View>

      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)}>
        <View style={styles.fullWrap}>
          {full ? body : null}
          {dayRail ? (
            <View style={[styles.fullRail, { top: insets.top + Spacing.md }]}>{dayRail}</View>
          ) : null}
          <View style={[styles.overlay, { top: insets.top + Spacing.md }]}>
            {here ? <IconButton name="crosshair" label="내 위치로" onPress={goHere} /> : null}
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
 * 그림을 언제 구울지.
 *
 * <p>화면 요소로 만든 핀은 지도에 그림 한 장으로 구워 얹힙니다. 언제 구울지는
 * {@code tracksViewChanges} 가 정하는데, <b>안 주면 계속 켜진 것이 기본</b>
 * 입니다. 그러면 매 프레임 다시 굽고, 아직 자리를 못 잡은 첫 프레임에서는
 * 크기가 0 인 그림을 구우려다 안드로이드가 그대로 죽습니다.
 *
 * <p>내 자리·동행자·깃발을 더할 때 이것을 안 줬다가 여행 상세에 들어가면
 * 앱이 꺼졌습니다. 이 파일의 다른 핀들은 전부 막아 두고 있었는데 새로 더한
 * 셋만 빠져 있었습니다. 그래서 규칙을 함수 하나로 빼 둡니다 — 다음에 핀을
 * 더하는 사람이 이것만 부르면 됩니다.
 *
 * @param deps 다시 구워야 하는 때. 생김새가 바뀌는 값들을 넘깁니다
 */
function useBake(deps: unknown[]) {
  const [drawing, setDrawing] = useState(true);

  useEffect(() => {
    setDrawing(true);
    const timer = setTimeout(() => setDrawing(false), DRAW_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return drawing;
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
  const drawing = useBake([active, place.color, place.order, place.detail.visited]);

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
  /* 지도 한가운데 위쪽. 왼쪽 위는 날짜 띠가, 오른쪽 위는 단추들이,
     아래쪽은 판이 씁니다. 남는 자리가 여기뿐입니다. */
  pending: {
    position: 'absolute',
    top: Spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  /* 지도 왼쪽 위. 오른쪽 위에는 전체화면 단추가 섭니다. */
  dayRail: {
    position: 'absolute',
    top: Spacing.md,
    left: 0,
    right: 0,
    flexGrow: 0,
  },
  dayRailInner: {
    paddingHorizontal: Spacing.md,
    /* 오른쪽 단추와 안 겹치게 그만큼 비웁니다. */
    paddingRight: Tap.min * 2 + Spacing.xl,
  },
  dayRailRow: {
    flexWrap: 'nowrap',
  },
  /* 전체화면에서는 안전영역만큼 내려 앉힙니다. 안에 든 띠는 이미 제
     자리를 잡고 있으므로 이 껍데기가 기준만 옮겨 줍니다. */
  fullRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: Tap.min,
  },
  overlay: {
    /* 웹과 같은 줄에 같은 차례로 섭니다. 한쪽만 세로로 쌓이면 같은 화면으로
       안 읽힙니다. */
    flexDirection: 'row',
    gap: Spacing.xs,
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
  face: {
    fontSize: 15,
    /* 동물 이모지도 이름 첫 글자도 들어옵니다. 줄 높이를 비워 둬야 둘 다
       동그라미 한가운데에 섭니다. */
    lineHeight: undefined,
  },
  /* 깃대 아래 끝이 자리이므로, 그림의 왼쪽 아래를 기준으로 세웁니다. */
  flag: {
    width: 26,
    height: 32,
    justifyContent: 'flex-start',
  },
  flagPole: {
    position: 'absolute',
    left: 6,
    top: 0,
    bottom: 0,
    width: 2.6,
    borderRadius: 1.3,
  },
  flagCloth: {
    position: 'absolute',
    left: 8,
    top: 5,
    width: 13,
    height: 11,
    borderWidth: 1.4,
    borderColor: '#FFFFFF',
    /* 오른쪽 귀퉁이를 깎아 깃폭처럼 보이게 합니다. */
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
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
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
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
