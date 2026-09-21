import { createLLMChatSession, download, models } from 'react-native-executorch';
import type { LLMChatSession, LLMChatTurnResult, LLMModel } from 'react-native-executorch';

import {
  PROMPT as BOOKING_PROMPT,
  SHOTS as BOOKING_SHOTS,
  readBooking,
} from '@/lib/booking-prompt';
import { PROMPT, SHOTS, readIntent } from '@/lib/intent-prompt';
import type { Booking, Intent, IntentState, Progress } from '@/lib/intent-types';

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

export const canParseHere = true;

/** 무엇을 받게 되는지 한 줄. 사람에게 크기를 먼저 알려 줘야 합니다. */
export function modelNote(): string {
  return '약 1GB 를 한 번만 받으면 됩니다.';
}

let session: LLMChatSession | null = null;

/**
 * 지금 띄워 둔 세션이 무슨 일을 하도록 차려졌는지.
 *
 * <h3>왜 하나만 띄우는가</h3>
 *
 * <p>쪼개는 일이 둘입니다 — 찾는 문장("비 올 때 갈 만한 실내")과 예약
 * 확인서. 시키는 말(system prompt)이 달라서 세션도 따로여야 합니다.
 *
 * <p>그런데 둘을 같이 띄워 두면 1.5B 짜리가 폰 메모리에 두 벌 올라갑니다.
 * 중급 기기에서 그것은 앱이 죽는 길입니다.
 *
 * <p>한 번에 하나만 둡니다. 다른 일이 필요하면 내리고 새로 차립니다 —
 * 예약 붙여넣기는 여행 하나에 한두 번 있는 일이라, 그때 한두 초 더
 * 걸리는 것이 메모리를 두 배로 쓰는 것보다 낫습니다.
 */
let job: 'intent' | 'booking' | null = null;
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
    modelPath = local;
    await sit('intent');
    state = 'ready';
    return true;
  } catch {
    state = 'absent';
    session = null;
    return false;
  }
}

/**
 * 받아 둔 모델이 어디 있는지. 두 번째로 차릴 때 다시 안 받습니다.
 *
 * <p>{@code download} 가 원격 주소를 로컬 경로로 바꿔 돌려준 것입니다 —
 * 생김새는 원본과 같고 안의 주소만 바뀌어 있습니다.
 */
let modelPath: LLMModel | null = null;

/**
 * 세션을 그 일에 맞게 차려 둡니다. 이미 그 일이면 아무것도 안 합니다.
 *
 * <p>시키는 말과 보기(shots)만 다르고 나머지 설정은 같습니다 — 둘 다
 * "JSON 하나만 내놓아라" 는 일이라 창의성도 말수도 필요 없습니다.
 */
async function sit(want: 'intent' | 'booking') {
  if (job === want && session) {
    return;
  }
  if (!modelPath) {
    throw new Error('아직 안 받았습니다');
  }
  try {
    session?.dispose();
  } catch {
    /* 이미 내려갔습니다. */
  }
  session = null;
  job = null;

  const [say, shots] =
    want === 'intent'
      ? [PROMPT, SHOTS]
      : [BOOKING_PROMPT, BOOKING_SHOTS];

  session = await createLLMChatSession(modelPath, {
    generationConfig: {
      /* 예약은 칸이 다섯이라 한 줄짜리 추천보다 답이 깁니다. */
      maxNewTokens: want === 'booking' ? BOOKING_TOKENS : MAX_TOKENS,
      /* 쪼개는 일에 창의성은 방해입니다. 같은 문장에는 같은 답이
         나와야 합니다. */
      temperature: 0,
    },
    initialMessages: [{ role: 'system', content: say }, ...shots],
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
  job = want;
}

/** 모델이 한 번에 내놓는 말. 예약은 칸이 다섯이라 더 깁니다. */
const BOOKING_TOKENS = 192;

/** 한 차례에서 모델이 보탠 말만 이어 붙입니다. */
function saidIn(turn: LLMChatTurnResult) {
  return turn.messages
    .filter((m) => m.role === 'assistant')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('');
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
    await sit('intent');
    const turn = await session!.sendMessage(query);
    return readIntent(saidIn(turn));
  } catch {
    /* 메모리가 모자라거나 중간에 죽었습니다. 이번 한 번을 서버 경로로
       넘깁니다. */
    return null;
  }
}

/** 모델을 내려놓습니다. 메모리를 꽤 차지하므로 판을 닫을 때 부릅니다. */
/**
 * 붙여 넣은 예약 확인서를 칸으로 쪼갭니다.
 *
 * <p>기기 안에서 합니다. 항공권 번호와 숙소 이름과 묵는 날은 남의 서버가
 * 알 필요가 없는 것들입니다.
 *
 * <p>추천과 <b>같은 모델</b>을 씁니다. 시키는 말만 갈아 끼우고 세션을 다시
 * 차립니다 — 둘을 같이 띄워 두면 1.5B 가 메모리에 두 벌 올라갑니다.
 */
export const canParseBookingHere = true;

/** 위와 같은 이유로 늘 {@code null} 입니다. 화면이 여기까지 오지 않습니다. */
export async function parseBooking(text: string): Promise<Booking | null> {
  if (state !== 'ready') {
    return null;
  }
  try {
    /* 세션을 예약 쪽으로 바꿔 앉힙니다. 이미 그쪽이면 그냥 넘어갑니다. */
    await sit('booking');
    const turn = await session!.sendMessage(text);
    return readBooking(saidIn(turn));
  } catch {
    /* 메모리가 모자라거나 중간에 죽었습니다. 화면은 못 읽은 것으로 보고
       사람에게 직접 적으라고 합니다 — 이 기능의 값어치는 대신 적어 주는
       것이지, 못 하면 그냥 원래 하던 대로입니다. */
    return null;
  }
}

export async function dropModel(): Promise<void> {
  try {
    session?.dispose();
  } catch {
    /* 이미 내려갔습니다. */
  }
  session = null;
  job = null;
  state = 'absent';
}
