import { useCallback, useEffect, useRef, useState } from 'react';

import type { Here, HereState } from '@/lib/here';

export type { Here, HereState } from '@/lib/here';

/**
 * 지금 내가 어디 있는지 (웹).
 *
 * <p>눌러야 시작합니다. 일정을 짜러 들어왔을 뿐인데 브라우저가 위치를 묻는
 * 창부터 띄우면, 무엇 때문에 묻는지 알 수 없어 대개 거절합니다. 그러면 정작
 * 길 위에서 필요할 때 이미 막혀 있습니다.
 *
 * <p>거절해도 다시 묻지 않고 점만 안 보이게 둡니다 — 계속 물으면 화면을
 * 쓸 수 없습니다.
 *
 * <p>한 번만 받지 않고 계속 따라갑니다. 걸어 다니는 중에 쓰는 것이라 처음 잡힌
 * 자리에 점이 멈춰 있으면 쓸모가 없습니다.
 */
export function useHere(): HereState {
  const [here, setHere] = useState<Here | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const id = useRef<number | null>(null);

  const supported =
    typeof navigator !== 'undefined' && typeof navigator.geolocation !== 'undefined';

  const stop = useCallback(() => {
    if (id.current !== null) {
      navigator.geolocation.clearWatch(id.current);
      id.current = null;
    }
    setWatching(false);
    /* 점은 지웁니다. 켜 두지 않았는데 마지막 자리가 남아 있으면 지금 거기
       있는 것처럼 보입니다. */
    setHere(null);
  }, []);

  const start = useCallback(() => {
    if (!supported || id.current !== null) {
      return;
    }
    setError(null);
    setWatching(true);
    id.current = navigator.geolocation.watchPosition(
      (pos) => {
        setHere({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (e) => {
        setWatching(false);
        id.current = null;
        setError(
          e.code === e.PERMISSION_DENIED
            ? '위치 사용을 허용해 주세요. 주소창 왼쪽에서 바꿀 수 있습니다.'
            : '지금 위치를 알 수 없습니다.',
        );
      },
      {
        /* 골목 단위로 맞아야 다음 장소까지의 시간이 뜻을 가집니다. */
        enableHighAccuracy: true,
        /* 조금 전 값이면 그대로 씁니다. 매번 GPS 를 깨우면 배터리가 답니다. */
        maximumAge: 10_000,
        timeout: 15_000,
      },
    );
  }, [supported]);

  /* 화면을 떠나면 멈춥니다. 안 보는 화면 때문에 배터리가 계속 닳으면
     안 됩니다. */
  useEffect(() => {
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { here, error, supported, watching, start, stop };
}
