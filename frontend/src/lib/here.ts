import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';


/** 지금 내가 있는 자리. */
export type Here = {
  lat: number;
  lng: number;
  /** 이 반경 안쪽 어딘가라는 뜻. 미터. */
  accuracy: number;
};

export type HereState = {
  here: Here | null;
  error: string | null;
  /** 이 기기에서 쓸 수 있는지. 못 쓰면 화면이 기능을 아예 안 냅니다. */
  supported: boolean;
  watching: boolean;
  start: () => void;
  stop: () => void;
};

/**
 * 지금 내가 어디 있는지 (앱).
 *
 * <h3>한동안 앱에는 없었습니다</h3>
 *
 * <p>위치 권한은 앱을 만들 때 매니페스트에 박히는 것이라, 코드만 고쳐
 * 내보내는 방식(OTA)으로는 넣을 수 없었습니다. 그래서 {@code supported} 가
 * 늘 false 였고, 화면은 <b>지도의 내 점·내 위치로·위치 공유·여기에 깃발</b>
 * 넷을 통째로 감추고 있었습니다. 길 위에서 쓰라고 만든 것들이 정작 길에서
 * 쓰는 쪽에 없었던 셈입니다.
 *
 * <h3>눌러야 시작합니다</h3>
 *
 * <p>웹 쪽은 "일정 짜러 들어왔을 뿐인데 위치를 묻는 창부터 띄우면 대개
 * 거절한다" 는 이유로 눌러야 시작하게 해 두었습니다. 앱에서는 그것이
 * <b>더 중요합니다</b> — 브라우저는 주소창에서 다시 허용할 수 있지만,
 * 폰에서 한 번 거절하면 시스템 설정까지 들어가야 되돌립니다.
 *
 * <p>그래서 화면이 십자를 누를 때까지 묻지 않습니다. 그때는 무엇 때문에
 * 묻는지가 분명합니다.
 *
 * <h3>거절은 한 번만 말합니다</h3>
 *
 * <p>거절한 뒤에도 계속 물으면 화면을 쓸 수 없습니다. 한 번 거절이 오면
 * 까닭을 적어 두고 다시 묻지 않습니다 — 웹과 같은 규칙입니다.
 */
export function useHere(): HereState {
  const [here, setHere] = useState<Here | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  const stop = useCallback(() => {
    watcher.current?.remove();
    watcher.current = null;
    setWatching(false);
    /* 점은 지웁니다. 켜 두지 않았는데 마지막 자리가 남아 있으면 지금 거기
       있는 것처럼 보입니다. */
    setHere(null);
  }, []);

  const start = useCallback(() => {
    if (watcher.current) {
      return;
    }
    setError(null);
    setWatching(true);

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setWatching(false);
        /* 폰에서는 설정까지 들어가야 되돌릴 수 있으므로 그렇게 적어 둡니다.
           브라우저처럼 "주소창 왼쪽" 이라고 하면 찾을 데가 없습니다. */
        setError('위치 사용을 허용해 주세요. 설정 > FIT 에서 바꿀 수 있습니다.');
        return;
      }

      watcher.current = await Location.watchPositionAsync(
        {
          /* 골목 단위로 맞아야 다음 장소까지의 시간이 뜻을 가집니다. */
          accuracy: Location.Accuracy.High,
          /* 십 미터쯤 움직였을 때만 알려 줍니다. 가만히 서 있어도 값이
             떨리는데, 그때마다 다시 그리면 배터리만 닳습니다. */
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (pos) => {
          setHere({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? 0,
          });
        },
      );
    })().catch(() => {
      setWatching(false);
      setError('지금 위치를 알 수 없습니다.');
    });
  }, []);

  /* 화면을 떠나면 멈춥니다. 안 보는 화면 때문에 배터리가 계속 닳으면
     안 됩니다. */
  useEffect(() => {
    return () => {
      watcher.current?.remove();
      watcher.current = null;
    };
  }, []);

  return { here, error, supported: true, watching, start, stop };
}
