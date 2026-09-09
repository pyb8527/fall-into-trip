/**
 * 핀에 찍히는 그림.
 *
 * <p>서버는 짧은 이름("ramen")만 저장합니다. 어떤 그림을 그릴지는 여기서만
 * 정합니다 — 이모지를 저장해 버리면 나중에 그림을 바꾸고 싶을 때 쌓인 값을
 * 전부 고쳐야 합니다.
 *
 * <p>목록 순서가 곧 고르는 화면에 늘어놓는 순서입니다. 자주 쓰는 것이 앞에
 * 옵니다. 서버의 PlaceKind.ALL 과 같은 순서로 두었습니다.
 */
export type PlaceIcon = {
  /** 서버에 저장되는 이름 */
  key: string;
  /** 지도에 그려지는 그림 */
  emoji: string;
  /** 고르는 화면에 적히는 말. 그림만 스무 개 늘어놓으면 뜻을 짐작해야 합니다. */
  label: string;
};

export const PLACE_ICONS: PlaceIcon[] = [
  { key: 'food', emoji: '🍽️', label: '밥' },
  { key: 'cafe', emoji: '☕', label: '카페' },
  { key: 'ramen', emoji: '🍜', label: '면' },
  { key: 'sushi', emoji: '🍣', label: '초밥·회' },
  { key: 'meat', emoji: '🥩', label: '고기' },
  { key: 'dessert', emoji: '🍰', label: '디저트' },
  { key: 'bar', emoji: '🍺', label: '술' },
  { key: 'shop', emoji: '🛍️', label: '쇼핑' },
  { key: 'sight', emoji: '⛩️', label: '명소' },
  { key: 'nature', emoji: '🌿', label: '자연' },
  { key: 'onsen', emoji: '♨️', label: '온천' },
  { key: 'stay', emoji: '🛏️', label: '숙소' },
  { key: 'move', emoji: '🚉', label: '역·공항' },
  { key: 'park', emoji: '🎡', label: '놀이공원' },
  { key: 'art', emoji: '🖼️', label: '미술관' },
  { key: 'show', emoji: '🎫', label: '공연' },
];

const BY_KEY = new Map(PLACE_ICONS.map((i) => [i.key, i]));

/**
 * 그림 하나. 모르는 이름이거나 비어 있으면 빈 문자열입니다.
 *
 * <p>빈 값을 받은 쪽은 번호만 찍힌 원래 핀을 그립니다. 아무거나 채워 넣으면
 * 골라 둔 것과 짐작한 것이 지도에서 구별되지 않습니다.
 */
export function iconOf(key: string | null | undefined): string {
  return (key && BY_KEY.get(key)?.emoji) || '';
}

export function labelOf(key: string | null | undefined): string {
  return (key && BY_KEY.get(key)?.label) || '';
}
