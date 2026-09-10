import type { TripDetail } from '@/api/types';

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
 * <h3>보여 줄 때는 말해 줍니다</h3>
 *
 * <p>저장해 둔 것을 새것인 양 보여 주면, 동행자가 어제 고친 것을 못 본 채로
 * 옛 가게에 갑니다. 화면이 "지금은 저장해 둔 것" 이라고 밝힙니다.
 */

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

function keyOf(userId: string, tripId: string) {
  return `${PREFIX}${userId}.${tripId}`;
}

/** 방금 받아 온 일정을 둡니다. 실패해도 조용합니다 — 곁다리 기능입니다. */
export function keepTrip(userId: string | null, tripId: string, data: TripDetail) {
  const store = box();
  if (!store || !userId) {
    return;
  }
  try {
    store.setItem(keyOf(userId, tripId), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* 자리가 꽉 찼습니다. 오래된 것을 치우고 한 번만 더 해 봅니다. */
    forgetOld(store);
    try {
      store.setItem(keyOf(userId, tripId), JSON.stringify({ at: Date.now(), data }));
    } catch {
      /* 그래도 안 되면 포기합니다. 인터넷이 있으면 어차피 안 씁니다. */
    }
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
      if (key && key.startsWith(PREFIX)) {
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
 */
function forgetOld(store: Storage) {
  try {
    const rows: { key: string; at: number }[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(PREFIX)) {
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
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 60) {
    return `${minutes}분 전`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : `${Math.round(hours / 24)}일 전`;
}
