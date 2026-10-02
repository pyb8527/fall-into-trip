import { countdownIsNear, countdownLabel, countdownOf, type Countdown } from '@/lib/countdown';
import { Badge } from '@/ui';

/**
 * D-day 배지 — 앱 어디서나 하나.
 *
 * <h3>화면마다 색이 갈렸습니다</h3>
 *
 * <p>홈과 일정 화면은 노랑으로 채우고, 내 여행 목록은 연보라·초록·회색으로
 * 그렸습니다. 같은 「D-5」가 화면을 옮기면 다른 색이라, 색이 무엇을 뜻하는지
 * 배울 수가 없었습니다.
 *
 * <p>노랑은 <b>D-day 에만</b> 씁니다(디자인 규칙). 일주일 안이거나 여행
 * 중이면 노랑으로 채우고, 그보다 멀면 회색입니다 — 석 달 뒤 여행까지 노랗게
 * 칠하면 노랑이 「곧」을 뜻하지 못합니다.
 *
 * @param label 「여행 중 2일째」처럼 글자만 바꿀 때
 */
export function CountdownBadge({
  startIso,
  endIso,
  at,
  label,
}: {
  startIso?: string | null;
  endIso?: string | null;
  /** 이미 셈해 둔 것이 있으면 그것을 씁니다 */
  at?: Countdown | null;
  label?: string;
}) {
  const left = at ?? countdownOf(startIso ?? null, endIso ?? null);
  if (!left) {
    return null;
  }
  const near = countdownIsNear(left);
  return <Badge tone={near ? 'hot' : 'muted'} solid={near} label={label ?? countdownLabel(left)} />;
}
