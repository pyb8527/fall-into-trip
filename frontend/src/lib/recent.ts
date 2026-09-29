import { keepBox } from '@/lib/keep-box';

/**
 * 최근에 찾아본 말.
 *
 * <h3>왜 기기에 두는가</h3>
 *
 * <p>서버에 쌓으면 <b>누가 무엇을 찾아봤는지</b>가 우리 쪽에 남습니다. 그것은
 * 여행을 짜는 데 쓰이지 않는 값이고, 남겨 두면 언젠가 지켜야 할 것이 됩니다.
 * 이 기기에서 이 기기로만 씁니다.
 *
 * <h3>여덟 개까지</h3>
 *
 * <p>스무 개를 쌓아 두면 그것을 훑는 것이 다시 일이 됩니다. 되짚어 찾는 것은
 * 대개 방금 것이라 여덟이면 넉넉합니다.
 */
const KEY = 'fit.recent.search';
const MAX = 8;

export function recentSearches(): string[] {
  try {
    /* 담을 자리가 아예 없는 기기도 있습니다(꽉 찼거나, 사생활 보호 창).
       그때는 최근 검색이 없는 것으로 봅니다 — 찾는 일 자체는 그대로 됩니다. */
    const raw = keepBox()?.getItem(KEY) ?? null;
    if (!raw) {
      return [];
    }
    const got = JSON.parse(raw);
    return Array.isArray(got) ? got.filter((w): w is string => typeof w === 'string') : [];
  } catch {
    /* 담아 둔 것이 깨져 있어도 화면은 돕니다. 없는 것으로 봅니다. */
    return [];
  }
}

/**
 * 방금 찾은 말을 맨 앞에 둡니다.
 *
 * <p>같은 말을 다시 찾으면 자리만 옮깁니다 — 아래에 같은 말이 둘 있으면
 * 되짚어 찾는 데 방해만 됩니다.
 */
export function remember(word: string): string[] {
  const clean = word.trim();
  if (!clean) {
    return recentSearches();
  }
  const next = [clean, ...recentSearches().filter((w) => w !== clean)].slice(0, MAX);
  write(next);
  return next;
}

export function forgetAll(): string[] {
  write([]);
  return [];
}

function write(words: string[]) {
  try {
    keepBox()?.setItem(KEY, JSON.stringify(words));
  } catch {
    /* 담을 자리가 없으면 안 담습니다. 찾는 일 자체는 그대로 됩니다. */
  }
}
