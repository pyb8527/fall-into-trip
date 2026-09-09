/**
 * 지도에서 사람을 가리키는 그림.
 *
 * <p>동행자 위치를 이름 첫 글자를 적은 동그라미로 그리고 있었습니다. 이름이
 * "지영" 이든 "지훈" 이든 지도에는 똑같이 "지" 하나만 뜹니다. 누가 어디 있는지
 * 보라고 켠 것인데 정작 누구인지가 안 보였습니다.
 *
 * <p>동물로 둔 것은 서로 헷갈리지 않게 하기 위해서입니다. 도형이나 색은 열
 * 개만 넘어가도 구별이 안 되지만, 토끼와 곰은 아무리 작게 그려도 다릅니다.
 *
 * <p>서버는 짧은 이름("rabbit")만 저장합니다. 어떤 그림을 그릴지는 여기서만
 * 정합니다 — 이모지를 저장해 버리면 나중에 바꾸고 싶을 때 쌓인 값을 전부
 * 고쳐야 합니다. 서버의 UserMark.ALL 과 같은 순서로 두었습니다.
 */
export type UserMark = {
  key: string;
  emoji: string;
  label: string;
};

export const USER_MARKS: UserMark[] = [
  { key: 'rabbit', emoji: '🐰', label: '토끼' },
  { key: 'bear', emoji: '🐻', label: '곰' },
  { key: 'cat', emoji: '🐱', label: '고양이' },
  { key: 'dog', emoji: '🐶', label: '강아지' },
  { key: 'fox', emoji: '🦊', label: '여우' },
  { key: 'panda', emoji: '🐼', label: '판다' },
  { key: 'koala', emoji: '🐨', label: '코알라' },
  { key: 'tiger', emoji: '🐯', label: '호랑이' },
  { key: 'penguin', emoji: '🐧', label: '펭귄' },
  { key: 'chick', emoji: '🐥', label: '병아리' },
  { key: 'frog', emoji: '🐸', label: '개구리' },
  { key: 'whale', emoji: '🐳', label: '고래' },
  { key: 'octopus', emoji: '🐙', label: '문어' },
  { key: 'unicorn', emoji: '🦄', label: '유니콘' },
  { key: 'monkey', emoji: '🐵', label: '원숭이' },
  { key: 'hedgehog', emoji: '🦔', label: '고슴도치' },
];

const BY_KEY = new Map(USER_MARKS.map((m) => [m.key, m]));

/**
 * 그림 하나. 안 골랐거나 모르는 이름이면 빈 문자열입니다.
 *
 * <p>빈 값을 받은 쪽은 이름 첫 글자로 그립니다. 아무 동물이나 대신 채워 넣으면
 * 골라 둔 사람과 안 고른 사람이 지도에서 구별되지 않습니다.
 */
export function markOf(key: string | null | undefined): string {
  return (key && BY_KEY.get(key)?.emoji) || '';
}

/**
 * 지도에 찍을 것. 그림을 안 골랐으면 이름 첫 글자입니다.
 *
 * <p>첫 글자만으로는 동명이인을 못 가리지만, 아무것도 없는 것보다는 낫습니다.
 * 그림을 고르라고 떠미는 대신 고른 사람만 확실히 구별되게 둡니다.
 */
export function faceOf(mark: string | null | undefined, name: string): string {
  return markOf(mark) || (name ? name.slice(0, 1) : '?');
}
