import type { SavedPlace } from '@/api/types';
import { sortPlaces, type SortBy } from '@/components/sort-bar';
import { PLACE_ICONS, labelOf } from '@/constants/place-icons';

/**
 * 보석함에서 찾아 고르는 일.
 *
 * <h3>왜 따로 빼는가</h3>
 *
 * <p>담아 둔 곳을 고르는 자리가 둘이 되었습니다 — 보석함 화면과, 여행
 * 상세에서 하루에 꺼내 넣는 판. 둘은 생김새가 다르지만 <b>무엇을 보여
 * 줄지</b> 고르는 규칙은 같아야 합니다. 한쪽에서만 메모로 찾아지고 다른
 * 쪽에서는 안 찾아지면, 쓰는 사람은 그것을 기능의 차이가 아니라 고장으로
 * 읽습니다.
 */

/** 거르는 조건. 비워 두면 안 거릅니다. */
export type Sift = {
  /** 이름·메모·갈래에서 찾는 말 */
  q: string;
  /** 갈래 이름. null 이면 전부 */
  kind: string | null;
  by: SortBy;
};

/**
 * 담아 둔 것에 <b>실제로 있는</b> 갈래만.
 *
 * <p>열여섯 개를 다 늘어놓으면 대부분 눌러도 아무것도 안 걸립니다. 누를 수
 * 있는 것과 누를 것이 없는 것이 똑같이 생겨 있으면 하나씩 눌러 보게 됩니다.
 */
export function kindsIn(all: SavedPlace[]) {
  const have = new Set(all.map((p) => p.icon).filter((k): k is string => !!k));
  return PLACE_ICONS.filter((k) => have.has(k.key));
}

/**
 * 거르고 세웁니다.
 *
 * <p>메모와 갈래까지 함께 봅니다 — "부산 갔을 때 그 국밥집" 처럼 이름은
 * 기억나지 않고 메모만 기억나는 일이 있습니다. 갈래는 저장된 이름("ramen")
 * 이 아니라 화면에 적히는 말("면")로 찾습니다. 쓰는 사람이 보는 것은 그쪽
 * 이고, 영어 이름은 어디에도 안 적혀 있습니다.
 */
export function siftSaved(all: SavedPlace[], { q, kind, by }: Sift): SavedPlace[] {
  const byKind = kind === null ? all : all.filter((p) => p.icon === kind);
  const needle = q.trim().toLowerCase();
  const found = !needle
    ? byKind
    : byKind.filter((p) =>
        [p.name, p.cat, p.note, labelOf(p.icon)]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle)),
      );
  return sortPlaces(found, by);
}

/**
 * 담은 지 얼마나 됐는지, 사람이 읽는 말로.
 *
 * <p>보석함에는 순서가 없지만 <b>나이</b>는 있습니다. 어제 담은 것과 재작년에
 * 담은 것이 똑같이 생겨 있으면, 한 화면에 쌓인 것들 중 어느 것이 지금 짜는
 * 여행과 상관있는지 알 수 없습니다.
 */
export function savedAgo(createdAt: string): string {
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) {
    return '';
  }
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) {
    return '오늘 담음';
  }
  if (days === 1) {
    return '어제 담음';
  }
  if (days < 30) {
    return `${days}일 전 담음`;
  }
  const months = Math.round(days / 30);
  return months < 12 ? `${months}달 전 담음` : `${Math.round(months / 12)}년 전 담음`;
}
