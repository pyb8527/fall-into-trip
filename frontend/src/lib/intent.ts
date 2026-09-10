import { createLLMChatSession, download, models } from 'react-native-executorch';
import type { LLMChatSession } from 'react-native-executorch';

import { PLACE_ICONS } from '@/constants/place-icons';
import type { Intent, IntentState, Progress } from '@/lib/intent-types';

/**
 * 기기 안에서 문장을 쪼갭니다 (앱).
 *
 * <h3>값어치는 속도가 아니라 나가지 않는다는 것</h3>
 *
 * <p>"혼자 조용히 있고 싶은 곳" 은 우리 서버도, 남의 LLM 사업자도 알 필요가
 * 없습니다. 이 파일이 하는 일은 그 문장을 기기 안에서 <code>{category:
 * "cafe", keyword: "조용한"}</code> 로 바꾸는 것뿐이고, 서버로 나가는 것은
 * 그 쪼갠 값입니다.
 *
 * <p>빠르다고 말하지 않습니다. 중급 기기에서 첫 토큰까지 몇 초가 걸릴 수
 * 있고, 그건 서버 왕복보다 느립니다. 그래서 화면은 이것을 기다리지 않아도
 * 되게 만들어져 있습니다 — 쪼개지 못하면 문장을 그대로 보냅니다.
 *
 * <h3>답을 짓지 않습니다</h3>
 *
 * <p>모델에게 "어디가 좋을까" 를 묻지 않습니다. 1.5B 짜리가 오사카의 가게를
 * 알 리 없고, 알은척하면 그것이 곧 지어낸 말이 됩니다. 장소를 아는 것은
 * 구글이고, 모델이 하는 일은 문장을 인자로 쪼개는 것 하나입니다.
 */

/**
 * 쓰는 모델.
 *
 * <p>Qwen 2.5 1.5B, 4비트. 한국어와 JSON 구조 지키기를 함께 해내는 가장
 * 작은 것입니다. 0.5B 는 더 빠르지만 한국어 문장에서 갈래를 자주 틀립니다.
 *
 * <p>번들에 넣지 않습니다. 최초 실행 때 받지도 않습니다 — <b>추천을 처음
 * 쓸 때</b> 받습니다. 일정만 짜는 사람이 1GB 를 받을 이유가 없습니다.
 */
const MODEL = models.llm.QWEN2_5_1_5B.XNNPACK_8DA4W;

/**
 * 한 번에 뽑을 토큰 수.
 *
 * <p>우리가 받을 것은 짧은 JSON 한 줄입니다. 넉넉히 잡아도 이 정도면 되고,
 * 크게 잡으면 모델이 말을 덧붙이기 시작할 때 그만큼 오래 기다립니다.
 */
const MAX_TOKENS = 96;

/**
 * 문장을 쪼개라는 지시.
 *
 * <p>갈래 목록을 프롬프트 안에 직접 적습니다. 서버와 화면이 아는 열여섯 개와
 * 같아야 하는데, 손으로 두 번 적으면 언젠가 어긋납니다. 한 곳에서 만듭니다.
 */
const SYSTEM = [
  '너는 여행 앱의 검색 도우미다. 사용자의 한국어 문장을 검색 인자로 쪼갠다.',
  '답은 JSON 한 개만 출력한다. 설명·인사·코드블록을 붙이지 않는다.',
  '모양: {"locationQuery": string|null, "category": string|null, "keyword": string|null}',
  `category 는 다음 중 하나이거나 null: ${PLACE_ICONS.map((k) => k.key).join(', ')}`,
  'locationQuery 는 문장에 지명이 있을 때만 채운다. 없으면 null.',
  'keyword 는 "조용한", "아이랑", "비 올 때" 처럼 꾸미는 말만 짧게.',
  '모르면 null 을 넣는다. 지어내지 않는다.',
].join('\n');

/** 몇 마디 보여 주면 모양을 훨씬 잘 지킵니다. */
const EXAMPLES: { role: 'user' | 'assistant'; content: string }[] = [
  { role: 'user', content: '오사카에서 비 올 때 갈 만한 실내' },
  {
    role: 'assistant',
    content: '{"locationQuery":"오사카","category":"art","keyword":"실내"}',
  },
  { role: 'user', content: '첫날 저녁에 셋이서 조용히 술 한잔' },
  {
    role: 'assistant',
    content: '{"locationQuery":null,"category":"bar","keyword":"조용한"}',
  },
];

export const canParseHere = true;

let session: LLMChatSession | null = null;
let state: IntentState = 'absent';

export function intentState(): IntentState {
  return state;
}

/**
 * 모델을 받아 둡니다.
 *
 * <p>한 번 받으면 다음부터는 디스크에서 바로 엽니다 — 라이브러리가 URL 별로
 * 캐시하므로 우리가 따로 챙길 것이 없습니다.
 *
 * @returns 쓸 수 있게 됐는지. 실패해도 던지지 않습니다 — 이것이 안 돼도
 *          추천 자체는 서버 경로로 돌아갑니다.
 */
export async function fetchModel(onProgress?: (p: Progress) => void): Promise<boolean> {
  if (state === 'ready' && session) {
    return true;
  }
  if (state === 'fetching') {
    return false;
  }

  state = 'fetching';
  try {
    /* 원격 주소가 로컬 경로로 바뀌어 돌아옵니다. 이미 받아 둔 것이면
       네트워크를 타지 않습니다. */
    const local = await download(MODEL, { onProgress });
    session = await createLLMChatSession(local, {
      generationConfig: {
        maxNewTokens: MAX_TOKENS,
        /* 쪼개는 일에 창의성은 방해입니다. 같은 문장에는 같은 답이
           나와야 합니다. */
        temperature: 0,
      },
      initialMessages: [{ role: 'system', content: SYSTEM }, ...EXAMPLES],
      /*
        중괄호가 닫히면 멈춥니다.

        모델이 JSON 하나를 내놓고도 "이렇게 쪼갰습니다" 하고 말을 잇는 일이
        있습니다. 뒤를 안 기다리면 그만큼 빨리 끝납니다.
      */
      stopRegex: /\}/,
      /* 매번 새로 시작합니다. 앞의 질의가 다음 답에 스며들면 "아까 그
         카페 근처" 같은 것을 지어내기 시작합니다. */
      resetOnTurn: true,
    });
    state = 'ready';
    return true;
  } catch {
    state = 'absent';
    session = null;
    return false;
  }
}

/**
 * 문장을 쪼갭니다.
 *
 * @returns 못 쪼개면 <code>null</code>. 그때 화면은 문장을 그대로 보냅니다.
 */
export async function parseIntent(query: string): Promise<Intent | null> {
  if (state !== 'ready' || !session) {
    return null;
  }
  try {
    const turn = await session.sendMessage(query);
    /* 이번 차례에 모델이 보탠 말들. 도구를 쓰지 않으므로 하나뿐이지만,
       모양은 여럿을 담을 수 있게 되어 있습니다. */
    const said = turn.messages
      .filter((m) => m.role === 'assistant')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('');
    return readJson(said);
  } catch {
    /* 메모리가 모자라거나 중간에 죽었습니다. 이번 한 번을 서버 경로로
       넘깁니다. */
    return null;
  }
}

/** 모델을 내려놓습니다. 메모리를 꽤 차지하므로 판을 닫을 때 부릅니다. */
export async function dropModel(): Promise<void> {
  try {
    session?.dispose();
  } catch {
    /* 이미 내려갔습니다. */
  }
  session = null;
  state = 'absent';
}

/**
 * 모델이 뱉은 것에서 JSON 을 발라냅니다.
 *
 * <p>작은 모델은 "```json" 을 두르거나 앞에 한마디 붙이는 일이 흔합니다.
 * 중괄호 안쪽만 잘라 내면 그 대부분이 살아납니다. 그래도 안 되면
 * <code>null</code> 을 돌려주고, 화면은 문장을 그대로 보냅니다 — 즉
 * 맥락 추천으로 미끄러집니다.
 */
function readJson(raw: string): Intent | null {
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
