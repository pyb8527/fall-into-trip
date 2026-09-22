/**
 * 웹과 껍데기가 주고받는 말.
 *
 * <h3>한쪽만 알아도 됩니다</h3>
 *
 * <p>웹은 껍데기가 있는지 없는지를 {@code window.FIT_SHELL} 로 압니다.
 * 없으면 지금까지처럼 브라우저의 것을 씁니다 — 그래서 <b>이 규약을 몰라도
 * 웹은 그대로 돕니다.</b> 브라우저에서 쓰는 사람에게 아무 일도 안 일어나는
 * 것이 중요합니다.
 *
 * <h3>부르고 답하는 한 쌍</h3>
 *
 * <p>웹이 {@code ask} 를 보내면 껍데기가 {@code tell} 로 답합니다. 둘을
 * {@code id} 로 묶습니다 — 인쇄를 두 번 연달아 누르면 답도 둘이 오는데,
 * 묶어 두지 않으면 어느 답이 어느 부름의 것인지 알 수가 없습니다.
 *
 * <p>껍데기가 먼저 말을 거는 경우도 있습니다(알림을 눌러서 들어왔다,
 * 알림 열쇠가 바뀌었다). 그때는 {@code id} 가 없습니다.
 *
 * <h3>이 파일은 양쪽이 같이 씁니다</h3>
 *
 * <p>껍데기(src/shell)와 웹(src/lib/\*.web)이 같은 것을 읽습니다. 한쪽에만
 * 고치면 말이 안 통하는데, 말이 안 통하는 것은 조용히 아무 일도 안
 * 일어나는 모습으로 나타납니다 — 제일 찾기 어려운 고장입니다.
 */

/** 웹이 껍데기에게 부탁하는 일. */
export type Ask =
  /** 구글 로그인 창을 띄워 주세요. 답: id_token 또는 null */
  | { kind: 'signIn' }
  /** 알림을 켜 주세요. 답: 서버에 등록할 열쇠 또는 null */
  | { kind: 'notifyOn' }
  /** 알림을 꺼 주세요. */
  | { kind: 'notifyOff' }
  /** 이 HTML 을 인쇄해 주세요. */
  | { kind: 'print'; html: string }
  /** 이 주소를 나눠 주세요. 답: 'sent' | 'copied' | 'failed' */
  | { kind: 'share'; url: string; title: string }
  /** 위치를 쓸 수 있게 해 주세요. 답: 허락받았는지 */
  | { kind: 'letMeLocate' }
  /**
   * 첫 화면을 다 그렸습니다. 시작 화면을 내려 주세요.
   *
   * <p>껍데기는 웹이 언제 <b>보이게</b> 됐는지 모릅니다. 웹뷰가 알려 주는
   * onLoadEnd 는 문서와 딸린 것들을 다 받은 때라, 그때는 이미 화면이 뜬
   * 뒤입니다 — 그 사이에 웹이 준비한 시작 화면은 볼 틈이 없습니다.
   *
   * <p>그래서 웹이 말합니다. 화면을 그린 쪽이 그린 때를 압니다.
   */
  | { kind: 'painted' };

/** 껍데기가 웹에게 돌려주는 말. */
export type Tell =
  /** 부탁한 일의 결과. id 로 어느 부탁인지 가립니다. */
  | { kind: 'done'; id: string; value: unknown }
  /** 부탁한 일이 안 됐습니다. */
  | { kind: 'failed'; id: string; why: string }
  /** 알림을 눌러서 들어왔습니다. 이 주소로 가 주세요. */
  | { kind: 'opened'; url: string };

/** 웹이 보내는 봉투. */
export type Envelope = { id: string; ask: Ask };

/**
 * 껍데기가 웹에 말을 넣는 방법.
 *
 * <p>웹뷰에는 "이 자바스크립트를 실행하라" 밖에 없습니다. 그래서 답을
 * 문자열로 만들어 넣고, 웹 쪽은 창에 걸어 둔 함수로 받습니다.
 *
 * <p>JSON.stringify 를 두 번 겹칩니다 — 한 번은 값을 JSON 으로, 또 한 번은
 * 그 JSON 을 자바스크립트 <b>문자열 리터럴</b>로 만들기 위해서입니다. 이래야
 * 따옴표나 줄바꿈이 든 값이 코드를 깨뜨리지 않습니다.
 */
export function speak(tell: Tell): string {
  return `window.__fitShellSays && window.__fitShellSays(${JSON.stringify(
    JSON.stringify(tell),
  )}); true;`;
}
