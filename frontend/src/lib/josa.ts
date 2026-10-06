/**
 * 이름 뒤에 붙는 조사(을/를 · 이/가 · 은/는).
 *
 * <p>「「이치란」 를 보석함에 담았어요」처럼 조사를 박아 두고 있었습니다.
 * 이름은 사람이 짓는 것이라 받침이 있을지 미리 모릅니다. 서버의
 * {@code Josa} 와 같은 규칙입니다 — 숫자는 읽는 소리(3=삼)로, 영문으로
 * 끝나면 맞힐 수 없어 「을(를)」로 둘 다 적습니다.
 */

type Pair = '을를' | '이가' | '은는' | '과와' | '으로로';

function hasFinal(word: string): boolean | null {
  for (let i = word.length - 1; i >= 0; i--) {
    const c = word.charCodeAt(i);
    if (c >= 0xac00 && c <= 0xd7a3) {
      return (c - 0xac00) % 28 !== 0;
    }
    if (c >= 48 && c <= 57) {
      /* 영 일 이 삼 사 오 육 칠 팔 구 */
      return '013678'.includes(word[i]);
    }
    if (/\p{L}/u.test(word[i])) {
      return null;
    }
  }
  return null;
}

/** 받침을 보고 고른 조사 하나. */
export function josa(word: string, pair: Pair): string {
  const [withFinal, withoutFinal] =
    pair === '으로로' ? ['으로', '로'] : [pair[0], pair[1]];
  const has = hasFinal(word);
  if (has == null) {
    return `${withFinal}(${withoutFinal})`;
  }
  /* 「로」는 ㄹ 받침 뒤에도 「로」입니다(서울로). */
  if (pair === '으로로' && has) {
    const last = word.trim().slice(-1).charCodeAt(0);
    if (last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 === 8) {
      return '로';
    }
  }
  return has ? withFinal : withoutFinal;
}

/** 「이름」을 — 낫표로 감싸고 조사를 붙입니다. */
export function quoted(name: string, pair: Pair): string {
  return `「${name}」${josa(name, pair)}`;
}
