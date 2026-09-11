import type { Booking } from '@/lib/intent-types';

/**
 * 예약 확인서를 칸으로 쪼개라는 지시와, 그 답을 읽는 법.
 *
 * <p>웹과 앱이 같은 것을 씁니다. 같은 문장을 두 곳에 적어 두면 한쪽만
 * 고쳤을 때 폰과 브라우저가 다르게 답하기 시작하는데, 그건 찾기 아주
 * 어려운 종류의 어긋남입니다.
 *
 * <p><b>추천 쪽({@code intent-prompt.ts})과 파일을 나눕니다.</b> 한 파일에 두
 * 프롬프트를 넣으면 한쪽을 고칠 때 다른 쪽이 조용히 달라집니다.
 */

/**
 * 뽑아 오라는 지시.
 *
 * <p>다섯 칸입니다. 추천은 셋이었고 문장도 한 줄이었는데, 이쪽은 메일 한
 * 통에서 흩어진 값을 찾아내는 일이라 더 어렵습니다. 그래서 "지어내지
 * 않는다" 를 두 번 말합니다 — 작은 모델은 빈칸을 싫어해서 그럴듯한 것을
 * 채워 넣습니다.
 */
export const PROMPT = [
  '너는 여행 앱의 예약 확인서 정리 도우미다. 붙여 넣은 글에서 값을 뽑는다.',
  '답은 JSON 한 개만 출력한다. 설명·인사·코드블록을 붙이지 않는다.',
  '모양: {"kind": "stay"|"flight"|null, "stayName": string|null, "stayNote": string|null, "flight": string|null, "iso": string|null}',
  'kind 는 이 글이 숙소 예약이면 "stay", 항공권이면 "flight". 둘 다 아니면 null.',
  'stayName 은 호텔·숙소의 이름만. 지점명까지 있으면 함께.',
  'stayNote 는 체크인 시각과 방 번호처럼 그날 필요한 것만 짧게. 예약번호·전화번호·이름은 넣지 않는다.',
  'flight 는 "편명 시각 출발지 → 도착지" 모양으로 한 줄.',
  'iso 는 그 예약의 날짜를 YYYY-MM-DD 로. 며칠에 걸치면 시작하는 날.',
  '글에 없는 것은 null 을 넣는다. 지어내지 않는다. 짐작하지 않는다.',
].join('\n');

/**
 * 몇 마디 보여 주기.
 *
 * <p>넷입니다. 추천은 둘로 충분했지만 여기는 갈래가 둘(숙소·항공)이라 각각
 * 하나씩은 보여 줘야 합니다. 더 붙이면 그만큼 매번 다시 읽어야 해서
 * 느려집니다.
 *
 * <p>보기 안에 예약번호와 전화번호를 일부러 섞어 두었습니다. 뽑지 <b>않는</b>
 * 것을 보여 주는 편이 "넣지 마라" 라고 말하는 것보다 잘 듣습니다.
 */
export const SHOTS: { role: 'user' | 'assistant'; content: string }[] = [
  {
    role: 'user',
    content: [
      '[예약 확정] 호텔 그란비아 오사카',
      '예약번호 GR-8842193 / 예약자 박여행',
      '체크인 2026-03-04 15:00 · 체크아웃 2026-03-06 11:00',
      '디럭스 트윈 305호 · 문의 06-6344-1235',
    ].join('\n'),
  },
  {
    role: 'assistant',
    content:
      '{"kind":"stay","stayName":"호텔 그란비아 오사카","stayNote":"체크인 15:00 · 305호","flight":null,"iso":"2026-03-04"}',
  },
  {
    role: 'user',
    content: [
      'e-티켓 확인서 / 아시아나항공',
      'OZ112 2026년 3월 4일 09:20 인천(ICN) T1 → 간사이(KIX)',
      '예약번호 ABCDEF · 좌석 32A',
    ].join('\n'),
  },
  {
    role: 'assistant',
    content:
      '{"kind":"flight","stayName":null,"stayNote":null,"flight":"OZ112 09:20 인천 T1 → 간사이","iso":"2026-03-04"}',
  },
];

/**
 * 답의 모양.
 *
 * <p>브라우저 쪽 두 길은 이것을 문법으로 못박을 수 있습니다 — 모델이 말을
 * 덧붙이고 싶어도 못 합니다. 앱(ExecuTorch)에는 그 기능이 없어서 뱉은 글에서
 * 중괄호를 발라내는데, 그래서 {@link readBooking} 이 두 경우를 다 견딥니다.
 */
export const BOOKING_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: ['string', 'null'], enum: ['stay', 'flight', null] },
    stayName: { type: ['string', 'null'] },
    stayNote: { type: ['string', 'null'] },
    flight: { type: ['string', 'null'] },
    iso: { type: ['string', 'null'] },
  },
  required: ['kind', 'stayName', 'stayNote', 'flight', 'iso'],
  additionalProperties: false,
} as const;

/**
 * 모델이 뱉은 것을 읽습니다.
 *
 * <p>모양이 강제된 쪽에서는 그냥 JSON 이고, 아닌 쪽에서는 "```json" 이
 * 둘려 있거나 앞에 한마디가 붙어 있습니다. 중괄호 안쪽만 잘라 내면 그
 * 대부분이 살아납니다.
 *
 * <p>그래도 안 되면 <code>null</code>. 화면은 그때 "읽지 못했습니다" 한 줄을
 * 내고 칸을 그대로 둡니다 — <b>서버로 보내지 않습니다.</b> 붙여 넣은 글에는
 * 이름·예약번호·카드 뒷자리가 들어 있습니다. 추천과 갈리는 자리입니다.
 */
export function readBooking(raw: string): Booking | null {
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
  const made: Booking = {
    kind: kindOf(got.kind),
    stayName: text(got.stayName, 120),
    stayNote: text(got.stayNote, 200),
    flight: text(got.flight, 200),
    iso: isoOf(got.iso),
  };

  /* 채울 것이 하나도 없으면 읽은 것이 아닙니다. kind 만 맞히고 나머지를 다
     비워 오는 일이 있는데, 그것으로는 칸을 채울 수 없습니다. */
  if (!made.stayName && !made.stayNote && !made.flight) {
    return null;
  }
  return made;
}

/** 갈래는 둘 중 하나이거나 없음입니다. 모델이 딴 말을 하면 없는 것으로 봅니다. */
function kindOf(value: unknown): Booking['kind'] {
  return value === 'stay' || value === 'flight' ? value : null;
}

/**
 * 날짜는 모양이 맞을 때만 받습니다.
 *
 * <p>이 값으로 "3월 4일 예약으로 읽혔습니다" 를 말할 참인데, 모양이 어긋난
 * 것을 그대로 띄우면 사람이 그 말을 못 믿게 됩니다. 있을 수 없는 날짜
 * (2026-02-31)도 여기서 걸립니다.
 */
function isoOf(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  /* UTC 로 세웁니다. 그냥 new Date("2026-03-04T00:00:00") 는 이 기기의
     시간대로 읽히는데, 서울(+9)에서는 되돌릴 때 하루가 밀려 멀쩡한 날짜가
     전부 거절됩니다. 여기서 보려는 것은 시각이 아니라 "있는 날인가" 뿐이라
     한 시계에서만 셈하면 됩니다. */
  const [y, m, d] = value.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d
    ? value
    : null;
}

/**
 * 값 하나를 다듬습니다.
 *
 * <p>모델은 빈칸 대신 "null" 이나 "없음" 같은 글자를 넣기도 합니다. 그것이
 * 그대로 칸에 들어가면 사람이 지워야 합니다.
 *
 * <p>길이도 여기서 자릅니다. 서버의 칸이 정해져 있습니다 —
 * {@code Day.stayName} 은 120, {@code stayNote} 와 {@code flight} 는 200.
 * 넘치면 저장할 때 거절당합니다.
 */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === '없음' || trimmed === 'none') {
    return null;
  }
  return trimmed.slice(0, max);
}
