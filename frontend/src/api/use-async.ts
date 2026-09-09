import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, UNEXPECTED } from '@/api/client';

/**
 * 서버에서 한 덩어리를 읽어 오는 화면들이 똑같이 필요로 하는 것.
 *
 * 로딩·오류·다시 읽기를 화면마다 새로 쓰면 어딘가에서는 빠뜨립니다.
 * 특히 다음 두 가지를 여기서 한 번에 처리합니다.
 *
 * - 화면을 떠난 뒤 도착한 응답으로 상태를 건드리지 않습니다.
 * - 조건이 빠르게 바뀌어 요청이 겹칠 때, 늦게 도착한 옛 응답이 새 결과를
 *   덮어쓰지 않습니다.
 */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* 몇 번째 요청인지. 마지막 것만 반영합니다. */
  const latest = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(() => {
    const seq = ++latest.current;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    load(controller.signal)
      .then((result) => {
        if (alive.current && seq === latest.current) {
          setData(result);
        }
      })
      .catch((e: unknown) => {
        if (!alive.current || seq !== latest.current) {
          return;
        }
        setError(e instanceof ApiError ? e.message : UNEXPECTED);
      })
      .finally(() => {
        if (alive.current && seq === latest.current) {
          setLoading(false);
        }
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run]);

  return { data, error, loading, reload: run, setData };
}
