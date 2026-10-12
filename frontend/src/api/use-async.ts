import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { ApiError, UNEXPECTED } from '@/api/client';
import { stamp, subscribe, watchReads } from '@/api/invalidate';

/** {@link useAsync} 의 셋째 자리. 빼도 됩니다 — 예전 부름은 그대로 돕니다. */
export type AsyncOptions = {
  /**
   * 부른 주소로 알아내는 열쇠 말고 더 들을 것({@code invalidate.ts} 의 열쇠).
   *
   * <p>대개는 비워 둡니다. {@code api.get(path, signal)} 로 읽으면 무엇을
   * 읽었는지 저절로 적힙니다. 끈(signal)을 안 넘기는 읽기나, 주소로는 드러나지
   * 않는 갈래에 기대는 읽기만 여기에 적습니다.
   */
  keys?: readonly string[];
};

/**
 * 서버에서 한 덩어리를 읽어 오는 화면들이 똑같이 필요로 하는 것.
 *
 * 로딩·오류·다시 읽기를 화면마다 새로 쓰면 어딘가에서는 빠뜨립니다.
 * 특히 다음을 여기서 한 번에 처리합니다.
 *
 * - 화면을 떠난 뒤 도착한 응답으로 상태를 건드리지 않습니다.
 * - 조건이 빠르게 바뀌어 요청이 겹칠 때, 늦게 도착한 옛 응답이 새 결과를
 *   덮어쓰지 않습니다.
 * - 읽은 것이 다른 곳에서 바뀌면 다시 읽습니다({@code invalidate.ts}). 같은
 *   화면의 다른 갈래가 바꾼 것도, 판(시트)이 바꾼 것도 같습니다.
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options?: AsyncOptions,
) {
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

  /*
    지금 무엇을 보고 있는지와, 마지막으로 언제 읽기 시작했는지.

    <p>열쇠는 읽을 때마다 새로 모읍니다. 조건에 따라 아예 안 부르는 읽기가
    있어서({@code visible ? api.get(…) : Promise.resolve(…)}) 지난번에 부른
    것이 이번에도 부른 것이라는 보장이 없습니다.
  */
  const reads = useRef<Set<string>>(new Set());
  const ranAt = useRef(0);

  const run = useCallback(() => {
    const seq = ++latest.current;
    const controller = new AbortController();
    const into = new Set<string>();
    reads.current = into;
    ranAt.current = stamp();
    watchReads(controller.signal, into);

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

  /*
    화면으로 돌아오면 다시 가져옵니다.

    뒤로 가기로 목록에 돌아왔을 때가 문제였습니다. 화면이 살아 있는 채로
    가려져 있다가 도로 보이는 것뿐이라 다시 가져올 일이 없고, 방금 만든
    여행도 방금 지운 장소도 목록에는 옛것 그대로였습니다. 새로고침을 눌러야
    맞아졌는데, 그건 사용자가 알아서 할 일이 아닙니다.

    처음 뜰 때는 건너뜁니다 — 바로 위 useEffect 가 이미 가져왔습니다.
  */
  const firstFocus = useRef(true);
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const blur = () => {
        focused.current = false;
      };
      if (firstFocus.current) {
        firstFocus.current = false;
        return blur;
      }
      run();
      return blur;
    }, [run]),
  );

  /*
    읽은 것이 바뀌었다는 말을 듣습니다.

    <p><b>보이는 화면만</b> 다시 읽습니다. 뒤에 깔린 화면(홈 · 목록)은 돌아올 때
    바로 위 useFocusEffect 가 어차피 다시 읽습니다 — 지금 읽으면 같은 것을 두 번
    받습니다.

    <p>알린 뒤에 이미 다시 읽기 시작했으면 건너뜁니다. 바꾸는 자리 다수가 성공한
    직후 손으로 {@code reload()} 를 부르는데, 그것과 겹치지 않게 합니다.

    <p>다시 읽는 동안 화면을 비우지 않는 것은 그대로입니다 — {@code run} 은
    {@code data} 를 건드리지 않고 새 값이 오면 갈아 끼웁니다.
  */
  const runNow = useRef(run);
  useEffect(() => {
    runNow.current = run;
  }, [run]);
  const extra = options?.keys;
  const extraKey = extra ? extra.join('|') : '';
  useEffect(() => {
    const listed = extraKey ? extraKey.split('|') : [];
    return subscribe({
      keys: () => [...reads.current, ...listed],
      lastRun: () => ranAt.current,
      fire: () => {
        if (alive.current && focused.current) {
          runNow.current();
        }
      },
    });
  }, [extraKey]);

  return { data, error, loading, reload: run, setData };
}

/**
 * {@link useAsync} 를 안 쓰고 손으로 받아 오는 자리가 같은 알림을 듣는 길.
 *
 * <p>쪽을 이어 붙이는 피드 목록, 앨범, 댓글처럼 제 상태를 따로 들고 있는 것들이
 * 있습니다. 그것들은 무엇을 읽었는지 저절로 적히지 않으니 열쇠를 직접 적습니다.
 *
 * <p>가려져 있을 때 들은 것은 버리지 않고 다시 보일 때 한 번 돌립니다 — 이것들은
 * useAsync 처럼 돌아올 때마다 다시 읽지 않습니다.
 *
 * @param keys    들을 열쇠({@code invalidate.ts})
 * @param onStale 다시 읽는 일. 바뀔 때마다 새로 넘겨도 됩니다
 */
export function useInvalidation(keys: readonly string[], onStale: () => void) {
  const latest = useRef(onStale);
  useEffect(() => {
    latest.current = onStale;
  }, [onStale]);

  const focused = useRef(false);
  const missed = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (missed.current) {
        missed.current = false;
        latest.current();
      }
      return () => {
        focused.current = false;
      };
    }, []),
  );

  const joined = keys.join('|');
  useEffect(() => {
    const listed = joined ? joined.split('|') : [];
    return subscribe({
      keys: () => listed,
      /* 손으로 읽는 자리는 언제 읽었는지 모릅니다. 늘 「알린 것보다 먼저」로 봅니다. */
      lastRun: () => 0,
      fire: () => {
        if (focused.current) {
          latest.current();
        } else {
          missed.current = true;
        }
      },
    });
  }, [joined]);
}
