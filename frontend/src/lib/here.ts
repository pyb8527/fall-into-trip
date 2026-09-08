import { useCallback, useState } from 'react';

/**
 * 지금 내가 어디 있는지 (앱).
 *
 * <p>아직 못 씁니다. 위치 권한은 앱을 만들 때 매니페스트에 박히는 것이라
 * 코드만 고쳐 내보내는 방식(OTA)으로는 넣을 수 없습니다. 다음에 앱을 다시
 * 빌드할 때 열립니다.
 *
 * <p>그때까지는 <code>supported</code> 가 false 라 화면이 이 기능을 아예
 * 보여 주지 않습니다. 눌러도 안 되는 버튼을 두는 것보다 낫습니다.
 *
 * <p>웹에서는 here.web.ts 가 잡혀 브라우저 위치를 씁니다.
 */
export type Here = {
  lat: number;
  lng: number;
  /** 이 반경 안쪽 어딘가라는 뜻. 미터. */
  accuracy: number;
};

export type HereState = {
  here: Here | null;
  error: string | null;
  supported: boolean;
  watching: boolean;
  start: () => void;
  stop: () => void;
};

export function useHere(): HereState {
  const [error] = useState<string | null>(null);
  const noop = useCallback(() => {}, []);

  return {
    here: null,
    error,
    supported: false,
    watching: false,
    start: noop,
    stop: noop,
  };
}
