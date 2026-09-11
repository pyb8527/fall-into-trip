/**
 * 며칠 남았는지.
 *
 * <h3>왜 한 곳에 모으는가</h3>
 *
 * <p>여행 목록과 홈이 같은 답을 내야 합니다. 같은 셈을 각자 들고 있으면,
 * "내일" 의 경계나 "여행 중" 의 판단을 한쪽만 고치는 날이 옵니다. 그날
 * 사람은 두 화면에서 다른 날짜를 보고 어느 쪽이 맞는지 알 수 없습니다.
 *
 * <h3>여기서는 그리지 않습니다</h3>
 *
 * <p>셈만 합니다. 목록은 이것을 뱃지로 그리고 홈은 한 줄로 적습니다 —
 * 모양까지 여기서 정하면 둘 중 한쪽은 맞지 않는 옷을 입습니다.
 */

/** 오늘을 `2026-09-11` 모양으로. 자정 기준이라 시각은 보지 않습니다. */
export function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 여행이 언제인지.
 *
 * <ul>
 *   <li><code>going</code> — 지금 그 길 위입니다</li>
 *   <li><code>tomorrow</code> — 내일 떠납니다</li>
 *   <li><code>left</code> — <code>days</code> 일 남았습니다</li>
 *   <li><code>null</code> — 이미 다녀왔거나, 날짜를 아직 안 정했습니다</li>
 * </ul>
 *
 * <p>다녀온 여행에는 아무것도 돌려주지 않습니다. "D+40" 은 알아서 뭐 하나
 * 싶은 값입니다.
 *
 * <p>날짜가 없는 여행도 마찬가지입니다. 아직 짜는 중인 것이라 셀 날이
 * 없습니다.
 */
export type Countdown = { kind: 'going' } | { kind: 'tomorrow' } | { kind: 'left'; days: number };

export function countdownOf(startIso: string | null, endIso: string | null): Countdown | null {
  if (!startIso) {
    return null;
  }
  const today = todayIso();
  const end = endIso ?? startIso;

  if (end < today) {
    return null;
  }
  if (startIso <= today) {
    return { kind: 'going' };
  }

  const days = daysBetween(today, startIso);
  return days === 0 ? { kind: 'tomorrow' } : { kind: 'left', days };
}

/**
 * 두 날짜 사이의 날 수.
 *
 * <p>자정을 기준으로 세므로 시각은 보지 않습니다. 내일 떠나면 0 입니다 —
 * 그 자리에는 숫자 대신 "내일" 이 붙습니다.
 */
export function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000) - 1);
}

/**
 * 사람이 읽는 한 마디.
 *
 * <p>목록의 뱃지와 홈의 줄이 **같은 말**을 쓰게 합니다. 한쪽이 "D-3" 이고
 * 다른 쪽이 "3일 남음" 이면 같은 여행인지 확인하는 데 시간이 듭니다.
 */
export function countdownLabel(at: Countdown) {
  switch (at.kind) {
    case 'going':
      return '여행 중';
    case 'tomorrow':
      return '내일';
    default:
      return `D-${at.days}`;
  }
}

/**
 * 눈에 띄게 할 것인가.
 *
 * <p>일주일 안쪽이면 챙길 것이 생기는 때입니다. 그 앞은 아직 남의 일이라
 * 조용히 둡니다.
 */
export function countdownIsNear(at: Countdown) {
  return at.kind !== 'left' || at.days <= 7;
}

/**
 * 얼마나 지났는지, 사람이 읽는 말로.
 *
 * <p>"3분 전", "2시간 전", "4일 전". 시각 자체를 적으면 사람이 지금과
 * 견주는 일을 대신 해야 합니다 — 목록을 훑을 때 그것만으로 시간이
 * 걸립니다.
 *
 * <p>담아 둔 일정이 언제 것인지(lib/keep)와 누가 언제 고쳤는지가 같은
 * 말을 씁니다. 한쪽만 고치면 같은 화면에서 두 가지 말투가 섞입니다.
 */
export function ago(at: number) {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 60) {
    return `${minutes}분 전`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : `${Math.round(hours / 24)}일 전`;
}
