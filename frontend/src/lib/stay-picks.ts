import type { Day } from '@/api/types';

/** 장소로 넣을 수 있는 숙소 하나 — 그 여행의 날들에 적어 둔 것에서 모읍니다. */
export type StayPick = {
  name: string;
  lat: number;
  lng: number;
  placeId: string | null;
  /** 「오늘 밤」 · 「전날 밤」 · 「10/3」 처럼 언제 묵는 곳인지. */
  when: string;
};

/**
 * 이 날(di)에 장소로 넣을 만한 숙소들 — 가까운 날 차례로.
 *
 * <p>「호텔에 들러 짐을 맡긴다」 를 일정에 넣으려면 숙소를 장소 검색으로 다시
 * 찾아야 했습니다. 이미 숙소 칸에 이름과 자리를 적어 두었는데도요. 적어 둔 것을
 * 그대로 꺼내 씁니다 — 구글을 다시 부르지 않습니다.
 *
 * <p>그날 숙소가 맨 위, 전날 숙소가 다음입니다(아침에 나서는 곳). 그 뒤로는 날이
 * 가까운 차례이고, 같은 거리면 앞 날이 먼저입니다. 이름과 자리가 같은 숙소(여러
 * 날 묵는 호텔)는 한 번만 — 가장 가까운 날 것으로 섭니다. 자리를 모르는 숙소는
 * 뺍니다. 장소는 지도에 찍을 자리가 있어야 들어갑니다.
 */
export function staysFor(days: Day[], di: number): StayPick[] {
  const seen = new Map<string, { pick: StayPick; rank: number }>();
  days.forEach((day, dj) => {
    const stay = day.stay;
    if (!stay || stay.lat == null || stay.lng == null || !stay.name.trim()) {
      return;
    }
    const rank = dj <= di ? (di - dj) * 2 : (dj - di) * 2 + 1;
    const key = `${stay.name.trim()}@${stay.lat.toFixed(5)},${stay.lng.toFixed(5)}`;
    const had = seen.get(key);
    if (had && had.rank <= rank) {
      return;
    }
    seen.set(key, {
      rank,
      pick: {
        name: stay.name.trim(),
        lat: stay.lat,
        lng: stay.lng,
        placeId: stay.placeId ?? null,
        when: dj === di ? '오늘 밤' : dj === di - 1 ? '전날 밤' : `${day.date || day.label} 밤`,
      },
    });
  });
  return [...seen.values()].sort((a, b) => a.rank - b.rank).map((v) => v.pick);
}
