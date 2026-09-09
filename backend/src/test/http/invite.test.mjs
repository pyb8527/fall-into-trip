/* 회원가입 → 여행 만들기 → 초대 링크로 동행자 부르기 */
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
const reg = (email, name) => call("POST", "/api/auth/register",
  { body: { email, name, password: "pw-12345678" } });

console.log("\n[1] 누구나 가입한다");
let r = await reg("mina@test.com", "미나");
T("가입", r.status === 200, r.data);
T("가입하면 바로 로그인 상태", !!r.data?.accessToken);
T("역할은 MEMBER", r.data?.user?.role === "MEMBER", r.data?.user);
const mina = r.data.accessToken;

r = await reg("MINA@test.com", "중복");
T("같은 이메일 재가입 거부(대소문자 무관)", r.status === 400, r.data);
r = await call("POST", "/api/auth/register", { body: { email: "x@t.com", name: "x", password: "짧음" } });
T("짧은 비밀번호 거부", r.status === 400, r.data);

r = await reg("jun@test.com", "준");
const jun = r.data.accessToken;
const junId = r.data.user.id;
T("두 번째 사람 가입", r.status === 200);

r = await reg("nam@test.com", "남");
const nam = r.data.accessToken;

console.log("\n[2] 가입자는 자기 여행이 없다");
r = await call("GET", "/api/trips", { token: mina });
T("처음엔 여행이 없음", r.data?.trips?.length === 0, r.data);

console.log("\n[3] 내가 만든 여행");
r = await call("POST", "/api/trips", { token: mina, body: { title: "도쿄 3박 4일", startIso: "2026-10-08", nights: 3 } });
T("여행 생성", r.status === 200, r.data);
const tripId = r.data.trip.id;
r = await call("GET", "/api/trips", { token: mina });
T("내 목록에 나옴", r.data.trips.length === 1 && r.data.trips[0].id === tripId);

r = await call("GET", "/api/trips", { token: jun });
T("남의 여행은 안 보임", r.data.trips.length === 0, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: jun });
T("직접 id 로도 못 봄(404)", r.status === 404, r.data);

console.log("\n[4] 초대 링크");
r = await call("POST", "/api/trips/" + tripId + "/invites", { token: jun, body: {} });
T("동행자 아닌 사람은 초대 못 만듦", r.status === 404, r.data);

r = await call("POST", "/api/trips/" + tripId + "/invites", { token: mina, body: { role: "EDITOR", days: 7, maxUses: 2 } });
T("주인이 링크 생성", r.status === 200, r.data);
const token1 = r.data.invite.token;
T("토큰을 한 번 돌려줌", typeof token1 === "string" && token1.length > 20);
T("역할·기한 포함", r.data.invite.role === "EDITOR" && !!r.data.invite.expiresAt, r.data.invite);

r = await call("GET", "/api/trips/" + tripId + "/invites", { token: mina });
T("목록에는 토큰이 없음", r.data.invites.length === 1 && r.data.invites[0].token === undefined, r.data.invites[0]);

r = await call("GET", "/api/invites/" + token1 + "/preview");
T("로그인 없이 미리보기", r.status === 200, r.data);
T("여행 이름과 부른 사람", r.data.invite.tripTitle === "도쿄 3박 4일" && r.data.invite.ownerName === "미나", r.data.invite);

console.log("\n[5] 링크로 참여");
r = await call("POST", "/api/invites/" + token1 + "/accept");
T("로그인 없이는 참여 불가", r.status === 401, r.data);

r = await call("POST", "/api/invites/" + token1 + "/accept", { token: jun });
T("준이 참여", r.status === 200 && r.data.tripId === tripId, r.data);
r = await call("GET", "/api/trips", { token: jun });
T("준의 목록에 나옴", r.data.trips.length === 1, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: jun });
T("준이 일정을 봄", r.status === 200 && r.data.myRole === "EDITOR", r.data?.myRole);

console.log("\n[6] 공동 편집 — 진짜 두 사람으로");
r = await call("GET", "/api/trip?trip=" + tripId, { token: mina });
const dayId = r.data.days[0].id;
r = await call("POST", "/api/places", { token: jun, body: { dayId, name: "준이 넣은 곳", lat: 35.68, lng: 139.76, time: "10:00" } });
T("동행자가 장소 추가", r.status === 200, r.data);
const placeId = r.data.place.id;
r = await call("GET", "/api/trip?trip=" + tripId, { token: mina });
const seen = r.data.days[0].places.find(p => p.id === placeId);
T("주인에게도 보임", !!seen, r.data.days[0].places.map(p=>p.name));

r = await call("PATCH", "/api/places/" + placeId, { token: mina, body: { note: "미나가 먼저", version: seen.version } });
T("주인이 먼저 저장", r.status === 200);
r = await call("PATCH", "/api/places/" + placeId, { token: jun, body: { note: "준이 덮어쓰기", version: seen.version } });
T("준의 나중 저장은 409", r.status === 409, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: jun });
T("미나 내용이 지켜짐", r.data.days[0].places.find(p=>p.id===placeId).note === "미나가 먼저");

console.log("\n[7] 보기 전용 동행자");
r = await call("POST", "/api/trips/" + tripId + "/invites", { token: mina, body: { role: "VIEWER" } });
const token2 = r.data.invite.token;
r = await call("POST", "/api/invites/" + token2 + "/accept", { token: nam });
T("남이 VIEWER 로 참여", r.status === 200);
r = await call("GET", "/api/trip?trip=" + tripId, { token: nam });
T("보기는 됨", r.status === 200 && r.data.myRole === "VIEWER", r.data?.myRole);
r = await call("POST", "/api/places", { token: nam, body: { dayId, name: "안됨", lat: 35, lng: 139 } });
T("고치기는 막힘(403)", r.status === 403, r.data);
r = await call("DELETE", "/api/trips/" + tripId, { token: nam });
T("여행 삭제도 막힘", r.status === 403, r.data);

console.log("\n[8] 링크 한도와 폐기");
r = await call("POST", "/api/invites/" + token1 + "/accept", { token: nam });
T("이미 들어온 사람은 그냥 통과", r.status === 200, r.data);
r = await call("POST", "/api/trips/" + tripId + "/invites", { token: mina, body: { maxUses: 1 } });
const token3 = r.data.invite.token;
const inviteId3 = r.data.invite.id;
r = await call("DELETE", "/api/invites/" + inviteId3, { token: mina });
T("링크 폐기", r.status === 200);
r = await call("GET", "/api/invites/" + token3 + "/preview");
T("폐기한 링크는 못 씀", r.status === 400 || r.status === 404, r.data);

console.log("\n[9] 내보내기와 나가기");
r = await call("DELETE", "/api/trips/" + tripId + "/members/" + junId, { token: nam });
T("주인 아니면 못 내보냄", r.status === 403, r.data);
r = await call("POST", "/api/trips/" + tripId + "/leave", { token: nam });
T("스스로 나가기", r.status === 200, r.data);
r = await call("GET", "/api/trips", { token: nam });
T("목록에서 사라짐", r.data.trips.length === 0);
r = await call("POST", "/api/trips/" + tripId + "/leave", { token: mina });
T("주인은 나갈 수 없음", r.status === 400, r.data);
r = await call("DELETE", "/api/trips/" + tripId + "/members/" + junId, { token: mina });
T("주인이 동행자를 내보냄", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + tripId, { token: jun });
T("내보낸 뒤에는 못 봄", r.status === 404, r.data);

console.log("\n[10] 기한 없는 초대");
r = await call("POST", "/api/trips/" + tripId + "/invites", { token: mina, body: { role: "VIEWER", days: 0 } });
T("기한 없이 만들어짐", r.status === 200 && r.data.invite.expiresAt == null, r.data);
const forever = r.data.invite.token;
r = await call("GET", "/api/invites/" + forever + "/preview");
T("미리보기도 기한이 비어 있음", r.status === 200 && r.data.invite.expiresAt == null, r.data);
r = await call("POST", "/api/invites/" + forever + "/accept", { token: nam });
T("기한 없는 링크로 들어감", r.status === 200, r.data);
r = await call("GET", "/api/trips/" + tripId + "/invites", { token: mina });
T("목록에도 기한이 비어 있음", r.data.invites.some((i) => i.expiresAt == null), r.data.invites);

console.log("\n[11] 여행 삭제는 주인만");
r = await call("DELETE", "/api/trips/" + tripId, { token: mina });
T("주인이 지움", r.status === 200, r.data);
r = await call("GET", "/api/trips", { token: mina });
T("목록이 비었고 마지막 여행 제한도 없음", r.data.trips.length === 0, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
