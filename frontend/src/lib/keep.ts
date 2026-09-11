import type { TripDetail } from '@/api/types';
import { ago } from '@/lib/countdown';

/**
 * 마지막으로 본 일정을 이 기기에 둡니다.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>길 위에서 데이터가 안 터지면 일정이 통째로 안 보였습니다. 지하철,
 * 산속, 로밍이 끊긴 순간. 정작 일정이 가장 필요한 자리가 그런 데입니다.
 * 종이로 뽑아 두는 길을 만들어 뒀지만, 그건 미리 뽑아 둔 사람만 씁니다.
 *
 * <h3>서비스 워커에 맡기지 않습니다</h3>
 *
 * <p>워커가 API 응답을 담아 두면 로그인한 사람마다 다른 것이 오는데, 한 번
 * 담아 두면 <b>다음 사람에게 남의 것이 보일 수 있습니다.</b> 그래서 워커는
 * /api/ 를 절대 담지 않습니다(public/sw.js).
 *
 * <p>여기서 하는 것은 그것과 다릅니다. 사람 번호를 열쇠에 넣어 두고, 로그아웃
 * 할 때 지웁니다. 담기는 것도 "지금 이 사람이 방금 본 그 여행" 하나뿐입니다.
 *
 * <h3>글자만으로는 모자랐습니다</h3>
 *
 * <p>담기는 것이 일정의 <b>글자</b>뿐이었습니다. 안 터지는 골목에서 장소
 * 이름과 시각은 보이는데, 정작 "오늘 이 동네를 이렇게 돈다" 는 그림만
 * 사라졌습니다 — 화면의 지도는 살아 있는 지도라 그릴 때마다 구글을
 * 부릅니다. 그래서 한 장짜리 그림을 함께 담습니다.
 *
 * <h3>보여 줄 때는 말해 줍니다</h3>
 *
 * <p>저장해 둔 것을 새것인 양 보여 주면, 동행자가 어제 고친 것을 못 본 채로
 * 옛 가게에 갑니다. 화면이 "지금은 저장해 둔 것" 이라고 밝힙니다.
 */

/**
 * 이 기기에 담아 둘 수 있는지.
 *
 * <p>부르는 쪽이 미리 물어볼 수 있게 열어 둡니다. 동선 그림은 담을 수
 * 있을 때만 받아 옵니다 — 담지도 못하면서 받아 오면 구글을 한 번 더
 * 부르고 그대로 버리는 셈입니다.
 */
export function canKeep() {
  return box() !== null;
}

/** 웹에만 있습니다. 앱에는 localStorage 가 없어 조용히 넘어갑니다. */
function box(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    /* 사파리의 사생활 보호 모드처럼 있는데 못 쓰는 경우가 있습니다. */
    return null;
  }
}

const PREFIX = 'fit.trip.';

/**
 * 동선 그림은 따로 둡니다.
 *
 * <p>일정 글자에 묶어 두면 장소를 하나 고칠 때마다 수십 KB 짜리 그림을
 * 함께 다시 씁니다. 그림은 그것대로 늙고 일정은 일정대로 새것이라, 수명이
 * 다른 둘을 한 열쇠에 묶을 이유가 없습니다.
 */
const MAP_PREFIX = 'fit.tripmap.';

function keyOf(userId: string, tripId: string) {
  return `${PREFIX}${userId}.${tripId}`;
}

function mapKeyOf(userId: string, tripId: string) {
  return `${MAP_PREFIX}${userId}.${tripId}`;
}

/** 방금 받아 온 일정을 둡니다. 실패해도 조용합니다 — 곁다리 기능입니다. */
export function keepTrip(userId: string | null, tripId: string, data: TripDetail) {
  const store = box();
  if (!store || !userId) {
    return;
  }
  const key = keyOf(userId, tripId);
  const row = JSON.stringify({ at: Date.now(), data });
  if (write(store, key, row)) {
    return;
  }
  /* 자리가 꽉 찼습니다. 그림부터 버립니다 — 그림이 없으면 아쉬운 정도지만
     일정 글자가 없으면 오늘 어디를 가는지 모릅니다. */
  forgetOld(store, MAP_PREFIX);
  if (write(store, key, row)) {
    return;
  }
  /* 그래도 모자라면 오래 안 본 여행을 놓습니다. 인터넷이 있으면 어차피
     다시 받아 옵니다. */
  forgetOld(store, PREFIX);
  write(store, key, row);
}

/** 담아 봅니다. 자리가 없으면 false — 던지지 않습니다. */
function write(store: Storage, key: string, value: string) {
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** 저장해 둔 것. 없으면 null. */
export function keptTrip(
  userId: string | null,
  tripId: string,
): { at: number; data: TripDetail } | null {
  const store = box();
  if (!store || !userId) {
    return null;
  }
  try {
    const raw = store.getItem(keyOf(userId, tripId));
    return raw ? (JSON.parse(raw) as { at: number; data: TripDetail }) : null;
  } catch {
    return null;
  }
}

/**
 * 동선 그림 한 장을 둡니다.
 *
 * <p>담는 것은 <code>data:</code> 주소입니다. 안 터지는 자리에서는 우리
 * 서버도 못 부르므로 주소만 들고 있어 봐야 소용이 없습니다.
 *
 * <p>자리가 꽉 차면 그림부터 버립니다. 일정 글자가 먼저입니다 — 그림이
 * 없으면 아쉬운 정도지만 글자가 없으면 오늘 어디를 가는지 모릅니다.
 */
export function keepTripMap(userId: string | null, tripId: string, png: string) {
  const store = box();
  if (!store || !userId) {
    return;
  }
  const key = mapKeyOf(userId, tripId);
  const row = JSON.stringify({ at: Date.now(), png });
  if (!write(store, key, row)) {
    forgetOld(store, MAP_PREFIX);
    /* 그래도 안 되면 포기합니다. 그림은 없어도 일정은 보입니다. */
    write(store, key, row);
  }
}

/** 담아 둔 동선 그림. 없으면 null. */
export function keptTripMap(
  userId: string | null,
  tripId: string,
): { at: number; png: string } | null {
  const store = box();
  if (!store || !userId) {
    return null;
  }
  try {
    const raw = store.getItem(mapKeyOf(userId, tripId));
    return raw ? (JSON.parse(raw) as { at: number; png: string }) : null;
  } catch {
    return null;
  }
}

/**
 * 로그아웃할 때 이 기기에서 전부 지웁니다.
 *
 * <p>남의 폰을 빌려 잠깐 로그인하는 일이 있습니다. 나간 뒤에 내 일정이
 * 그 폰에 남아 있으면 안 됩니다.
 */
export function forgetTrips() {
  const store = box();
  if (!store) {
    return;
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && (key.startsWith(PREFIX) || key.startsWith(MAP_PREFIX))) {
        keys.push(key);
      }
    }
    keys.forEach((k) => store.removeItem(k));
  } catch {
    /* 못 지웠으면 다음 로그아웃 때 다시 해 봅니다. */
  }
}

/**
 * 자리가 모자랄 때 오래된 것부터 치웁니다.
 *
 * <p>브라우저의 저장 자리는 5MB 남짓이라, 여행을 여럿 열어 보면 언젠가
 * 찹니다. 오래 안 본 것은 이미 다녀온 여행일 가능성이 큽니다.
 *
 * @param prefix 어느 쪽을 치울지. 그림과 일정을 따로 치웁니다 — 자리가
 *               모자랄 때 먼저 놓아야 하는 것은 그림입니다.
 */
function forgetOld(store: Storage, prefix: string) {
  try {
    const rows: { key: string; at: number }[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(prefix)) {
        continue;
      }
      const raw = store.getItem(key);
      const at = raw ? (JSON.parse(raw) as { at?: number }).at : 0;
      rows.push({ key, at: at ?? 0 });
    }
    rows
      .sort((a, b) => a.at - b.at)
      .slice(0, Math.max(1, Math.floor(rows.length / 2)))
      .forEach((r) => store.removeItem(r.key));
  } catch {
    /* 읽다 실패하면 그냥 둡니다. */
  }
}

/** 저장한 지 얼마나 됐는지, 사람이 읽는 말로. */
export function keptAgo(at: number) {
  return ago(at);
}
