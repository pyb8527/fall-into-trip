import { BOOKING_SCHEMA, PROMPT as BOOKING_PROMPT, SHOTS as BOOKING_SHOTS, readBooking } from '@/lib/booking-prompt';
import type { Booking, Intent, IntentState, Progress } from '@/lib/intent-types';
import { INTENT_SCHEMA, PROMPT, SHOTS, readIntent } from '@/lib/intent-prompt';

/**
 * 브라우저 안에서 문장을 쪼갭니다 (웹·PWA).
 *
 * <h3>두 길이 있습니다</h3>
 *
 * <ol>
 *   <li><b>브라우저가 이미 갖고 있는 모델</b>(Chrome 내장). 우리가 받을 것이
 *       없습니다. 다만 데스크톱 크롬에만 있습니다 — 안드로이드 크롬에는
 *       아직 없습니다. 그리고 그 기기에 여유 공간과 GPU 가 넉넉해야 켜집니다.</li>
 *   <li><b>우리가 받아 오는 모델</b>(WebLLM · WebGPU). 안드로이드 크롬 121
 *       이상과 iOS 사파리 26 이상에서 돕니다. 500MB 를 한 번 받아 브라우저
 *       저장소에 두고 씁니다.</li>
 * </ol>
 *
 * <p>둘 다 없으면 <code>null</code> 입니다. 그때 화면은 문장을 그대로 서버에
 * 보내고, 결과가 조금 덜 맞을 뿐 못 쓰는 것이 아닙니다.
 *
 * <h3>깨진 JSON 을 애초에 안 만듭니다</h3>
 *
 * <p>두 길 모두 <b>모양을 강제</b>할 수 있습니다 — 내장 쪽은
 * <code>responseConstraint</code>, WebLLM 쪽은 <code>response_format</code>.
 * 모델이 아무리 말을 덧붙이고 싶어도 문법이 그것을 막습니다. 앱(ExecuTorch)
 * 쪽에는 이것이 없어서 뱉은 글에서 중괄호를 발라내야 하는데, 여기서는 그
 * 단계가 필요 없습니다.
 *
 * <h3>무거운 것은 눌렀을 때만 받아옵니다</h3>
 *
 * <p>WebLLM 은 압축을 풀면 14MB 짜리 꾸러미입니다. 위에서 그냥 import 하면
 * 추천을 한 번도 안 쓰는 사람의 첫 화면이 그만큼 느려집니다. 실제로 켤 때
 * 동적으로 불러옵니다.
 */

/** 브라우저가 이미 갖고 있는 모델을 부르는 창구. 없는 브라우저가 대부분입니다. */
type BuiltIn = {
  availability: (opts?: unknown) => Promise<string>;
  create: (opts?: unknown) => Promise<BuiltInSession>;
};

type BuiltInSession = {
  prompt: (text: string, opts?: { responseConstraint?: unknown }) => Promise<string>;
  destroy?: () => void;
};

function builtIn(): BuiltIn | null {
  const found = (globalThis as { LanguageModel?: BuiltIn }).LanguageModel;
  return found && typeof found.availability === 'function' ? found : null;
}

function hasWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export const canParseHere =
  typeof window !== 'undefined' && (!!builtIn() || hasWebGpu());

/**
 * 어느 모델을 받을지.
 *
 * <p>기기가 말해 주는 메모리로 가릅니다. 브라우저는 8GB 위로는 세지 않고
 * 알려 주지도 않는 것이 많아서, 모르면 작은 쪽으로 갑니다 — 폰에서 큰 것을
 * 받다가 탭이 죽는 것보다 조금 덜 똑똑한 편이 낫습니다.
 */
function pickModel(): { id: string; note: string } {
  const gb = (navigator as { deviceMemory?: number }).deviceMemory ?? 0;
  return gb >= 8
    ? { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', note: '약 1GB' }
    : { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', note: '약 500MB' };
}

let state: IntentState = 'none';
let native: BuiltInSession | null = null;
/*
  WebLLM 의 엔진.

  모양만 타입으로 가져옵니다(import type). 이것은 빌드할 때만 쓰이고 실제
  꾸러미는 아래에서 동적으로 불러오므로, 첫 화면에는 실리지 않습니다.
*/
let engine: import('@mlc-ai/web-llm').MLCEngine | null = null;

if (canParseHere) {
  state = 'absent';
}

export function intentState(): IntentState {
  return state;
}

/** 무엇을 받게 되는지 한 줄. 사람에게 크기를 먼저 알려 줘야 합니다. */
export function modelNote(): string {
  if (builtIn()) {
    return '이 브라우저에 이미 있는 모델을 씁니다. 받을 것이 없습니다.';
  }
  return `${pickModel().note} 를 한 번만 받으면 됩니다.`;
}

export async function fetchModel(onProgress?: (p: Progress) => void): Promise<boolean> {
  if (state === 'ready') {
    return true;
  }
  if (state === 'fetching' || state === 'none') {
    return false;
  }
  state = 'fetching';

  /* 브라우저가 이미 갖고 있으면 그것이 먼저입니다. 같은 일을 하려고 500MB 를
     또 받을 이유가 없습니다. */
  const chrome = builtIn();
  if (chrome) {
    try {
      const can = await chrome.availability({
        expectedInputs: [{ type: 'text', languages: ['ko'] }],
        expectedOutputs: [{ type: 'text', languages: ['ko'] }],
      });
      if (can !== 'unavailable') {
        native = await chrome.create({
          initialPrompts: [{ role: 'system', content: PROMPT }, ...SHOTS],
          expectedInputs: [{ type: 'text', languages: ['ko'] }],
          expectedOutputs: [{ type: 'text', languages: ['ko'] }],
          monitor(m: { addEventListener: (n: string, f: (e: { loaded: number }) => void) => void }) {
            m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded));
          },
        });
        state = 'ready';
        return true;
      }
    } catch {
      /* 있다고 했지만 못 켰습니다. 아래 길로 갑니다. */
      native = null;
    }
  }

  if (!hasWebGpu()) {
    state = 'absent';
    return false;
  }

  try {
    /* 여기서 처음 불러옵니다. 추천을 안 쓰는 사람의 첫 화면에는
       이 꾸러미가 실리지 않습니다. */
    const webllm = await import('@mlc-ai/web-llm');
    engine = await webllm.CreateMLCEngine(pickModel().id, {
      initProgressCallback: (report: { progress: number }) => onProgress?.(report.progress),
    });
    state = 'ready';
    return true;
  } catch {
    state = 'absent';
    engine = null;
    return false;
  }
}

export async function parseIntent(query: string): Promise<Intent | null> {
  if (state !== 'ready') {
    return null;
  }

  try {
    if (native) {
      /* 모양을 문법으로 못박습니다. 모델이 말을 덧붙이고 싶어도 못 합니다. */
      const said = await native.prompt(query, { responseConstraint: INTENT_SCHEMA });
      return readIntent(said);
    }

    if (engine) {
      const reply = await engine.chat.completions.create({
        messages: [{ role: 'system', content: PROMPT }, ...SHOTS, { role: 'user', content: query }],
        /* 쪼개는 일에 창의성은 방해입니다. 같은 문장에는 같은 답이 나와야
           합니다. */
        temperature: 0,
        max_tokens: 96,
        /* 모양을 문법으로 못박습니다. 모델이 말을 덧붙이고 싶어도 못 합니다. */
        response_format: { type: 'json_object', schema: JSON.stringify(INTENT_SCHEMA) },
      });
      return readIntent(reply.choices?.[0]?.message?.content ?? '');
    }
  } catch {
    /* 메모리가 모자라거나 탭이 흔들렸습니다. 이번 한 번을 서버 경로로
       넘깁니다. */
    return null;
  }
  return null;
}

/**
 * 이 기기에서 예약 확인서를 읽을 수 있는가.
 *
 * <p>모델을 쓸 수 있는 자리와 같습니다. 다만 <b>없을 때 서버로 미끄러지지
 * 않는다</b>는 점이 추천과 다릅니다 — 붙여 넣는 글에 이름·예약번호·카드
 * 뒷자리가 들어 있어서, 못 읽으면 그냥 못 읽는 채로 둡니다.
 */
export const canParseBookingHere = canParseHere;

/**
 * 크롬 내장 모델로 읽을 때 쓰는 따로 난 자리.
 *
 * <p>추천 쪽 세션은 만들 때 추천 지시를 물려 둡니다. 거기에 예약 확인서를
 * 넣으면 추천용 칸 셋을 내놓습니다. 그래서 지시가 다른 일에는 자리를
 * 따로 냅니다 — 내장 모델은 무게를 공유하므로 자리 하나가 더 나도
 * 받을 것이 늘지 않습니다.
 */
let nativeBooking: BuiltInSession | null = null;

/**
 * 붙여 넣은 예약 확인서를 칸으로.
 *
 * <p><b>이 기기 밖으로 나가지 않습니다.</b> 못 읽으면 {@code null} 이고,
 * 그때 화면은 칸을 그대로 둡니다. 추천처럼 서버로 넘기는 길을 만들지
 * 않습니다.
 */
export async function parseBooking(text: string): Promise<Booking | null> {
  if (state !== 'ready') {
    return null;
  }

  try {
    const chrome = builtIn();
    if (chrome && native) {
      if (!nativeBooking) {
        nativeBooking = await chrome.create({
          initialPrompts: [{ role: 'system', content: BOOKING_PROMPT }, ...BOOKING_SHOTS],
          expectedInputs: [{ type: 'text', languages: ['ko'] }],
          expectedOutputs: [{ type: 'text', languages: ['ko'] }],
        });
      }
      const said = await nativeBooking.prompt(text, { responseConstraint: BOOKING_SCHEMA });
      return readBooking(said);
    }

    if (engine) {
      const reply = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: BOOKING_PROMPT },
          ...BOOKING_SHOTS,
          { role: 'user', content: text },
        ],
        /* 뽑아내는 일에 창의성은 방해입니다. 같은 확인서에는 같은 답이
           나와야 합니다. */
        temperature: 0,
        /* 추천은 96 이면 됐지만 여기는 칸이 다섯이고 숙소 이름이 깁니다.
           크게 잡으면 모델이 말을 덧붙일 때 그만큼 기다리므로, 다섯 칸이
           겨우 들어갈 만큼만 둡니다. */
        max_tokens: 220,
        response_format: { type: 'json_object', schema: JSON.stringify(BOOKING_SCHEMA) },
      });
      return readBooking(reply.choices?.[0]?.message?.content ?? '');
    }
  } catch {
    /* 메모리가 모자라거나 탭이 흔들렸습니다. 못 읽은 것으로 둡니다 —
       여기에는 서버로 넘기는 길이 없습니다. */
    return null;
  }
  return null;
}

export async function dropModel(): Promise<void> {
  try {
    native?.destroy?.();
    nativeBooking?.destroy?.();
    await engine?.unload?.();
  } catch {
    /* 이미 내려갔습니다. */
  }
  native = null;
  nativeBooking = null;
  engine = null;
  state = canParseHere ? 'absent' : 'none';
}
