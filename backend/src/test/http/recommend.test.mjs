/*
  말로 묻고 갈 곳 받기 — 울타리 부분.

  구글 키가 없는 곳에서 돕니다. 그래서 실제 추천 결과는 여기서 못 봅니다 —
  그건 키를 넣고 사람이 눌러 봐야 아는 일입니다. 여기서 보는 것은 그 앞의
  것들입니다: 누가 부를 수 있는지, 무엇을 거절하는지, 남의 여행 날짜를
  섞어 넣을 수 있는지.
*/
const BASE = process.env.BASE || "http://127.0.0.1:8080";
const SETUP_TOKEN = process.env.SETUP_TOKEN || "devtoken";
const J = { "content-type": "application/json" };

let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x) : ""));

async function call(method, path, { body, token } = {}) {
  const headers = { ...J };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

const TAG = Date.now().toString(36);
let r;

console.log("\n[0] 준비");
r = await call("POST", "/api/auth/setup", { body: { email: "admin@local.test", name: "관리자", password: "trip-test-1234", token: SETUP_TOKEN } });
const host = r.data.accessToken;
T("운영자 준비", !!host, r.data);

r = await call("POST", "/api/auth/register", { body: { email: `mate-${TAG}@local.test`, name: "동행자", password: "mate-test-1234" } });
const mate = r.data.accessToken;
r = await call("POST", "/api/auth/register", { body: { email: `x-${TAG}@local.test`, name: "남", password: "other-test-1234" } });
const stranger = r.data.accessToken;

r = await call("POST", "/api/trips", { token: host, body: { title: "오사카", startIso: "2026-11-02", nights: 1 } });
const tripId = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${tripId}`, { token: host });
const days = r.data.days;

r = await call("POST", "/api/trips", { token: stranger, body: { title: "남의 여행", startIso: "2026-12-01", nights: 1 } });
const otherTrip = r.data.trip.id;
r = await call("GET", `/api/trip?trip=${otherTrip}`, { token: stranger });
const otherDay = r.data.days[0].id;

const ask = (body, token) => call("POST", `/api/trips/${tripId}/recommend`, { token, body });

console.log("\n[1] 볼 수 있는 사람만");
r = await ask({ query: "조용한 카페" }, stranger);
T("남은 못 부른다", r.status === 403 || r.status === 404, r.data);
r = await ask({ query: "조용한 카페" }, undefined);
T("로그인 없이는 못 부른다", r.status === 401, r.data);

r = await call("POST", `/api/trips/${tripId}/invites`, { token: host, body: { role: "EDITOR" } });
await call("POST", `/api/invites/${r.data.invite.token}/accept`, { token: mate });

console.log("\n[2] 무엇을 거절하는가");
r = await ask({ query: "" }, host);
T("빈 질의는 거절", r.status === 400 && /한 줄/.test(r.data.error), r.data);
r = await ask({}, host);
T("질의가 아예 없어도 거절", r.status === 400, r.data);
r = await ask({ query: "   " }, host);
T("공백만 있어도 거절", r.status === 400, r.data);
r = await ask({ query: "가".repeat(201) }, host);
T("너무 길면 거절", r.status === 400 && /줄여/.test(r.data.error), r.data);

console.log("\n[3] 날짜는 이 여행의 것이어야 한다");
r = await ask({ query: "카페", dayId: otherDay }, host);
T("남의 여행 날짜는 거절", r.status === 400 && /이 여행의 날짜/.test(r.data.error), r.data);
r = await ask({ query: "카페", dayId: "없는날짜" }, host);
T("없는 날짜는 404", r.status === 404, r.data);

console.log("\n[4] 키가 없으면 정직하게 말한다");
/*
  이 서버에는 구글 키가 없습니다. 그때 빈 목록을 조용히 내놓으면 "찾은 곳이
  없구나" 로 읽힙니다. 검색이 꺼져 있다는 것과 찾은 곳이 없다는 것은 다른
  말입니다.
*/
r = await ask({ query: "비 올 때 갈 만한 실내", dayId: days[0].id }, host);
T("검색이 꺼져 있다고 말한다", r.status === 400 && /검색이 꺼져/.test(r.data.error), r.data);

console.log("\n[5] 지금 자리는 본문으로 받는다");
/* 주소에 실으면 nginx 접근 기록과 브라우저 방문 기록에 남습니다.
   본문으로 받는지는 좌표를 넣어도 같은 자리까지 간다는 것으로 봅니다. */
r = await ask({ query: "카페", here: { lat: 34.6, lng: 135.5 } }, host);
T("좌표를 본문으로 받는다", r.status === 400 && /검색이 꺼져/.test(r.data.error), r.data);
r = await ask({ query: "카페", here: { lat: 999, lng: 999 } }, host);
T("이상한 좌표는 거절", r.status === 400 && /위도|경도/.test(r.data.error), r.data);

console.log("\n[6] 동행자도 물어볼 수 있다");
r = await ask({ query: "카페" }, mate);
T("동행자는 부를 수 있다", r.status === 400 && /검색이 꺼져/.test(r.data.error), r.data);

console.log("\n[7] 여행 없이도 물어본다 — 보석함에서");
/* 보석함은 "다음에 가면 갈 데" 를 모아 두는 자리다. 담으려고 여행을 먼저
   만들게 하는 것은 순서가 뒤집힌 일이다 */
r = await call("POST", "/api/recommend", { token: host, body: { query: "조용한 카페" } });
T("여행 없이 부를 수 있다", r.status === 400 && /검색이 꺼져/.test(r.data.error), r.data);
r = await call("POST", "/api/recommend", { token: host, body: { query: "" } });
T("빈 질의는 여기서도 거절", r.status === 400 && /한 줄/.test(r.data.error), r.data);
r = await call("POST", "/api/recommend", { body: { query: "카페" } });
T("로그인은 필요하다", r.status === 401, r.data);
r = await call("POST", "/api/recommend", { token: host, body: { query: "카페", dayId: days[0].id } });
T("여행 없이 날짜만 고를 수는 없다", r.status === 400 && /여행 없이/.test(r.data.error), r.data);

console.log("\n[8] 장소 하나의 사정");
/* 이 서버에는 구글 키가 없다. 그때는 빈 것을 돌려준다 — 오류가 아니다.
   화면은 이름과 주소만으로 그린다 */
r = await call("GET", "/api/places/ChIJN1t_tDeuEmsRUsoyG83frY4/info", { token: host });
T("키가 없으면 빈 것을 돌려준다", r.status === 200 && !r.data.info, r.data);
r = await call("GET", "/api/places/abc/info?on=2026-11-02", { token: host });
T("날짜를 함께 줘도 된다", r.status === 200, r.data);
r = await call("GET", "/api/places/abc/info?on=%EC%96%B8%EC%A0%A0%EA%B0%80", { token: host });
T("이상한 날짜는 거절", r.status === 400, r.data);
r = await call("GET", "/api/places/abc/info");
T("로그인 없이는 못 본다", r.status === 401, r.data);


console.log("\n[9] 두 곳 사이에서 찾기 — 울타리");
/*
  이 서버에는 구글 키가 없다. 그래서 "실제로 선으로 찾으면 답이 달라지는가" 는
  여기서 못 본다 — 그건 키가 있는 데서 사람이 눌러 봐야 아는 일이다.

  여기서 보는 것은 그 앞이다. 무엇보다 between 이 placeId 를 받으므로, 거르지
  않으면 그것으로 남의 여행에 그 장소가 있는지 물어볼 수 있게 된다.

  키가 없으면 검색이 "꺼져 있습니다" 로 끝난다. 그 말이 나왔다는 것은 그 앞의
  울타리를 전부 지났다는 뜻이다 — 거절은 전부 검색보다 먼저 선다.
*/
r = await call("POST", "/api/places", { token: host, body: { dayId: days[0].id, name: "오사카성", lat: 34.6873, lng: 135.5262 } });
const fromId = r.data.place ? r.data.place.id : r.data.id;
r = await call("POST", "/api/places", { token: host, body: { dayId: days[0].id, name: "도톤보리", lat: 34.6687, lng: 135.5013 } });
const toId = r.data.place ? r.data.place.id : r.data.id;
T("두 곳을 넣었다", !!fromId && !!toId, { fromId, toId });

r = await ask({ query: "점심 먹을 데", dayId: days[0].id, between: { fromPlaceId: fromId, toPlaceId: toId } }, host);
T("울타리를 다 지난다", r.status === 400 && /검색이 꺼져/.test(r.data.error), r.data);

r = await ask({ query: "점심 먹을 데" }, host);
T("between 없이는 지금과 같다", r.status === 400 && /검색이 꺼져/.test(r.data.error), r.data);

r = await ask({ query: "점심", between: { fromPlaceId: fromId, toPlaceId: fromId } }, host);
T("같은 곳 둘은 거절", r.status === 400 && /서로 다른/.test(r.data.error), r.data);

r = await ask({ query: "점심", between: { fromPlaceId: fromId, toPlaceId: "없는곳" } }, host);
T("이 여행에 없는 번호는 거절", r.status === 400 && /이 여행의 장소가/.test(r.data.error), r.data);

/* 남의 여행에 있는 진짜 장소 번호. 이것이 통과하면 between 이 남의 여행을
   들여다보는 통로가 된다. */
r = await call("POST", "/api/places", { token: stranger, body: { dayId: otherDay, name: "남의 가게", lat: 35.0, lng: 135.7 } });
const otherPlace = r.data.place ? r.data.place.id : r.data.id;
r = await ask({ query: "점심", between: { fromPlaceId: fromId, toPlaceId: otherPlace } }, host);
T("남의 여행 장소는 거절", r.status === 400 && /이 여행의 장소가/.test(r.data.error), r.data);
T("있는지 없는지 새지 않는다",
  r.data.error === (await ask({ query: "점심", between: { fromPlaceId: fromId, toPlaceId: "아예없는번호" } }, host)).data.error,
  r.data);

r = await ask({ query: "점심", between: { fromPlaceId: fromId, toPlaceId: toId } }, stranger);
T("동행자가 아니면 못 부른다", r.status === 403 || r.status === 404, r.data);

r = await call("POST", "/api/recommend",
  { token: host, body: { query: "점심", between: { fromPlaceId: fromId, toPlaceId: toId } } });
T("여행 없이 두 곳 사이는 안 된다", r.status === 400 && /여행 없이/.test(r.data.error), r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
