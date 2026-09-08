import { useCallback, useEffect, useRef, useState } from 'react';

import type { Here, HereState } from '@/lib/here';

export type { Here, HereState } from '@/lib/here';

/**
 * 지금 내가 어디 있는지 (웹).
 *
 * <p>지도를 여는 순간 시작합니다. 길 위에서 쓰는 화면이라 내가 어디 있는지는
 * 늘 보여야 하고, 볼 때마다 버튼을 누르게 하면 그게 일이 됩니다.
 *
 * <p>브라우저가 창을 띄워 한 번 묻습니다. 거절하면 다시 묻지 않고 점만
 * 안 보이게 둡니다 — 계속 물으면 화면을 쓸 수 없습니다.
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

  /* 열리면 바로 시작하고, 떠나면 멈춥니다. 안 보는 화면 때문에 배터리가
     계속 닳으면 안 됩니다. */
  useEffect(() => {
    start();
    return stop;
    /* start 는 supported 에만 매여 있어 다시 만들어지지 않습니다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { here, error, supported, watching, start, stop };
}
