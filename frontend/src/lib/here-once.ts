import { useEffect, useState } from 'react';

import { useHere, type Here } from '@/lib/here';

export type HereOnce = {
  /**
   * 잡아 둔 자리. 한 번 잡히면 <b>저절로 안 바뀝니다.</b>
   *
   * <p>{@code useHere} 의 {@code here} 와 다릅니다 — 저쪽은 열 걸음마다
   * 새 값입니다.
   */
  at: Here | null;
  /** 이 기기에서 쓸 수 있는지. 못 쓰면 화면이 기능을 아예 안 냅니다. */
  supported: boolean;
  /** 아직 자리를 잡는 중인지. */
  waiting: boolean;
  /** 거절했거나 못 잡았을 때의 까닭. 한 번만 말합니다. */
  error: string | null;
  /** 누를 때 시작합니다. 화면이 열릴 때 부르면 안 됩니다. */
  start: () => void;
};

/**
 * 지금 내 자리를 <b>한 번만</b> 잡습니다.
 *
 * <h3>왜 계속 따라가면 안 되는가</h3>
 *
 * <p>{@link useHere} 는 걸어 다니는 동안 자리를 계속 알려 줍니다. 지도 위의 내
 * 점에는 그것이 맞습니다 — 멈춰 있으면 쓸모가 없습니다.
 *
 * <p>그런데 <b>목록</b>에는 아닙니다. 가까운 순으로 세운 목록이 열 걸음마다
 * 다시 세워지면, 읽는 동안 줄이 움직여서 손이 닿기 직전에 다른 줄이 그 자리에
 * 옵니다. 게다가 목록을 보는 동안 GPS 가 계속 깨어 있습니다.
 *
 * <p>그래서 첫 자리를 받으면 그 값을 들고 추적을 끕니다. 자리를 옮겼으면
 * {@code start} 를 다시 부르면 됩니다 — 화면이 「다시 보기」로 그 길을 냅니다.
 *
 * <h3>끄기 전에 받아 둡니다</h3>
 *
 * <p>{@code stop()} 은 {@code here} 를 지웁니다. 켜 두지 않았는데 마지막 자리가
 * 남아 있으면 지금 거기 있는 것처럼 보이기 때문입니다. 그래서 끄기 전에 한 벌
 * 베껴 둡니다 — 끄고 나서 읽으면 null 입니다.
 *
 * <h3>묻는 때는 그대로입니다</h3>
 *
 * <p>눌러야 시작합니다. 폰에서 한 번 거절하면 시스템 설정까지 들어가야 되돌리는
 * 일이라, 무엇 때문에 묻는지가 분명한 때에만 묻습니다({@link useHere}).
 */
export function useHereOnce(): HereOnce {
  const me = useHere();
  const [at, setAt] = useState<Here | null>(null);

  useEffect(() => {
    if (me.here && !at) {
      setAt(me.here);
      me.stop();
    }
  }, [me.here, me.stop, at]);

  return {
    at,
    supported: me.supported,
    waiting: me.watching && !at,
    error: me.error,
    start: () => {
      /* 다시 부르면 잡아 둔 것을 버리고 새로 잡습니다. 안 버리면 위 효과가
         새 자리를 안 받습니다 — 「다시 보기」가 아무 일도 안 하게 됩니다. */
      setAt(null);
      me.start();
    },
  };
}
