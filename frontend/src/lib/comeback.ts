/**
 * 하려다 만 일을 기억해 둡니다.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>구경하다 마음에 드는 일정을 "가져오기" 누르면 계정이 필요합니다.
 * 가입을 마치고 그 글로 돌아오면, 방금 무엇을 누르려 했는지는 사라지고
 * 없습니다. 처음부터 다시 찾아 다시 눌러야 합니다. 거기서 많이 빠집니다.
 *
 * <h3>주소에 싣지 않습니다</h3>
 *
 * <p>돌아올 주소에 <code>?do=save</code> 처럼 실어 두면 간단하지만, 그
 * 주소는 그대로 복사되어 남에게 전해집니다. 링크를 받은 사람이 열자마자
 * 자기 보석함에 남의 장소가 담기는 일이 생깁니다.
 *
 * <p>그래서 이 기억은 <b>이 탭의 메모리에만</b> 둡니다. 가입 화면으로
 * 갔다가 돌아오는 것은 화면 갈아 끼우기라 메모리는 그대로 있고,
 * 새로고침하거나 링크를 새로 열면 깨끗이 사라집니다. 잃어버려도 손해는
 * "한 번 더 누른다" 뿐입니다.
 *
 * <h3>제자리에서만 꺼냅니다</h3>
 *
 * <p>꺼낼 때 어느 화면인지를 함께 묻습니다. 가입하고 엉뚱한 데로 갔는데
 * 거기서 옛 뜻이 튀어나오면, 누른 적 없는 일이 저절로 일어납니다.
 */

/** 계정이 있어야만 되는 일들. */
export type ComebackDo = 'copy' | 'like' | 'save' | 'comment' | 'report' | 'join';

export type Comeback = {
  /** 돌아와야 할 우리 안의 경로. 예: /community/abc */
  where: string;
  what: ComebackDo;
  /** 무엇에 대한 것인지. 장소 담기라면 "2:0" 처럼 몇째 날 몇 번째. */
  arg?: string;
};

let pending: Comeback | null = null;

/** 가입·로그인 하러 보내기 직전에 적어 둡니다. */
export function rememberComeback(what: Comeback) {
  pending = what;
}

/**
 * 그 화면으로 돌아왔을 때 한 번만 꺼냅니다.
 *
 * <p>꺼내면 지웁니다. 남겨 두면 그 화면을 다시 열 때마다 되풀이됩니다.
 */
export function takeComeback(where: string): Comeback | null {
  if (!pending || pending.where !== where) {
    return null;
  }
  const found = pending;
  pending = null;
  return found;
}

/** 마음이 바뀌어 가입 판을 닫았을 때. 들고 있을 이유가 없습니다. */
export function forgetComeback() {
  pending = null;
}
