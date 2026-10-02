/**
 * 좌표 → 가까운 큰 도시 이름. 저장 화면의 「도쿄 12 · 오사카 4」 묶음이 씁니다.
 *
 * <h3>바깥 지명 서비스를 안 부릅니다</h3>
 *
 * <p>저장할 때 도시를 받지 않고 좌표만 둡니다. 좌표를 도시 이름으로 바꾸려면
 * 구글 지오코딩 같은 것을 장소마다 불러야 하고, 저장 목록을 열 때마다 그 값이
 * 듭니다(plan-review I · Q6). 그래서 여행지로 자주 가는 도시를 여기 적어 두고
 * <b>가장 가까운 것</b>으로 묶습니다. 어느 도시에서도 멀면(70km 넘게) 「그 밖」
 * 입니다.
 *
 * <p>틀릴 수 있다는 것을 압니다 — 교토와 오사카처럼 붙어 있는 도시는 경계
 * 근처에서 섞입니다. 묶음은 고르기 쉽게 하려는 것이지 주소가 아닙니다. 목록이
 * 넓어지면 여기에 도시를 더합니다.
 */
type City = { name: string; lat: number; lng: number };

const CITIES: City[] = [
  /* 일본 */
  { name: '도쿄', lat: 35.6812, lng: 139.7671 },
  { name: '요코하마', lat: 35.4437, lng: 139.638 },
  { name: '오사카', lat: 34.6937, lng: 135.5023 },
  { name: '교토', lat: 35.0116, lng: 135.7681 },
  { name: '고베', lat: 34.6901, lng: 135.1955 },
  { name: '나라', lat: 34.6851, lng: 135.8048 },
  { name: '나고야', lat: 35.1815, lng: 136.9066 },
  { name: '후쿠오카', lat: 33.5902, lng: 130.4017 },
  { name: '삿포로', lat: 43.0618, lng: 141.3545 },
  { name: '오키나와', lat: 26.2124, lng: 127.6809 },
  { name: '히로시마', lat: 34.3853, lng: 132.4553 },
  { name: '가나자와', lat: 36.5613, lng: 136.6562 },
  /* 한국 */
  { name: '서울', lat: 37.5665, lng: 126.978 },
  { name: '부산', lat: 35.1796, lng: 129.0756 },
  { name: '제주', lat: 33.4996, lng: 126.5312 },
  { name: '강릉', lat: 37.7519, lng: 128.8761 },
  { name: '경주', lat: 35.8562, lng: 129.2247 },
  { name: '여수', lat: 34.7604, lng: 127.6622 },
  { name: '전주', lat: 35.8242, lng: 127.148 },
  { name: '속초', lat: 38.207, lng: 128.5918 },
  /* 가까운 나라 */
  { name: '타이베이', lat: 25.033, lng: 121.5654 },
  { name: '홍콩', lat: 22.3193, lng: 114.1694 },
  { name: '상하이', lat: 31.2304, lng: 121.4737 },
  { name: '방콕', lat: 13.7563, lng: 100.5018 },
  { name: '다낭', lat: 16.0544, lng: 108.2022 },
  { name: '하노이', lat: 21.0278, lng: 105.8342 },
  { name: '호찌민', lat: 10.8231, lng: 106.6297 },
  { name: '싱가포르', lat: 1.3521, lng: 103.8198 },
  { name: '세부', lat: 10.3157, lng: 123.8854 },
  { name: '발리', lat: -8.4095, lng: 115.1889 },
  { name: '괌', lat: 13.4443, lng: 144.7937 },
  /* 먼 곳 */
  { name: '파리', lat: 48.8566, lng: 2.3522 },
  { name: '런던', lat: 51.5072, lng: -0.1276 },
  { name: '로마', lat: 41.9028, lng: 12.4964 },
  { name: '바르셀로나', lat: 41.3874, lng: 2.1686 },
  { name: '뉴욕', lat: 40.7128, lng: -74.006 },
  { name: '로스앤젤레스', lat: 34.0522, lng: -118.2437 },
  { name: '하와이', lat: 21.3069, lng: -157.8583 },
];

/** 이 거리(km)보다 멀면 어느 도시도 아닙니다. */
const REACH_KM = 70;

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** 가장 가까운 도시. 어디서도 멀면 null. */
export function cityOf(lat: number, lng: number): string | null {
  let best: City | null = null;
  let bestKm = Infinity;
  for (const c of CITIES) {
    const d = km({ lat, lng }, c);
    if (d < bestKm) {
      best = c;
      bestKm = d;
    }
  }
  return best && bestKm <= REACH_KM ? best.name : null;
}

/** 묶음에 이름이 없을 때 쓰는 말. */
export const ELSEWHERE = '그 밖';
