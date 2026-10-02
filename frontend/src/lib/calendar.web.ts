import { askShell, inShell } from '@/lib/shell-bridge.web';

/**
 * 여행 하나를 폰 캘린더에 꽂기 (웹).
 *
 * <h3>구독과 둘 다 둡니다</h3>
 *
 * <p>구독 주소가 먼저 있었습니다({@code /api/cal/{열쇠}.ics}). 둘이 다른
 * 것을 줍니다.
 *
 * <table>
 *   <tr><td>구독</td><td>일정이 바뀌면 캘린더도 <b>따라 바뀜</b>.
 *       대신 주소를 캘린더 앱에 등록하는 그 한 번이 폰에서 번거롭고,
 *       구글 캘린더는 몇 시간에 한 번만 읽어 갑니다</td></tr>
 *   <tr><td>꽂기</td><td><b>그 자리에서</b> 들어감. 대신 한 번뿐 —
 *       그 뒤에 날짜가 바뀌어도 캘린더는 모릅니다</td></tr>
 * </table>
 *
 * <p>고르는 것이 아니라 쓰는 자리가 다릅니다. 다음 주 여행 하나를 캘린더에
 * 보이게 하려는 사람에게는 꽂기가 맞고, 여행을 자주 짜는 사람에게는 구독이
 * 맞습니다. <b>화면이 그 차이를 말해야 합니다</b> — 둘을 나란히 두고 설명을
 * 안 달면 같은 일을 하는 단추 두 개로 보입니다.
 *
 * <h3>브라우저에서는 안 냅니다</h3>
 *
 * <p>브라우저에는 폰 캘린더에 꽂는 길이 없습니다. 거기서 할 수 있는 것은
 * 구독뿐이라 단추 자체를 안 냅니다 — 눌러서 안 되는 단추를 보여 주느니
 * 없는 편이 낫습니다(이 저장소가 알림 스위치에 쓰는 규칙과 같습니다).
 */

/**
 * 이 자리에서 꽂을 수 있는지.
 *
 * <p>앱 안이면 참입니다. 다만 <b>이 말을 모르는 옛 껍데기</b>일 수 있어서,
 * 눌러 봐야 아는 칸이 하나 남습니다({@link added} 의 'tooOld').
 */
export const canAddToCalendar = inShell;

/** 넣을 여행 한 건. {@code shell/calendar.ts} 의 것과 같은 모양입니다. */
export type TripEvent = {
  title: string;
  /** 첫날 (YYYY-MM-DD). */
  startIso: string;
  /** 마지막 날. 하루짜리면 첫날과 같습니다. */
  endIso: string;
  notes: string;
  url: string;
};

/**
 * 어떻게 끝났는지.
 *
 * <ul>
 *   <li><b>added</b> — 저장한 것을 봤습니다. iOS 만 알려 줍니다.</li>
 *   <li><b>handed</b> — 캘린더 앱에 넘겼고 <b>그 뒤는 모릅니다.</b>
 *       안드로이드가 저장했는지 닫았는지를 알려 주지 않습니다.
 *       「넣었어요」라고 말하면 안 되는 칸입니다.</li>
 *   <li><b>cancelled</b> — 닫거나 지웠습니다. 아무 말도 안 합니다.</li>
 *   <li><b>tooOld</b> — 이 말을 모르는 껍데기입니다. 앱을 새로 받아야
 *       합니다.</li>
 *   <li><b>failed</b> — 껍데기가 넘어졌습니다.</li>
 * </ul>
 */
export type Added = 'added' | 'handed' | 'cancelled' | 'tooOld' | 'failed';

export async function addToCalendar(trip: TripEvent): Promise<Added> {
  if (!inShell) {
    return 'tooOld';
  }
  try {
    const said = await askShell({ kind: 'addToCalendar', ...trip });
    if (said === 'added' || said === 'handed' || said === 'cancelled') {
      return said;
    }
    /* 답이 비어서 옵니다 — 이 말을 모르는 껍데기입니다. 알림은 OTA 로
       안 들어가는 것과 같은 자리라, 앱을 새로 구워야 합니다. */
    return 'tooOld';
  } catch {
    return 'failed';
  }
}
