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
 * <p><b>그림이 있으면 그림만 찍습니다.</b> 물방울을 씌우고 그 안에 그림을
 * 넣었더니, 물방울 속 흰 원 안으로 들어가면서 그림이 열 몇 픽셀로 쪼그라들어
 * 무엇인지 알아볼 수 없었습니다. 라멘인지 온천인지가 보이라고 넣은 것이
 * 안 보이면 넣은 뜻이 없습니다.
 *
 * <p>대신 동그란 흰 판을 깔아 줍니다. 아무것도 없이 그림만 얹으면 지도의
 * 건물·글자와 섞여 그림이 반쯤 잘려 보입니다.
 *
 * <p>그림이 없는 곳은 번호를 적은 물방울입니다. 그쪽은 몇 번째인지가 곧
 * 내용이라 뾰족한 끝이 어느 자리를 가리키는지도 중요합니다.
 *
 * <p>다녀온 곳은 속을 날짜 색으로 채웁니다. 지도가 채워지는 체크리스트처럼
 * 읽혀, 채울수록 얼마나 돌았는지가 한눈에 보입니다.
 */
/**
 * 별 다섯 개 꼭짓점의 좌표.
 *
 * <p>글자표(★)를 얹고 있었습니다. 글꼴이 그리는 것이라 두툼하게 꽉 찬 별이
 * 되고, 테두리만 두른 동그라미 안에서 혼자 무겁습니다.
 *
 * <p>직접 그립니다. 선으로만 그린 별은 같은 굵기의 동그라미와 한 벌로 보이고,
 * 작게 줄여도 모양이 뭉개지지 않습니다.
 *
 * <p>안쪽 반지름은 바깥의 0.382 배입니다. 정오각별에서 선이 서로 만나는
 * 자리이고, 이보다 크면 통통해져 꽃처럼, 작으면 뾰족해져 가시처럼 보입니다.
 */
function starPath(cx: number, cy: number, radius: number) {
  const inner = radius * 0.382;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    /* 위쪽 꼭짓점에서 시작합니다. 그러지 않으면 별이 기울어 보입니다. */
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? radius : inner;
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

/**
 * 담아 둔 곳을 가리키는 핀.
 *
 * <p>테두리를 두른 동그라미 안에 선으로 그린 별. 담아 둔 곳에는 순서도 갈래도
 * 앞세울 것이 없어, 어디에 얼마나 담겼는지만 보이면 됩니다.
 */
function starIcon(color: string, active: boolean) {
  const r = active ? 17 : 14.5;
  const stroke = active ? 2.6 : 2.2;
  const box = Math.ceil((r + stroke) * 2);
  const c = box / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
<circle cx="${c}" cy="${c}" r="${r}" fill="#FFFFFF" stroke="${color}" stroke-width="${stroke}"/>
<path d="${starPath(c, c, r * 0.62)}" fill="none" stroke="${color}" stroke-width="${stroke * 0.85}"
 stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;
  return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), box, center: c };
}

function pinIcon(color: string, active: boolean, visited: boolean, emoji: boolean) {
  const face = visited ? color : '#FFFFFF';

  if (emoji) {
    const r = active ? 17 : 14.5;
    const ring = active ? 3 : 2.4;
    const box = Math.ceil((r + ring) * 2);
    const c = box / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
<circle cx="${c}" cy="${c}" r="${r}" fill="${face}" stroke="${color}" stroke-width="${ring}"/>
</svg>`;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      box,
      /* 동그란 판은 좌표 위에 가운데를 얹습니다. 물방울처럼 아래 끝이
         가리키는 것이 아닙니다. */
      anchor: c,
      center: c,
    };
  }

  const stroke = active ? 3.2 : 2.4;
  /*
    상자 너비를 그림 너비에 맞춥니다. 전에는 44 짜리 상자에 40 만큼 그려 놓고
    다른 비율로 줄여서, 번호가 물방울 한가운데에서 한 칸 옆으로 밀려 있었습니다.
  */
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
<path d="M20 3C11.7 3 5 9.7 5 18c0 10.7 13.3 27 13.9 27.7a1.4 1.4 0 0 0 2.2 0C21.7 45 35 28.7 35 18 35 9.7 28.3 3 20 3z"
 fill="${color}" stroke="#FFFFFF" stroke-width="${stroke}"/>
<circle cx="20" cy="18" r="8.6" fill="${face}"/>
</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    box: 0,
    anchor: 0,
    center: 0,
  };
}

/**
 * 핀 위에 얹는 글자.
 *
 * <p>그림이 있으면 그림을, 없으면 번호를 얹습니다. 둘 다 넣으면 열 몇 픽셀
 * 안에 두 가지를 우겨넣는 셈이라 어느 쪽도 안 읽힙니다. 순서는 아래 목록이
 * 말해 줍니다.
 */
function pinLabel(
  place: MapPlace,
  visited: boolean,
  active: boolean,
  shape: 'default' | 'star' = 'default',
) {
  /* 별은 그림 쪽에서 선으로 직접 그립니다. 여기서는 아무것도 얹지 않습니다 —
     글자를 겹치면 그려 둔 별 위에 또 하나가 얹힙니다. */
  if (shape === 'star') {
    return undefined;
  }
  if (place.emoji) {
    return { text: place.emoji, fontSize: active ? '20px' : '17px' };
  }
  return {
    text: String(place.order),
    /* 다녀온 곳은 방울 속이 날짜 색으로 차 있어 흰 글자, 아직인 곳은 속이
       희어서 짙은 글자. */
    color: visited ? '#FFFFFF' : Colors.text,
    fontSize: '11px',
    fontWeight: '700',
  };
}

/**
 * 구글 지도에 넘길 아이콘 한 벌.
 *
 * <p>그림 핀과 물방울 핀은 크기도, 좌표에 닿는 자리도 다릅니다. 물방울은 아래
 * 뾰족한 끝이 그 자리를 가리키고, 동그란 그림 판은 한가운데가 얹힙니다.
 * 그 계산을 한 군데에 모읍니다 — 두 군데로 흩어져 있어서 번호가 한 칸 옆으로
 * 밀려 있었습니다.
 */
/**
 * 꽂아 둔 깃발.
 *
 * <p>장소 핀(물방울)과도, 사람(동그란 판)과도 달라야 합니다. 셋이 같은 모양이면
 * 지도만 보고는 일정에 넣어 둔 곳인지, 지금 누가 서 있는 자리인지, 잠깐
 * 표시해 둔 곳인지 구별할 수 없습니다.
 *
 * <p>깃대 아래 끝이 실제 좌표를 가리킵니다. 깃발을 꽂는다는 말 그대로입니다.
 */
function flagIcon(g: ReturnType<typeof gmaps>, color: string) {
  const w = 26;
  const h = 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<path d="M8 30 L8 4" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>
<path d="M8 5 L21 10.5 L8 16 Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.6"
 stroke-linejoin="round"/>
<circle cx="8" cy="30" r="2" fill="${color}"/>
</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new g.Size(w, h),
    /* 깃대 아래 끝. */
    anchor: new g.Point(8, 30),
  };
}

/**
 * 사람을 가리키는 동그란 판.
 *
 * <p>장소 핀(물방울)과 생김새를 달리합니다. 같은 모양으로 두면 지도만 보고는
 * 일정에 넣어 둔 곳과 지금 누가 서 있는 자리를 구별할 수 없습니다.
 */
function personIcon(color: string) {
  const r = 15;
  const box = (r + 3) * 2;
  const c = box / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
<circle cx="${c}" cy="${c}" r="${r}" fill="#FFFFFF" stroke="${color}" stroke-width="3"/>
</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new (gmaps().Size)(box, box),
    anchor: new (gmaps().Point)(c, c),
    labelOrigin: new (gmaps().Point)(c, c),
  };
}

function markerIcon(
  g: ReturnType<typeof gmaps>,
  place: MapPlace,
  active: boolean,
  shape: 'default' | 'star',
) {
  if (shape === 'star') {
    const star = starIcon(place.color, active);
    return {
      url: star.url,
      scaledSize: new g.Size(star.box, star.box),
      anchor: new g.Point(star.center, star.center),
      labelOrigin: new g.Point(star.center, star.center),
    };
  }

  const made = pinIcon(place.color, active, place.detail.visited, !!place.emoji);

  if (place.emoji) {
    return {
      url: made.url,
      scaledSize: new g.Size(made.box, made.box),
      anchor: new g.Point(made.anchor, made.anchor),
      labelOrigin: new g.Point(made.center, made.center),
    };
  }

  /* 물방울은 그린 크기 그대로 씁니다. 늘리거나 줄이면 상자와 그림의 비율이
     어긋나 번호가 가운데를 벗어납니다. 고른 것만 조금 키웁니다. */
  const scale = active ? 1.22 : 1;
  const w = 40 * scale;
  const h = 52 * scale;
  return {
    url: made.url,
    scaledSize: new g.Size(w, h),
    anchor: new g.Point(w / 2, h),
    labelOrigin: new g.Point(w / 2, 18 * scale),
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
  link = true,
  bottomInset = 0,
  goHereAt,
  fitAt,
  shape = 'default',
  panTo,
  myFace,
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
      /* 나도 동행자와 같은 방식으로 그립니다. 나만 점으로 두면 지도에서
         내가 어디 있는지를 다른 규칙으로 찾아야 합니다. */
      icon: personIcon(Colors.accentInk),
      label: myFace ? { text: myFace, fontSize: '16px', fontWeight: '700' } : undefined,
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
        icon: markerIcon(g, p, false, shape),
        label: pinLabel(p, p.detail.visited, false, shape),
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
    } else if (link) {
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
      /* 아래를 판이 덮고 있으면 그만큼 여백을 더 줍니다. 안 그러면 아래쪽
         핀들이 판 뒤로 들어갑니다. */
      map.current.fitBounds(bounds, {
        top: 48,
        right: 40,
        bottom: 40 + bottomInset,
        left: 40,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, places, routes, link]);

  /*
    동행자와 임시 핀.

    장소 핀과 따로 그립니다. 일정에 넣어 둔 곳과 "지금 저기 있다" 는 성격이
    다른데, 같은 모양으로 두면 지도만 보고는 구별이 안 됩니다.
  */
  const mateMarks = useRef<any[]>([]);
  /*
    이미 본 깃발.

    새로 꽂힌 것만 떨어뜨립니다. 전부 떨어뜨리면 이십 초마다 지도의 깃발이
    다 같이 튀어, 무엇이 방금 생긴 것인지 알 수 없습니다.

    처음 화면을 열 때는 아무것도 떨어뜨리지 않습니다. 여섯 시간 전에 꽂아 둔
    것까지 방금 생긴 것처럼 보일 이유가 없습니다.
  */
  const seenNotes = useRef<Set<string> | null>(null);

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
          /* 고른 동물, 안 골랐으면 이름 첫 글자. 첫 글자만으로는 "지영" 과
             "지훈" 이 지도에서 같아 보입니다. */
          label: { text: mate.face, fontSize: '16px', fontWeight: '700' },
          icon: personIcon(Colors.success),
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
          /* 꽂는 단추가 깃발인데 지도에는 네모가 찍히고 있었습니다. 누른
             것과 찍힌 것이 다르면 그것이 그것인 줄 알 수가 없습니다. */
          icon: flagIcon(g, Colors.warning),
          /* 방금 꽂힌 것만 위에서 떨어집니다. 내가 꽂은 것도, 동행자가 꽂은
             것도 마찬가지라 "저기 뭔가 생겼다" 가 눈에 들어옵니다. */
          animation: seenNotes.current && !seenNotes.current.has(note.id)
            ? g.Animation.DROP
            : undefined,
        }),
      );
    }

    seenNotes.current = new Set((notes ?? []).map((n) => n.id));
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
    /* 아래가 판에 덮여 있으면 그만큼 위로. 내 자리도 판 뒤로 들어가면
       "눌렀는데 아무 일도 안 일어난다" 가 됩니다. */
    if (bottomInset > 0) {
      map.current.panBy(0, bottomInset / 2);
    }
  }, [here, bottomInset]);

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
      marker.setIcon(markerIcon(g, p, active, shape));
      marker.setLabel(pinLabel(p, p.detail.visited, active, shape));
      marker.setZIndex(active ? 999 : 100 + p.order);
    });
    const chosen = places.find((p) => p.id === activeId);
    if (chosen && map.current) {
      map.current.panTo({ lat: chosen.lat, lng: chosen.lng });
      if ((map.current.getZoom() ?? 0) < FOCUS_ZOOM) {
        map.current.setZoom(FOCUS_ZOOM);
      }
      /*
        화면 한가운데는 판에 덮여 있습니다. 그대로 두면 고른 곳이 판 뒤로
        들어가, 눌렀는데 아무 데도 안 간 것처럼 보입니다. 덮인 높이의 절반만큼
        위로 올려 보이는 곳의 한가운데에 놓습니다.
      */
      if (bottomInset > 0) {
        map.current.panBy(0, bottomInset / 2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /*
    바깥에서 "내 위치로" 를 눌렀을 때.

    단추는 지도 밖(일정 화면)에 있고 지도를 옮기는 것은 여기입니다. 값이
    바뀌기만 하면 움직입니다 — 같은 자리를 두 번 눌러도 두 번 다 가야 하므로
    자리가 아니라 "눌렀다" 는 것만 넘겨받습니다.
  */
  useEffect(() => {
    if (goHereAt) {
      goHere();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goHereAt]);

  /** 일정에 없는 자리로 옮깁니다. 꽂아 둔 깃발처럼 고를 id 가 없는 것들. */
  useEffect(() => {
    if (!panTo || !ready || !map.current) {
      return;
    }
    map.current.panTo({ lat: panTo.lat, lng: panTo.lng });
    if ((map.current.getZoom() ?? 0) < FOCUS_ZOOM) {
      map.current.setZoom(FOCUS_ZOOM);
    }
    if (bottomInset > 0) {
      map.current.panBy(0, bottomInset / 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panTo?.at]);

  /** 넣어 둔 곳을 모두 한 화면에. 바깥에서 부릅니다. */
  useEffect(() => {
    if (!fitAt || !ready || !map.current || places.length === 0) {
      return;
    }
    const g = gmaps();
    const bounds = new g.LatLngBounds();
    places.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.current.fitBounds(bounds, {
      top: 48,
      right: 40,
      bottom: 40 + bottomInset,
      left: 40,
    });
    /* 다음에 또 부르면 다시 맞춰야 하므로, 이 자리를 기억해 두지 않습니다. */
    fitted.current = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitAt]);

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
