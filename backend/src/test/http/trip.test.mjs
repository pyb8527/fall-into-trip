/* 여행·날짜·장소 + 공동 편집 점검 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0,200) : ""));

async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

console.log("\n[1] 준비 — 관리자와 동행자 두 명");
let r = await call("POST", "/api/auth/setup", { body: { email: "admin@t.test", name: "관리자", password: "pw-12345678", token: "devtoken" } });
T("관리자 생성", r.status === 200, r.data);
const admin = r.data.accessToken;

r = await call("GET", "/api/trips", { token: admin });
/* 예전에는 설치하면 빈 여행이 하나 생겼습니다. 지금은 만들지 않습니다 —
   쓰지도 않을 것이 목록에 남아 지우는 일부터 하게 됩니다. */
T("처음에는 여행이 없음", r.data?.trips?.length === 0, r.data);

console.log("\n[2] 여행 만들기");
r = await call("POST", "/api/trips", { token: admin, body: { title: "도쿄 3박 4일", startIso: "2026-10-08", nights: 3 } });
T("여행 생성", r.status === 200, r.data);
const tripId = r.data.trip.id;

r = await call("GET", "/api/trip?trip=" + tripId, { token: admin });
T("날짜 4개 자동 생성", r.data?.days?.length === 4, r.data?.days?.length);
T("첫날 2026-10-08", r.data.days[0].iso === "2026-10-08", r.data.days[0]);
T("요일 계산 정확 (10/08=목)", r.data.days[0].date === "10.08 (목)", r.data.days[0].date);
T("마지막날 2026-10-11", r.data.days[3].iso === "2026-10-11", r.data.days[3].iso);
T("날짜별 색이 다름", new Set(r.data.days.map(d => d.color)).size === 4);
T("내 역할 EDITOR", r.data.myRole === "EDITOR", r.data.myRole);
const day1 = r.data.days[0].id;

r = await call("POST", "/api/trips", { token: admin, body: { title: "", startIso: "2026-10-08", nights: 3 } });
T("빈 이름 거부", r.status === 400, r.data);
r = await call("POST", "/api/trips", { token: admin, body: { title: "x", startIso: "2026-13-99", nights: 1 } });
T("잘못된 날짜 거부", r.status === 400, r.data);

console.log("\n[3] 장소");
r = await call("POST", "/api/places", { token: admin, body: { dayId: day1, name: "나리타 공항", lat: 35.7653, lng: 140.3856, time: "15:50", cat: "도착" } });
T("장소 추가", r.status === 200, r.data);
const p1 = r.data.place.id;
T("고정 ID 부여", typeof p1 === "string" && p1.length === 12, p1);

r = await call("POST", "/api/places", { token: admin, body: { dayId: day1, name: "좌표 없음", lat: 999, lng: 0 } });
T("좌표 범위 검증", r.status === 400 && /위도/.test(r.data.error), r.data);
r = await call("POST", "/api/places", { token: admin, body: { dayId: day1, name: "시간 이상", lat: 35, lng: 139, time: "25:99" } });
T("시간 형식 검증", r.status === 400, r.data);
r = await call("POST", "/api/places", { token: admin, body: { dayId: day1, name: "", lat: 35, lng: 139 } });
T("빈 이름 거부", r.status === 400, r.data);

/* 시간순 자동 정렬 — 늦은 시간을 먼저 넣어도 앞으로 가지 않아야 한다 */
await call("POST", "/api/places", { token: admin, body: { dayId: day1, name: "저녁", lat: 35.68, lng: 139.76, time: "21:00" } });
await call("POST", "/api/places", { token: admin, body: { dayId: day1, name: "점심", lat: 35.68, lng: 139.77, time: "12:00" } });
await call("POST", "/api/places", { token: admin, body: { dayId: day1, name: "미정", lat: 35.69, lng: 139.78 } });
r = await call("GET", "/api/trip?trip=" + tripId, { token: admin });
const names = r.data.days[0].places.map(p => p.name);
T("시간순 정렬", JSON.stringify(names) === JSON.stringify(["점심","나리타 공항","저녁","미정"]), names);
T("시간 없는 곳은 뒤로", names[names.length-1] === "미정", names);

r = await call("PATCH", "/api/places/" + p1, { token: admin, body: { cost: "¥2,580", note: "스카이라이너" } });
T("장소 수정", r.status === 200 && r.data.place.cost === "¥2,580", r.data);
T("고칠 때마다 version 이 오름", r.data.place.version > 0, r.data.place.version);

console.log("\n[4] 방문 체크 — 사람마다 따로");
r = await call("PUT", "/api/visits/" + p1, { token: admin });
T("방문 표시", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: admin });
T("내 방문에 반영", r.data.visited.includes(p1), r.data.visited);

console.log("\n[5] 공동 편집 — 두 사람이 같은 여행을");
/* 동행자 계정을 만들려면 관리자 API 가 필요하다. 아직 없으므로 여기서는
   같은 계정의 두 세션으로 동시 수정만 확인한다. */
r = await call("GET", "/api/trip?trip=" + tripId, { token: admin });
const fresh = r.data.days[0].places.find(p => p.id === p1);
T("현재 version 읽음", typeof fresh.version === "number", fresh.version);

/* 두 사람이 같은 화면을 열어 둔 상황 — 한쪽이 먼저 저장 */
const seen = fresh.version;              // 두 사람이 같은 판을 보고 있다
r = await call("PATCH", "/api/places/" + p1, { token: admin, body: { note: "A 가 먼저 고침", version: seen } });
T("먼저 저장한 쪽 성공", r.status === 200, r.data);
T("version 이 올라감", r.data.place.version === seen + 1, r.data.place.version);

/* 뒤엣사람은 아직 옛 판을 들고 있다 */
r = await call("PATCH", "/api/places/" + p1, { token: admin, body: { note: "B 가 덮어쓰려 함", version: seen } });
T("나중 저장은 409 로 막힘", r.status === 409, r.data);
T("이유를 알려 줌", /먼저 고쳤습니다/.test(r.data?.error ?? ""), r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: admin });
const kept = r.data.days[0].places.find(p => p.id === p1);
T("앞사람 내용이 지켜짐", kept.note === "A 가 먼저 고침", kept.note);

/* 새로 불러온 판으로는 저장된다 */
r = await call("PATCH", "/api/places/" + p1, { token: admin, body: { note: "B 가 다시 시도", version: kept.version } });
T("새로 불러오면 저장됨", r.status === 200, r.data);

/* 판 번호를 안 보내면 검사하지 않는다 */
r = await call("PATCH", "/api/places/" + p1, { token: admin, body: { cost: "¥100" } });
T("version 을 생략하면 그냥 저장", r.status === 200, r.data);

console.log("\n[6] 날짜 더하고 지우기");
r = await call("POST", "/api/days", { token: admin, body: { tripId } });
T("날짜 추가", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: admin });
T("5일이 됨", r.data.days.length === 5, r.data.days.length);
T("이어지는 날짜 자동", r.data.days[4].iso === "2026-10-12", r.data.days[4].iso);
const lastDay = r.data.days[4].id;

r = await call("DELETE", "/api/days/" + lastDay, { token: admin });
T("날짜 삭제", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: admin });
T("4일로 복귀", r.data.days.length === 4);
T("순번 재정렬", r.data.days.map(d => d.sort).join() === "0,1,2,3", r.data.days.map(d => d.sort));

console.log("\n[7] 시작일을 옮기면 나머지도 따라온다");
r = await call("PATCH", "/api/trips/" + tripId, { token: admin, body: { startIso: "2026-11-01" } });
T("시작일 변경", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: admin });
T("모든 날짜가 같이 이동", r.data.days.map(d => d.iso).join() === "2026-11-01,2026-11-02,2026-11-03,2026-11-04", r.data.days.map(d=>d.iso));
T("표시 문자열도 갱신", r.data.days[0].date === "11.01 (일)", r.data.days[0].date);

console.log("\n[8] 삭제");
r = await call("DELETE", "/api/trips/" + tripId, { token: admin });
T("여행 삭제", r.status === 200, r.data);
r = await call("GET", "/api/trips", { token: admin });
/* 예전에는 마지막 하나는 못 지우게 막았습니다. 지금은 그 제한이 없습니다 —
   다 지우고 처음부터 짜고 싶을 수 있고, 빈 목록이 잘못된 상태도 아닙니다. */
T("남김없이 지울 수 있음", r.data.trips.length === 0, r.data.trips);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
