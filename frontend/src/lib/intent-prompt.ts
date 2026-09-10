import { PLACE_ICONS } from '@/constants/place-icons';
import type { Intent } from '@/lib/intent-types';

/**
 * 모델에게 시키는 말과, 그 답을 읽는 법.
 *
 * <p>웹과 앱이 같은 것을 씁니다. 같은 문장을 두 곳에 적어 두면 한쪽만
 * 고쳤을 때 폰과 브라우저가 다르게 답하기 시작하는데, 그건 찾기 아주
 * 어려운 종류의 어긋남입니다.
 */

/**
 * 문장을 쪼개라는 지시.
 *
 * <p>갈래 목록을 손으로 다시 적지 않습니다. 화면이 쓰는 그 목록에서 그대로
 * 만듭니다 — 갈래를 하나 더하는 날 프롬프트만 옛것으로 남는 일이 없습니다.
 */
export const PROMPT = [
  '너는 여행 앱의 검색 도우미다. 사용자의 한국어 문장을 검색 인자로 쪼갠다.',
  '답은 JSON 한 개만 출력한다. 설명·인사·코드블록을 붙이지 않는다.',
  '모양: {"locationQuery": string|null, "category": string|null, "keyword": string|null}',
  `category 는 다음 중 하나이거나 null: ${PLACE_ICONS.map((k) => k.key).join(', ')}`,
  'locationQuery 는 문장에 지명이 있을 때만 채운다. 없으면 null.',
  'keyword 는 "조용한", "아이랑", "비 올 때" 처럼 꾸미는 말만 짧게.',
  '모르면 null 을 넣는다. 지어내지 않는다.',
].join('\n');

/**
 * 몇 마디 보여 주기.
 *
 * <p>작은 모델은 설명보다 예를 훨씬 잘 따릅니다. 둘이면 충분하고, 더 붙이면
 * 그만큼 매번 다시 읽어야 해서 느려집니다.
 */
export const SHOTS: { role: 'user' | 'assistant'; content: string }[] = [
  { role: 'user', content: '오사카에서 비 올 때 갈 만한 실내' },
  { role: 'assistant', content: '{"locationQuery":"오사카","category":"art","keyword":"실내"}' },
  { role: 'user', content: '첫날 저녁에 셋이서 조용히 술 한잔' },
  { role: 'assistant', content: '{"locationQuery":null,"category":"bar","keyword":"조용한"}' },
];

/**
 * 답의 모양.
 *
 * <p>브라우저 쪽 두 길은 이것을 문법으로 못박을 수 있습니다 — 모델이 말을
 * 덧붙이고 싶어도 못 합니다. 앱(ExecuTorch)에는 그 기능이 없어서 뱉은 글에서
 * 중괄호를 발라내는데, 그래서 {@link readIntent} 가 두 경우를 다 견딥니다.
 */
export const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    locationQuery: { type: ['string', 'null'] },
    category: { type: ['string', 'null'], enum: [...PLACE_ICONS.map((k) => k.key), null] },
    keyword: { type: ['string', 'null'] },
  },
  required: ['locationQuery', 'category', 'keyword'],
  additionalProperties: false,
} as const;

/**
 * 모델이 뱉은 것을 읽습니다.
 *
 * <p>모양이 강제된 쪽에서는 그냥 JSON 이고, 아닌 쪽에서는 "```json" 이
 * 둘려 있거나 앞에 한마디가 붙어 있습니다. 중괄호 안쪽만 잘라 내면 그
 * 대부분이 살아납니다.
 *
 * <p>그래도 안 되면 <code>null</code>. 화면은 그때 문장을 그대로 보냅니다 —
 * 즉 맥락 추천으로 미끄러집니다. 모델이 헛소리를 해도 사람이 보는 것은
 * 조금 덜 맞는 추천이지 오류 화면이 아닙니다.
 */
export function readIntent(raw: string): Intent | null {
  const from = raw.indexOf('{');
  const to = raw.lastIndexOf('}');
  if (from < 0 || to <= from) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(from, to + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const got = parsed as Record<string, unknown>;
  const made: Intent = {
    locationQuery: text(got.locationQuery),
    category: text(got.category),
    keyword: text(got.keyword),
  };

  /* 셋 다 비었으면 쪼갠 것이 아닙니다. 그럴 바에는 문장을 그대로 보내는
     편이 낫습니다. */
  if (!made.locationQuery && !made.category && !made.keyword) {
    return null;
  }
  return made;
}

/**
 * 값 하나를 다듬습니다.
 *
 * <p>모델은 빈칸 대신 "null" 이나 "없음" 같은 글자를 넣기도 합니다. 그것이
 * 그대로 검색어에 섞이면 뜻 없는 낱말이 하나 더 붙습니다.
 *
 * <p>길이도 여기서 자릅니다. 서버가 다시 한 번 자르지만, 쓸데없이 긴 것을
 * 실어 보낼 이유가 없습니다.
 */
function text(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === '없음' || trimmed === 'none') {
    return null;
  }
  return trimmed.slice(0, 60);
}
