import { createLLMChatSession, download, models } from 'react-native-executorch';
import type { LLMChatSession } from 'react-native-executorch';

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
      initialMessages: [{ role: 'system', content: PROMPT }, ...SHOTS],
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
    return readIntent(said);
  } catch {
    /* 메모리가 모자라거나 중간에 죽었습니다. 이번 한 번을 서버 경로로
       넘깁니다. */
    return null;
  }
}

/** 모델을 내려놓습니다. 메모리를 꽤 차지하므로 판을 닫을 때 부릅니다. */
/**
 * 앱에서는 아직 예약 확인서를 못 읽습니다.
 *
 * <h3>왜 못 하는가</h3>
 *
 * <p>세션이 만들어질 때 <b>추천 지시가 물려 있습니다</b>
 * ({@code initialMessages} + {@code resetOnTurn: true}). 거기에 예약
 * 확인서를 넣으면 모델은 그것을 추천 문장으로 읽고 칸 셋을 내놓습니다.
 *
 * <p>고치는 길은 둘입니다. 자리를 하나 더 내거나(폰에서 1GB 짜리 무게를
 * 두 벌 드는 일입니다), 일이 바뀔 때마다 세션을 갈아 끼우거나. 뒤엣것이
 * 맞아 보이는데, 그러면 <b>이미 돌고 있는 추천 경로를 건드리게</b> 됩니다.
 *
 * <h3>왜 지금 안 고치는가</h3>
 *
 * <p>확인할 방법이 없습니다. 이 자리는 EAS 로 구운 앱에서만 돌고, 앱 빌드는
 * 앱 작업을 할 때 한 번에 하기로 했습니다. 못 재 보는 채로 추천 경로에
 * 손대는 것보다, 여기서 <b>안 된다고 분명히 말하는</b> 편이 낫습니다.
 *
 * <p>false 이므로 화면은 단추 자체를 안 냅니다. 서버로 미끄러지는 길은
 * 만들지 않습니다 — 붙여 넣는 글에 이름과 예약번호가 들어 있습니다.
 */
export const canParseBookingHere = false;

/** 위와 같은 이유로 늘 {@code null} 입니다. 화면이 여기까지 오지 않습니다. */
export async function parseBooking(_text: string): Promise<Booking | null> {
  return null;
}

export async function dropModel(): Promise<void> {
  try {
    session?.dispose();
  } catch {
    /* 이미 내려갔습니다. */
  }
  session = null;
  state = 'absent';
}
