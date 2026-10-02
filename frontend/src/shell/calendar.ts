import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

/**
 * 여행 하나를 폰 캘린더에 꽂기 (껍데기).
 *
 * <h3>구독과 다른 것을 줍니다</h3>
 *
 * <p>이미 구독 주소가 있습니다({@code /api/cal/{열쇠}.ics}). 그쪽은 일정이
 * 바뀌면 캘린더도 <b>따라 바뀝니다</b> — 동행자가 날짜를 하루 미루면 캘린더도
 * 미뤄집니다. 대신 주소를 캘린더 앱에 등록하는 그 한 번이 폰에서 번거롭고,
 * 구글 캘린더는 몇 시간에 한 번만 읽어 갑니다.
 *
 * <p>이쪽은 <b>그 자리에서</b> 들어갑니다. 대신 한 번뿐입니다 — 그 뒤에
 * 일정이 바뀌어도 캘린더는 모릅니다. 둘 중 하나를 고르는 것이 아니라
 * 쓰는 자리가 다르므로 둘 다 둡니다.
 *
 * <h3>우리가 쓰지 않고 캘린더 앱에 넘깁니다</h3>
 *
 * <p>{@code createEventAsync} 로 직접 쓸 수도 있습니다. 그러려면 캘린더
 * 허락을 받아야 하고, 어느 캘린더에 넣을지를 <b>우리가</b> 골라야 합니다 —
 * 회사 캘린더에 개인 여행을 꽂아 놓는 일이 그렇게 생깁니다.
 *
 * <p>{@code createEventInCalendarAsync} 는 폰이 가진 「일정 추가」 판을
 * 띄웁니다. 제목과 날짜가 채워진 채로 뜨고, 어느 캘린더에 넣을지와 저장할지를
 * <b>사람이</b> 정합니다. 허락을 물을 일도 없습니다 — 쓰는 쪽이 캘린더 앱이기
 * 때문입니다. 이 저장소가 허락 창을 아끼는 것과 같은 결입니다
 * ({@code lib/notify.ts} 의 머리글).
 *
 * <h3>하루 종일 일정의 끝날이 쪽마다 다릅니다</h3>
 *
 * <p>iOS 는 <b>마지막 날</b>을 끝으로 봅니다. 안드로이드는 <b>그 다음 날
 * 자정</b>을 끝으로 봅니다(한 칸 열린 구간). 같은 값을 주면 한쪽이 하루
 * 짧거나 길게 뜹니다. ICS 쪽은 안드로이드와 같은 규칙입니다
 * ({@code CalendarService} 의 {@code DTEND ... to.plusDays(1)}).
 */

/** 넣을 여행 한 건. */
export type TripEvent = {
  title: string;
  /** 첫날 (YYYY-MM-DD). */
  startIso: string;
  /** 마지막 날 (YYYY-MM-DD). 하루짜리면 첫날과 같습니다. */
  endIso: string;
  /** 일정 안에 적어 둘 한 줄과 돌아올 주소. */
  notes: string;
  url: string;
};

/**
 * 어떻게 끝났는지.
 *
 * <ul>
 *   <li><b>added</b> — 저장한 것을 봤습니다. iOS 만 알려 줍니다.</li>
 *   <li><b>cancelled</b> — 닫거나 지웠습니다.</li>
 *   <li><b>handed</b> — 캘린더 앱에 넘겼고 <b>그 뒤는 모릅니다.</b>
 *       안드로이드는 저장했는지 닫았는지를 알려 주지 않습니다. 화면은 이
 *       경우에 「넣었어요」라고 말하면 안 됩니다.</li>
 * </ul>
 */
export type Added = 'added' | 'cancelled' | 'handed';

export async function addTripToCalendar(trip: TripEvent): Promise<Added> {
  const got = await Calendar.createEventInCalendarAsync({
    title: trip.title,
    allDay: true,
    startDate: dayStart(trip.startIso),
    /* 쪽마다 끝날의 뜻이 다릅니다 — 머리글을 보세요. */
    endDate: Platform.OS === 'ios' ? dayStart(trip.endIso) : dayStart(trip.endIso, 1),
    notes: trip.notes,
    url: trip.url,
  });

  if (got.action === 'canceled' || got.action === 'deleted') {
    return 'cancelled';
  }
  /* 'saved' 는 iOS 만 줍니다. 안드로이드는 늘 'done' 이라 아무것도 모릅니다. */
  return got.action === 'saved' ? 'added' : 'handed';
}

/**
 * 그 날의 자정.
 *
 * <p>{@code new Date('2026-10-03')} 은 UTC 자정으로 읽힙니다. 한국에서는
 * 그것이 <b>전날 아침 9시</b>라, 하루 종일 일정이 하루 앞으로 밀립니다.
 * 조각을 떼어 폰이 있는 자리의 자정으로 만듭니다.
 *
 * @param plus 며칠 뒤로. 끝이 열린 구간을 만들 때 1 을 줍니다
 */
function dayStart(iso: string, plus = 0): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d + plus);
}
