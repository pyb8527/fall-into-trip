import Store from 'expo-sqlite/kv-store';

/**
 * 담아 둘 상자 (앱).
 *
 * <h3>앱에는 없었습니다</h3>
 *
 * <p>{@code lib/keep} 이 {@code localStorage} 만 보고 있었고 앱에는 그것이
 * 없어, 저장이 통째로 조용히 아무 일도 안 했습니다. 그런데 <b>그 기능의
 * 존재 이유가 길 위입니다</b> — 지하철, 산속, 로밍이 끊긴 순간. 그리고 길에서
 * 꺼내 드는 것은 브라우저가 아니라 앱입니다. 정작 필요한 쪽에만 없었습니다.
 *
 * <h3>왜 AsyncStorage 가 아닌가</h3>
 *
 * <p>{@code keep} 은 전부 <b>동기</b>입니다 — 화면이 그릴 때 그 자리에서
 * 꺼내 씁니다. AsyncStorage 로 가면 부르는 쪽까지 전부 비동기가 되고,
 * 그러면 안 터지는 화면에서 저장해 둔 일정이 한 박자 늦게 나타납니다.
 *
 * <p>expo-sqlite 의 kv-store 는 동기로 읽고 씁니다.
 *
 * <h3>왜 파일을 나눴는가</h3>
 *
 * <p>한 파일에서 {@code require} 를 try 로 감싸 봤지만, 번들러는 그것을
 * <b>빌드할 때</b> 풀어 버립니다. 웹 번들에 앱 전용 모듈이 끌려 들어와
 * 빌드가 통째로 깨졌습니다. 쪽마다 파일을 두는 것이 이 저장소가 이미 쓰는
 * 방법입니다(here, print, share…).
 */
export type Box = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(i: number): string | null;
};

/*
  localStorage 의 length·key(i) 를 흉내 냅니다.

  <p>열쇠 목록을 매번 새로 받습니다. 몇십 개짜리라 훑어도 값이 싸고,
  들고 있다가 지운 뒤에 안 맞는 것보다 낫습니다.
*/
const box: Box = {
  getItem: (k) => Store.getItemSync(k),
  setItem: (k, v) => Store.setItemSync(k, v),
  removeItem: (k) => {
    Store.removeItemSync(k);
  },
  get length() {
    return Store.getAllKeysSync().length;
  },
  key: (i) => Store.getAllKeysSync()[i] ?? null,
};

export function keepBox(): Box | null {
  try {
    /* 한 번 만져 봐서 실제로 열리는지 확인합니다. 모듈은 실렸는데 기기에서
       못 여는 경우(저장 공간이 꽉 찼다든지)가 있습니다. */
    Store.getItemSync('fit.probe');
    return box;
  } catch {
    return null;
  }
}
