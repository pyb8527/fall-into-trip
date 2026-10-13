import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { Caption, Icon } from '@/ui';

/**
 * 사진 크게 보기.
 *
 * <h3>한 벌만 둡니다</h3>
 *
 * <p>사진이 뜨는 자리가 여럿입니다 — 우리가 받아 둔 것(OurPhoto), 구글이
 * 가진 것(PlacePhoto), 여러 장을 옆으로 넘기는 띠(PhotoStrip). 자리마다
 * 크게 보는 판을 따로 만들면 닫는 단추 자리도 넘기는 방식도 조금씩
 * 달라지고, 누르는 사람은 <b>같은 일을 하는데 매번 다르게</b> 하게 됩니다.
 *
 * <p>그래서 주소만 받습니다. 어디서 온 사진인지는 부르는 쪽이 알고, 여기는
 * 그것을 크게 보여 주는 일만 합니다.
 *
 * <h3>단추를 사진 위에 얹지 않습니다</h3>
 *
 * <p>닫는 단추를 사진 위 오른쪽 모서리에 동그라미로 띄워 두었습니다. 그런데
 * 사진은 무엇이 찍혔을지 모르는 것이라, 그 자리가 흰 하늘이면 <b>단추가
 * 통째로 사라집니다.</b> 반투명 바탕을 깔아도 밝은 사진 위에서는 옅은 회색
 * 얼룩으로만 보입니다.
 *
 * <p>위아래에 띠를 둡니다. 띠는 사진 밖이라 무엇이 찍혔든 상관이 없고,
 * 닫는 단추와 몇 번째인지가 늘 같은 자리에 섭니다. 사진은 그만큼 좁아지는데,
 * 어차피 안 자르고 맞추므로 대개 위아래에 남던 검은 자리입니다.
 *
 * <h3>기기의 뒤로가기가 판을 닫습니다</h3>
 *
 * <p>안 그러면 뒤로가기가 <b>판이 아니라 화면</b>을 물립니다 — 사진을 닫으려
 * 눌렀는데 보고 있던 여행기에서 튕겨 나갑니다.
 *
 * <p>웹에서는 판을 열 때 기록에 한 칸을 넣어 둡니다. 그러면 뒤로가기가 그
 * 칸을 먼저 걷고, 화면은 제자리에 남습니다. 화면에서 ✕ 로 닫을 때는 넣어 둔
 * 칸을 우리가 걷습니다 — 안 걷으면 앞으로 가기가 판을 다시 엽니다.
 *
 * <p>앱(웹뷰)도 이 기록을 그대로 씁니다. 순수 앱에서는 Modal 의
 * onRequestClose 가 같은 일을 합니다.
 *
 * <h3>키워 볼 수 있습니다</h3>
 *
 * <p>크게 보는 판인데 화면 크기 이상으로는 못 키웠습니다. 메뉴판의 값,
 * 안내판의 작은 글씨, 영수증 같은 것은 <b>키워야 읽히는</b> 사진이라, 여기서
 * 못 키우면 사진을 기기에 받아 다른 앱에서 열어야 했습니다. 키우는 방법은
 * {@link ZoomFrame} 에 적었습니다.
 *
 * <p>키운 동안에는 옆으로 넘기기를 잠급니다. 키운 사진은 한 손가락으로
 * 끌어 여기저기를 보는데, 넘기기가 살아 있으면 그 끌기가 <b>다음 장으로
 * 넘어가 버립니다.</b> 원래 크기로 돌아오면 다시 넘어갑니다.
 */
export function PhotoViewer({
  uris,
  from = 0,
  visible,
  onClose,
  by,
}: {
  /** 보여 줄 사진들의 주소. 우리 것이든 구글 것이든 여기서는 같습니다. */
  uris: string[];
  /** 몇 번째부터 열지. 띠에서 넘겨 보던 장으로 엽니다. */
  from?: number;
  visible: boolean;
  onClose: () => void;
  /** 찍은 사람. 구글 사진은 밝혀야 합니다(구글 약관). */
  by?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(from);
  const rail = useRef<ScrollView>(null);
  /* 지금 보는 장이 키워져 있는지. 넘기기를 잠그고 「원래 크기」 를 띄웁니다. */
  const [zoomed, setZoomed] = useState(false);
  /* 「원래 크기」 를 누를 때마다 하나씩 올립니다. 키운 장이 이것을 보고 제
     크기로 돌아갑니다 — 배율은 그 장이 들고 있어서 위에서 직접 못 만집니다. */
  const [unzoom, setUnzoom] = useState(0);

  /* 닫는 함수가 매 렌더마다 새로 오므로, 아래 효과가 그것 때문에 다시
     돌지 않게 붙들어 둡니다 — 다시 돌면 기록 칸이 계속 쌓입니다. */
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    window.history.pushState({ fitViewer: true }, '');
    const popped = () => close.current();
    window.addEventListener('popstate', popped);
    return () => {
      window.removeEventListener('popstate', popped);
      /*
        우리가 넣어 둔 칸이 아직 남아 있으면(=✕ 나 바탕을 눌러 닫은 경우)
        걷습니다. 뒤로가기로 닫혔을 때는 이미 걷힌 뒤라 여기서 또 물리면
        화면이 한 칸 더 뒤로 갑니다.
      */
      if ((window.history.state as { fitViewer?: boolean } | null)?.fitViewer) {
        window.history.back();
      }
    };
  }, [visible]);

  if (!visible || uris.length === 0) {
    return null;
  }

  /* 띠가 먹는 높이. 사진은 그 사이를 씁니다 — 띠 아래로 사진이 들어가면
     닫는 단추가 다시 사진 위에 얹힌 것과 같아집니다. */
  const barTop = 52 + insets.top;
  const barBottom = (by ? 44 : 0) + Math.max(insets.bottom, Spacing.s3);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dark}>
        {/* 위 띠. 닫는 단추와 몇 번째인지가 늘 같은 자리에 섭니다. */}
        <View style={[styles.top, { height: barTop, paddingTop: insets.top }]}>
          <Pressable style={styles.close} onPress={onClose} accessibilityLabel="닫기">
            <Icon name="x" size={26} tone="inverse" />
          </Pressable>
          <View style={styles.right}>
            {/*
              원래 크기로.

              <p>두 번 누르기로도 돌아오지만 그것은 해 본 사람만 압니다.
              키운 동안에는 보이는 단추를 하나 둡니다 — 손가락을 모으기
              어려운 사람, 화면 읽기를 쓰는 사람도 여기로 돌아옵니다.
            */}
            {zoomed ? (
              <Pressable
                style={styles.unzoom}
                onPress={() => setUnzoom((n) => n + 1)}
                accessibilityRole="button"
                accessibilityLabel="원래 크기로">
                <Icon name="minimize" size={18} tone="inverse" />
                <Caption tone="inverse">원래 크기</Caption>
              </Pressable>
            ) : null}
            {uris.length > 1 ? (
              <Caption tone="inverse">
                {at + 1} / {uris.length}
              </Caption>
            ) : null}
          </View>
        </View>

        {/*
          사진.

          <p>바탕을 눌러도 닫히게 두었었는데, 넘기려고 쓸어내다 손가락이
          멈추면 그것이 누름으로 읽혀 판이 닫혔습니다. 닫는 길은 위의 ✕ 와
          기기의 뒤로가기, 둘로 충분합니다.
        */}
        <ScrollView
          ref={rail}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          /*
            보고 있던 장으로 열립니다.

            <p>contentOffset 으로 시작 자리를 주는 길도 있는데 그건 iOS 에서만
            먹습니다 — 안드로이드와 웹에서는 무시되어 늘 첫 장이 열립니다.
            자리를 잡은 뒤에 직접 밀어 줍니다.
          */
          onLayout={() => rail.current?.scrollTo({ x: from * width, animated: false })}
          /*
            세는 것은 구르는 동안 합니다. 손을 뗀 뒤에 세면(momentum) 웹에서
            그 소식이 아예 안 옵니다 — 마우스 바퀴와 트랙패드에는 "던진 뒤
            미끄러지는" 것이 없기 때문입니다.
          */
          onScroll={(e) =>
            setAt(
              Math.min(
                Math.max(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)), 0),
                uris.length - 1,
              ),
            )
          }
          scrollEventThrottle={16}>
          {uris.map((uri, i) => (
            <ZoomFrame
              key={`${uri}-${i}`}
              uri={uri}
              width={width}
              height={Math.max(1, height - barTop - barBottom)}
              top={barTop}
              active={i === at}
              unzoom={unzoom}
              onZoomed={setZoomed}
            />
          ))}
        </ScrollView>

        {/* 아래 띠. 찍은 사람이 있을 때만 섭니다 — 구글 사진은 밝혀야 합니다. */}
        {by ? (
          <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, Spacing.s3) }]}>
            <Caption tone="inverse">{by}</Caption>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** 가장 크게. 이보다 키우면 사진의 낟알만 커지고 읽히는 것은 늘지 않습니다. */
const MAX_ZOOM = 4;

/** 두 번 눌러 키울 때의 배율. 한 번에 글씨가 읽힐 만큼, 그러나 어디를 보는지 잃지 않을 만큼. */
const TAP_ZOOM = 2.5;

/**
 * 이만큼 넘게 커야 「키운 것」 으로 칩니다. 모으다 1 언저리에서 멈춘 것까지
 * 키운 것으로 치면 넘기기가 괜히 잠깁니다.
 */
const ZOOMED = 1.01;

/** 판 가운데를 0 으로 둔 자리. 배율도 옮김도 가운데를 기준으로 셈합니다. */
type Point = { x: number; y: number };

/** 지금 보이는 모양 — 배율, 그리고 가운데에서 얼마나 옮겼는지. */
type Look = { s: number; x: number; y: number };

/**
 * 한 장. 키우고 끌어 보는 일을 맡습니다.
 *
 * <h3>셈은 한 벌, 손 읽기는 둘</h3>
 *
 * <p>무엇이 보일지는 배율 하나와 옮긴 거리 둘로 다 정해지고, 그것을 RN 의
 * {@code Animated} 값에 넣어 그립니다 — 다른 화면들이 이미 쓰는 그
 * 움직임입니다. 다른 것은 <b>손을 읽는 방법</b>뿐입니다.
 *
 * <ul>
 *   <li><b>웹</b>(앱의 웹뷰도 여기입니다) — 브라우저의 터치·마우스·바퀴
 *   소식을 직접 받습니다. 두 손가락은 {@code touchmove} 에서 브라우저의 기본
 *   움직임을 막아야 우리 것이 되는데, RN 웹의 응답자 체계는 그것을 막지
 *   않아 두 손가락이 그대로 화면 굴림으로 새 나갑니다. 바퀴는 애초에 RN 에
 *   없는 소식입니다.</li>
 *   <li><b>순수 앱</b> — RN 의 {@code PanResponder} 로 받습니다. 이
 *   저장소의 끌어 올리는 판들이 쓰는 그것입니다.</li>
 * </ul>
 *
 * <h3>gesture-handler · reanimated 를 안 썼습니다</h3>
 *
 * <p>둘 다 들어 있기는 합니다. 그런데 {@code src/} 안에서 아무도 안 쓰고,
 * 앱 뿌리에 {@code GestureHandlerRootView} 도 없고, reanimated 가 기대는
 * babel 설정 파일도 없습니다. 처음 쓰는 자리가 되면 뿌리를 감싸고(모달은
 * 따로 또 감싸야 합니다) 웹에서 두 손가락이 제대로 오는지부터 따져야
 * 하는데, 정작 우리 앱은 웹뷰라 그 길을 타지 않습니다. 웹에서 손을 직접
 * 읽는 편이 더 짧고 확실합니다.
 *
 * <h3>끌 수 있는 데까지만</h3>
 *
 * <p>사진은 안 자르고 맞추므로 대개 위아래나 양옆이 빕니다. 판 크기로 끝을
 * 잡으면 키운 사진을 그 빈 검정 속으로 끌고 가 <b>사진이 화면 밖으로
 * 사라집니다.</b> 사진의 원래 가로세로를 받아 두었다가(onLoad) 사진
 * 가장자리가 판 가장자리 안으로 들어오지 않게 묶습니다.
 */
function ZoomFrame({
  uri,
  width,
  height,
  top,
  active,
  unzoom,
  onZoomed,
}: {
  uri: string;
  width: number;
  height: number;
  /** 판이 화면 위에서 얼마나 내려와 있는지. 순수 앱에서 손가락 자리를 판 기준으로 바꿀 때 씁니다. */
  top: number;
  /** 지금 보고 있는 장인지. 넘겨서 벗어나면 제 크기로 돌아갑니다. */
  active: boolean;
  /** 이 값이 바뀌면 제 크기로 돌아갑니다(「원래 크기」 단추). */
  unzoom: number;
  onZoomed: (zoomed: boolean) => void;
}) {
  const frame = useRef<View>(null);
  const [zoomed, setZoomed] = useState(false);
  /*
    셈. 한 번만 만듭니다 — 웹의 소식 받이들이 이것을 붙들고 있어서, 렌더마다
    새로 만들면 받이를 매번 뗐다 붙여야 합니다.
  */
  const [act] = useState(() => {
    const shown = {
      s: new Animated.Value(1),
      x: new Animated.Value(0),
      y: new Animated.Value(0),
    };
    /* 사진이 원래 가진 가로세로. 받기 전에는 판을 꽉 채운다고 봅니다. */
    let natural: { w: number; h: number } | null = null;
    let look: Look = { s: 1, x: 0, y: 0 };
    /*
      손가락을 댄 때의 모습. 움직이는 동안은 늘 「댄 때로부터 얼마나」 로
      셈합니다 — 움직임마다 조금씩 더해 가면 어긋남이 쌓입니다.

      <p>손가락 수가 바뀌면(둘 중 하나를 떼거나 하나 더 대면) 그 자리에서
      다시 잡습니다. 안 그러면 남은 손가락이 사진을 확 끌어당깁니다.
    */
    let hold: { count: number; at: Point; d: number; from: Look } | null = null;
    /* 판 크기. 기기를 돌리면 바뀌므로 아래 효과가 새로 알려 줍니다. */
    let size = { w: width, h: height };

    /** 배율과 옮김을 끝 안으로 묶어서 그립니다. */
    const put = (s: number, x: number, y: number) => {
      const { w, h } = size;
      /* 맞춰 넣었을 때 사진이 실제로 차지하는 크기 */
      const fit = natural ? Math.min(w / natural.w, h / natural.h) : 1;
      const dw = natural ? natural.w * fit : w;
      const dh = natural ? natural.h * fit : h;
      const scale = clamp(s, 1, MAX_ZOOM);
      const mx = Math.max(0, (dw * scale - w) / 2);
      const my = Math.max(0, (dh * scale - h) / 2);
      look = { s: scale, x: clamp(x, -mx, mx), y: clamp(y, -my, my) };
      shown.s.setValue(look.s);
      shown.x.setValue(look.x);
      shown.y.setValue(look.y);
      setZoomed(look.s > ZOOMED);
    };

    /**
     * 판 위의 한 점을 그 자리에 둔 채 배율만 바꿉니다.
     *
     * <p>가운데를 기준으로 키우면 손가락(마우스) 아래 보던 것이 옆으로
     * 달아납니다. 그 점 아래 있던 사진 조각이 키운 뒤에도 그 점 아래 남도록
     * 옮김을 같이 고칩니다.
     */
    const zoomAt = (p: Point, s: number) => {
      const scale = clamp(s, 1, MAX_ZOOM);
      const k = scale / look.s;
      put(scale, p.x - (p.x - look.x) * k, p.y - (p.y - look.y) * k);
    };

    const grab = (points: Point[]) => {
      if (points.length === 0) {
        hold = null;
        return;
      }
      const two = points.length >= 2;
      hold = {
        count: two ? 2 : 1,
        at: two ? mid(points[0], points[1]) : points[0],
        d: two ? dist(points[0], points[1]) : 0,
        from: look,
      };
    };

    return {
      shown,
      zoomed: () => look.s > ZOOMED,
      /** 지금 배율. 바퀴는 지난 배율에 곱해 갑니다. */
      scale: () => look.s,
      size: () => size,
      learn: (w: number, h: number) => {
        natural = w > 0 && h > 0 ? { w, h } : null;
      },
      /** 판 크기를 새로 받고 제 크기로 돌아갑니다. */
      reset: (w: number, h: number) => {
        size = { w, h };
        hold = null;
        put(1, 0, 0);
      },
      grab,
      zoomAt,
      /** 옆으로만 끕니다(키운 채 바퀴를 옆으로 굴릴 때). */
      shiftX: (dx: number) => put(look.s, look.x - dx, look.y),
      /** 두 번 누르기. 키워져 있으면 돌아오고, 아니면 누른 자리를 중심으로 키웁니다. */
      toggle: (p: Point) => (look.s > ZOOMED ? put(1, 0, 0) : zoomAt(p, TAP_ZOOM)),
      /** 움직임 하나를 셈합니다. 우리가 맡은 움직임이었으면 true. */
      move: (points: Point[]): boolean => {
        const count = Math.min(points.length, 2);
        if (!hold || hold.count !== count) {
          grab(points);
          return count === 2 || look.s > ZOOMED;
        }
        const { at, d, from } = hold;
        if (count === 2) {
          /*
            모으기. 처음 댄 두 손가락 가운데 아래의 사진 조각을 지금 두
            손가락 가운데로 데려옵니다 — 그래서 모으면서 두 손가락을 같이
            옮기면 끌기도 됩니다.
          */
          const c = mid(points[0], points[1]);
          const s = clamp((from.s * dist(points[0], points[1])) / Math.max(1, d), 1, MAX_ZOOM);
          const k = s / from.s;
          put(s, c.x - (at.x - from.x) * k, c.y - (at.y - from.y) * k);
          return true;
        }
        if (from.s <= ZOOMED) {
          /* 키우지 않은 채 한 손가락이면 넘기기입니다. 우리 일이 아닙니다. */
          return false;
        }
        put(from.s, from.x + points[0].x - at.x, from.y + points[0].y - at.y);
        return true;
      },
    };
  });

  /* 위에는 지금 보는 장의 것만 알립니다. 넘겨 둔 장이 「안 키움」 을 알려
     지금 장의 잠금을 풀어 버리면 안 됩니다. */
  useEffect(() => {
    if (active) {
      onZoomed(zoomed);
    }
  }, [active, zoomed, onZoomed]);

  /*
    제 크기로 돌아가는 때 — 넘겨서 다른 장을 보게 됐을 때, 「원래 크기」 를
    눌렀을 때, 기기를 돌려 판 크기가 바뀌었을 때(셈의 기준이 달라져 보던
    자리를 지킬 수 없습니다).
  */
  useEffect(() => {
    act.reset(width, height);
  }, [act, active, unzoom, width, height]);

  /* ------------------------------------------------------- 웹: 손 읽기 */
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const el = frame.current as unknown as HTMLElement | null;
    if (!el) {
      return;
    }
    /** 화면 좌표를 판 가운데 기준으로. */
    const local = (cx: number, cy: number): Point => {
      const r = el.getBoundingClientRect();
      return { x: cx - r.left - r.width / 2, y: cy - r.top - r.height / 2 };
    };
    const fingers = (list: TouchList) => Array.from(list).map((t) => local(t.clientX, t.clientY));

    /*
      두 번 누르기(손가락).

      <p>dblclick 에 맡기지 않습니다. 휴대폰 브라우저는 두 번 누름을
      dblclick 으로 잘 안 내주고, 내주더라도 늦습니다. 누름 둘이 짧고,
      가깝고, 그 사이 손가락이 거의 안 움직였으면 두 번 누르기로 봅니다.
    */
    let tap: { t: number; p: Point } | null = null;
    let lastTap: { t: number; p: Point } | null = null;

    const touchStart = (e: TouchEvent) => {
      const points = fingers(e.touches);
      act.grab(points);
      tap = points.length === 1 ? { t: e.timeStamp, p: points[0] } : null;
    };
    const touchMove = (e: TouchEvent) => {
      const points = fingers(e.touches);
      if (tap && points[0] && dist(points[0], tap.p) > 10) {
        tap = null;
      }
      /* 우리가 맡은 움직임이면 브라우저가 화면을 굴리거나 페이지를 통째로 키우지 못하게 막습니다. */
      if (act.move(points) && e.cancelable) {
        e.preventDefault();
      }
    };
    const touchEnd = (e: TouchEvent) => {
      act.grab(fingers(e.touches));
      const here = tap;
      tap = null;
      if (e.touches.length > 0 || !here || e.timeStamp - here.t > 250) {
        return;
      }
      if (lastTap && here.t - lastTap.t < 320 && dist(here.p, lastTap.p) < 30) {
        lastTap = null;
        act.toggle(here.p);
        /* 브라우저가 뒤따라 만드는 click · dblclick 을 막습니다 — 안 막으면 아래 dblclick 이 한 번 더 뒤집습니다. */
        if (e.cancelable) {
          e.preventDefault();
        }
      } else {
        lastTap = here;
      }
    };

    /* 마우스로 끌기. 손가락은 위 터치 소식이 맡으므로 마우스만 봅니다. */
    let dragging = false;
    const pointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !act.zoomed()) {
        return;
      }
      dragging = true;
      el.setPointerCapture(e.pointerId);
      act.grab([local(e.clientX, e.clientY)]);
    };
    const pointerMove = (e: PointerEvent) => {
      if (dragging) {
        act.move([local(e.clientX, e.clientY)]);
      }
    };
    const pointerUp = (e: PointerEvent) => {
      if (!dragging) {
        return;
      }
      dragging = false;
      act.grab([]);
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    };
    const doubleClick = (e: MouseEvent) => act.toggle(local(e.clientX, e.clientY));

    /*
      바퀴.

      <p>위아래로 굴리면 키우고 줄입니다 — 옆으로만 넘기는 판이라 위아래
      굴림은 원래 아무 일도 안 하던 자리입니다. 트랙패드로 모으면 브라우저가
      그것을 ctrl 을 누른 바퀴로 보내 주므로 같은 길로 옵니다(한 번에 오는
      양이 작아 더 크게 셉니다). 옆으로 굴리는 것은, 키우지 않았을 때는
      넘기기에 그대로 두고 키웠을 때는 옆으로 끄는 것으로 씁니다.
    */
    const wheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? act.size().h : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      if (!e.ctrlKey && Math.abs(dx) > Math.abs(dy)) {
        if (act.zoomed()) {
          e.preventDefault();
          act.shiftX(dx);
        }
        return;
      }
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const p = local(e.clientX, e.clientY);
      /* 바퀴 소식이 판 밖 좌표로 올 때(키보드로 확대 등)는 가운데를 씁니다. */
      const inside = Math.abs(p.x) <= r.width / 2 && Math.abs(p.y) <= r.height / 2;
      act.zoomAt(
        inside ? p : { x: 0, y: 0 },
        act.scale() * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)),
      );
    };
    /* 사진(img)을 끌면 브라우저가 사진 자체를 끌어 옮기려 듭니다. */
    const noDrag = (e: Event) => e.preventDefault();

    /* 막아야(preventDefault) 하는 소식들이라 passive 를 끕니다. */
    const opts = { passive: false } as const;
    el.addEventListener('touchstart', touchStart, opts);
    el.addEventListener('touchmove', touchMove, opts);
    el.addEventListener('touchend', touchEnd, opts);
    el.addEventListener('touchcancel', touchEnd, opts);
    el.addEventListener('pointerdown', pointerDown);
    el.addEventListener('pointermove', pointerMove);
    el.addEventListener('pointerup', pointerUp);
    el.addEventListener('pointercancel', pointerUp);
    el.addEventListener('dblclick', doubleClick);
    el.addEventListener('wheel', wheel, opts);
    el.addEventListener('dragstart', noDrag);
    return () => {
      el.removeEventListener('touchstart', touchStart);
      el.removeEventListener('touchmove', touchMove);
      el.removeEventListener('touchend', touchEnd);
      el.removeEventListener('touchcancel', touchEnd);
      el.removeEventListener('pointerdown', pointerDown);
      el.removeEventListener('pointermove', pointerMove);
      el.removeEventListener('pointerup', pointerUp);
      el.removeEventListener('pointercancel', pointerUp);
      el.removeEventListener('dblclick', doubleClick);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('dragstart', noDrag);
    };
  }, [act]);

  /* --------------------------------------------------- 순수 앱: 손 읽기 */
  const responder = useMemo(() => {
    /* 모달이 화면을 다 덮으므로, 화면 좌표에서 판 가운데를 빼면 판 기준이 됩니다. */
    const points = (e: GestureResponderEvent): Point[] =>
      e.nativeEvent.touches.map((t) => ({
        x: t.pageX - act.size().w / 2,
        y: t.pageY - top - act.size().h / 2,
      }));
    return PanResponder.create({
      /* 두 손가락이거나 키워 둔 때만 가져옵니다. 키우지 않은 한 손가락은 넘기기라 판(ScrollView)에 둡니다. */
      onStartShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2 || act.zoomed(),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => act.grab(points(e)),
      onPanResponderMove: (e) => {
        act.move(points(e));
      },
      onPanResponderRelease: () => act.grab([]),
      onPanResponderTerminate: () => act.grab([]),
    });
  }, [act, top]);

  /* 순수 앱의 두 번 누르기. 웹은 위에서 따로 받습니다 — 여기서도 받으면 한 번 누름에 두 번 뒤집힙니다. */
  const lastPress = useRef<{ t: number; p: Point } | null>(null);
  const pressed = (e: GestureResponderEvent) => {
    if (Platform.OS === 'web') {
      return;
    }
    const p = {
      x: e.nativeEvent.pageX - width / 2,
      y: e.nativeEvent.pageY - top - height / 2,
    };
    const last = lastPress.current;
    if (last && e.nativeEvent.timestamp - last.t < 320 && dist(p, last.p) < 30) {
      lastPress.current = null;
      act.toggle(p);
    } else {
      lastPress.current = { t: e.nativeEvent.timestamp, p };
    }
  };

  return (
    <View
      ref={frame}
      /* 키운 동안은 브라우저가 이 자리에서 아무것도 못 하게, 아니면 옆 넘기기만 하게 둡니다. */
      style={[{ width, height, overflow: 'hidden' }, zoomed ? ZOOMED_WEB : PAGING_WEB]}
      {...(Platform.OS === 'web' ? null : responder.panHandlers)}>
      <Pressable onPress={pressed} accessible={false} style={{ width, height }}>
        <Animated.View
          style={{
            width,
            height,
            transform: [
              { translateX: act.shown.x },
              { translateY: act.shown.y },
              { scale: act.shown.s },
            ],
          }}>
          <Image
            source={{ uri }}
            style={{ width, height }}
            contentFit="contain"
            transition={120}
            accessibilityLabel="사진"
            onLoad={(e) => act.learn(e.source.width, e.source.height)}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/*
  touchAction 과 cursor 의 'grab' 은 RN 의 ViewStyle 에 없는 이름이라 이름
  붙은 값으로 떼어 두고 눌러 넣습니다(trip/[id].tsx 의 NO_SCROLL_HERE 와 같은
  까닭). 웹에서만 뜻이 있고 앱에서는 아무 일도 안 합니다.

  <p>키우지 않았을 때 pan-x 로 두는 것은, 옆 넘기기는 브라우저에 맡기되 두
  손가락 모으기로 <b>페이지 전체</b>가 커지는 것은 막기 위해서입니다.
*/
const PAGING_WEB = { touchAction: 'pan-x' } as unknown as ViewStyle;
const ZOOMED_WEB = {
  touchAction: 'none',
  cursor: 'grab',
} as unknown as ViewStyle;

const styles = StyleSheet.create({
  dark: {
    flex: 1,
    /* 완전한 검정입니다. 사진을 볼 때 주위가 밝으면 눈이 그쪽에 맞춰져
       사진의 어두운 부분이 안 보입니다. */
    backgroundColor: '#000000',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.s2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
  },
  unzoom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s1,
    minHeight: 44,
    paddingHorizontal: Spacing.s2,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    paddingHorizontal: Spacing.s3,
    paddingTop: Spacing.s2,
  },
});
