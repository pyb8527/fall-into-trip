/*
  모임과, 모임이 여행을 보이게 하는 규칙.

  여행마다 사람을 따로 불렀던 것(trip_members)을 걷어내고 모임 하나로
  모았습니다. 그래서 「이 여행을 누가 볼 수 있는가」가 한 줄이 되었는데,
  그 한 줄이 저장소 마흔 군데를 지나갑니다. 여기를 잘못 고치면 남의 여행이
  보이거나 내 여행이 안 보입니다 — 그 둘을 먼저 못으로 박아 둡니다.
*/
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0, 200) : ""));

async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

const TAG = Date.now().toString(36);
const reg = (who, name) => call("POST", "/api/auth/register",
  { body: { email: `${who}-${TAG}@local.test`, name, password: "group-test-1234", over14: true, terms: true, privacy: true } });

let r;

console.log("\n[1] 넷이 가입한다");
r = await reg("mina", "미나");
T("가입", r.status === 200, r.data);
const mina = r.data.accessToken;
const minaId = r.data.user.id;

r = await reg("jun", "준");
const jun = r.data.accessToken;
const junId = r.data.user.id;

r = await reg("nam", "남");
const nam = r.data.accessToken;
const namId = r.data.user.id;

r = await reg("bada", "바다");
const bada = r.data.accessToken;
T("넷 다", !!mina && !!jun && !!nam && !!bada);

console.log("\n[2] 모임 만들기");
r = await call("POST", "/api/groups", { token: mina, body: { name: "" } });
T("이름 없는 모임은 거부", r.status === 400, r.data);
r = await call("POST", "/api/groups", { token: mina, body: { name: "ㄱ".repeat(41) } });
T("너무 긴 이름도 거부", r.status === 400, r.data);
r = await call("POST", "/api/groups", { body: { name: "로그인 없이" } });
T("로그인 없이는 못 만듦", r.status === 401, r.data);

r = await call("POST", "/api/groups", { token: mina, body: { name: "토요일 등산", about: "매주 토요일", emoji: "🥾" } });
T("모임 생성", r.status === 200, r.data);
const groupId = r.data.group.id;
T("만든 사람이 주인", r.data.group.ownerId === minaId, r.data.group);
T("처음엔 한 명, 여행 없음", r.data.group.memberCount === 1 && r.data.group.tripCount === 0, r.data.group);

r = await call("GET", "/api/groups", { token: mina });
T("내 모임 목록에 나옴", r.data.groups.length === 1 && r.data.groups[0].id === groupId, r.data);
r = await call("GET", "/api/groups", { token: jun });
T("남의 모임은 안 보임", r.data.groups.length === 0, r.data);
r = await call("GET", "/api/groups/" + groupId, { token: jun });
T("직접 id 로도 못 봄(404, 403 아님)", r.status === 404, r.data);

console.log("\n[3] 모임에 부르기");
r = await call("POST", `/api/groups/${groupId}/invites`, { token: jun, body: {} });
T("멤버 아니면 링크를 못 만듦", r.status === 404, r.data);

r = await call("POST", `/api/groups/${groupId}/invites`, { token: mina, body: { days: 7, maxUses: 2 } });
T("주인이 링크 생성", r.status === 200, r.data);
const link = r.data.invite.token;
T("토큰을 한 번 돌려줌", typeof link === "string" && link.length > 20);
T("기한과 한도", !!r.data.invite.expiresAt && r.data.invite.maxUses === 2, r.data.invite);

r = await call("GET", `/api/groups/${groupId}/invites`, { token: mina });
T("목록에는 토큰이 없음", r.data.invites.length === 1 && r.data.invites[0].token === undefined, r.data.invites[0]);

r = await call("GET", "/api/group-invites/" + link + "/preview");
T("로그인 없이 미리보기", r.status === 200, r.data);
T("모임 이름과 사람 수", r.data.invite.name === "토요일 등산" && r.data.invite.memberCount === 1, r.data.invite);
T("아는 이름이 함께", r.data.invite.someNames.includes("미나"), r.data.invite);

r = await call("POST", "/api/group-invites/" + link + "/accept");
T("로그인 없이는 참여 불가", r.status === 401, r.data);
r = await call("POST", "/api/group-invites/" + link + "/accept", { token: jun });
T("준이 들어옴", r.status === 200 && r.data.groupId === groupId, r.data);
r = await call("POST", "/api/group-invites/" + link + "/accept", { token: jun });
T("두 번 눌러도 그냥 통과", r.status === 200, r.data);

r = await call("GET", "/api/groups/" + groupId, { token: jun });
T("준이 모임을 봄", r.status === 200 && r.data.members.length === 2, r.data);
T("주인이 맨 앞", r.data.members[0].id === minaId, r.data.members);
T("멤버면 누구나 부를 수 있음",
  (await call("POST", `/api/groups/${groupId}/invites`, { token: jun, body: {} })).status === 200);

console.log("\n[4] 모임 멤버가 모임 여행을 본다");
r = await call("POST", "/api/trips", { token: mina, body: { title: "관악산", startIso: "2027-03-06", nights: 0, groupId } });
T("모임 안에서 여행 생성", r.status === 200, r.data);
const groupTrip = r.data.trip.id;
T("여행에 모임이 붙음", r.data.trip.groupId === groupId, r.data.trip);

r = await call("GET", "/api/trip?trip=" + groupTrip, { token: jun });
T("준이 일정을 봄", r.status === 200, r.data);
T("고칠 수 있음 — 모임에 구경꾼은 없음", r.data.canEdit === true, r.data);
T("만든 사람은 아님", r.data.owner === false, r.data);
r = await call("GET", "/api/trips", { token: jun });
T("준의 여행 목록에 나옴", r.data.trips.some((t) => t.id === groupTrip), r.data.trips);
T("모임 이름이 함께 옴 — 화면이 모임 칸으로 묶습니다",
  r.data.trips.find((t) => t.id === groupTrip)?.groupName === "토요일 등산", r.data.trips);

const dayId = (await call("GET", "/api/trip?trip=" + groupTrip, { token: mina })).data.days[0].id;
r = await call("POST", "/api/places", { token: jun, body: { dayId, name: "준이 넣은 곳", lat: 37.44, lng: 126.96, time: "09:00" } });
T("모임 사람이 장소를 넣음", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + groupTrip, { token: mina });
T("주인에게도 보임", r.data.days[0].places.some((p) => p.name === "준이 넣은 곳"), r.data.days[0].places);

r = await call("GET", `/api/trips/${groupTrip}/people`, { token: jun });
T("이 여행의 사람들", r.data.people.length === 2, r.data.people);
T("만든 사람이 맨 앞", r.data.people[0].owner === true && r.data.people[0].name === "미나", r.data.people);

console.log("\n[5] 모임 사람이 아니면 404");
r = await call("GET", "/api/trip?trip=" + groupTrip, { token: nam });
T("남은 못 봄", r.status === 404, r.data);
r = await call("GET", "/api/trips", { token: nam });
T("목록에도 없음", r.data.trips.length === 0, r.data);
r = await call("POST", "/api/places", { token: nam, body: { dayId, name: "안됨", lat: 37, lng: 127 } });
T("고치기도 막힘", r.status === 404 || r.status === 403, r.data);
r = await call("DELETE", "/api/trips/" + groupTrip, { token: nam });
T("지우기도 막힘", r.status === 404 || r.status === 403, r.data);
r = await call("GET", `/api/trips/${groupTrip}/people`, { token: nam });
T("사람들도 못 봄", r.status === 404, r.data);

console.log("\n[6] 남의 모임에 여행을 꽂을 수는 없다");
r = await call("POST", "/api/trips", { token: nam, body: { title: "끼어들기", startIso: "2027-03-06", nights: 0, groupId } });
T("남의 모임 id 로는 못 만듦", r.status === 404, r.data);

console.log("\n[7] 혼자 만든 여행은 모임과 무관하다");
r = await call("POST", "/api/trips", { token: mina, body: { title: "혼자 걷기", startIso: "2027-04-01", nights: 0 } });
const soloTrip = r.data.trip.id;
T("모임 없이 만들어짐", r.data.trip.groupId == null, r.data.trip);
r = await call("GET", "/api/trip?trip=" + soloTrip, { token: jun });
T("같은 모임 사람도 못 봄", r.status === 404, r.data);
r = await call("GET", "/api/trips", { token: jun });
T("준의 목록에도 없음", !r.data.trips.some((t) => t.id === soloTrip), r.data.trips);

console.log("\n[8] 혼자 여행을 모임으로 옮기고, 다시 뺀다");
r = await call("PATCH", `/api/trips/${soloTrip}/group`, { token: jun, body: { groupId } });
T("만든 사람 아니면 못 옮김", r.status === 404 || r.status === 403, r.data);
r = await call("PATCH", `/api/trips/${soloTrip}/group`, { token: mina, body: { groupId } });
T("만든 사람이 옮김", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + soloTrip, { token: jun });
T("이제 준도 봄", r.status === 200, r.data);
r = await call("PATCH", `/api/trips/${soloTrip}/group`, { token: mina, body: { groupId: "" } });
T("다시 혼자 것으로", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + soloTrip, { token: jun });
T("준은 또 못 봄", r.status === 404, r.data);

console.log("\n[9] 모임에서 나가면 그 여행이 안 보인다");
r = await call("DELETE", `/api/groups/${groupId}/members/me`, { token: mina });
T("주인은 못 나감", r.status === 400, r.data);
r = await call("DELETE", `/api/groups/${groupId}/members/me`, { token: jun });
T("준이 나감", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + groupTrip, { token: jun });
T("나간 뒤에는 못 봄", r.status === 404, r.data);
r = await call("GET", "/api/trips", { token: jun });
T("목록에서도 사라짐", !r.data.trips.some((t) => t.id === groupTrip), r.data.trips);
r = await call("GET", "/api/groups", { token: jun });
T("모임 목록도 비었음", r.data.groups.length === 0, r.data);

console.log("\n[10] 내보내기");
r = await call("POST", "/api/group-invites/" + link + "/accept", { token: nam });
T("남이 들어옴", r.status === 200, r.data);
r = await call("GET", "/api/trip?trip=" + groupTrip, { token: nam });
T("들어오자 여행이 보임", r.status === 200, r.data);

r = await call("DELETE", `/api/groups/${groupId}/members/${minaId}`, { token: nam });
T("주인 아니면 못 내보냄", r.status === 403, r.data);
r = await call("DELETE", `/api/groups/${groupId}/members/${minaId}`, { token: mina });
T("스스로는 못 내보냄", r.status === 400, r.data);
r = await call("DELETE", `/api/groups/${groupId}/members/${junId}`, { token: mina });
T("없는 사람은 404", r.status === 404, r.data);

console.log("\n[11] 링크의 한도와 폐기");
r = await call("POST", `/api/groups/${groupId}/invites`, { token: mina, body: { maxUses: 1 } });
const once = r.data.invite.token;
const onceId = r.data.invite.id;
r = await call("POST", "/api/group-invites/" + once + "/accept", { token: bada });
T("한 번 쓰임", r.status === 200, r.data);
r = await call("GET", "/api/group-invites/" + once + "/preview");
T("한도를 넘기면 못 씀", r.status === 400 || r.status === 404, r.data);

r = await call("POST", `/api/groups/${groupId}/invites`, { token: mina, body: {} });
const doomed = r.data.invite.token;
const doomedId = r.data.invite.id;
r = await call("DELETE", "/api/group-invites/" + doomedId, { token: bada });
T("만든 사람도 주인도 아니면 못 막음", r.status === 403, r.data);
r = await call("DELETE", "/api/group-invites/" + doomedId, { token: mina });
T("주인이 막음", r.status === 200, r.data);
r = await call("GET", "/api/group-invites/" + doomed + "/preview");
T("막힌 링크는 안 열림", r.status === 400 || r.status === 404, r.data);
r = await call("DELETE", "/api/group-invites/" + onceId, { token: bada });
T("쓴 링크도 남의 것은 못 막음", r.status === 403, r.data);

r = await call("POST", `/api/groups/${groupId}/invites`, { token: mina, body: { days: 0 } });
T("기한 없이도 만들어짐", r.status === 200 && r.data.invite.expiresAt == null, r.data);

console.log("\n[12] 모임 고치기는 주인만");
r = await call("PATCH", "/api/groups/" + groupId, { token: nam, body: { name: "내 멋대로" } });
T("멤버는 못 고침", r.status === 403, r.data);
r = await call("PATCH", "/api/groups/" + groupId, { token: mina, body: { name: "일요일 등산", about: "" } });
T("주인이 고침", r.status === 200 && r.data.group.name === "일요일 등산", r.data);
T("빈 글이면 비움", r.data.group.about == null, r.data.group);

console.log("\n[13] 주인 넘기기");
r = await call("PATCH", `/api/groups/${groupId}/owner`, { token: nam, body: { userId: junId } });
T("주인 아니면 못 넘김", r.status === 403, r.data);
r = await call("PATCH", `/api/groups/${groupId}/owner`, { token: mina, body: { userId: junId } });
T("멤버 아닌 사람에게는 못 넘김", r.status === 404, r.data);
r = await call("PATCH", `/api/groups/${groupId}/owner`, { token: mina, body: { userId: namId } });
T("주인을 넘김", r.status === 200, r.data);
r = await call("GET", "/api/groups/" + groupId, { token: mina });
T("미나는 이제 멤버", r.data.members.find((m) => m.id === minaId)?.owner === false, r.data.members);
r = await call("DELETE", `/api/groups/${groupId}/members/me`, { token: mina });
T("넘긴 뒤에는 나갈 수 있음", r.status === 200, r.data);

console.log("\n[14] 모임을 지워도 여행은 남는다");
r = await call("GET", "/api/groups/" + groupId, { token: nam });
T("남이 주인이 되어 있음", r.data.group.ownerId === namId, r.data.group);
r = await call("DELETE", "/api/groups/" + groupId, { token: bada });
T("주인 아니면 못 지움", r.status === 403, r.data);
r = await call("DELETE", "/api/groups/" + groupId, { token: nam });
T("주인이 모임을 지움", r.status === 200, r.data);
r = await call("GET", "/api/groups/" + groupId, { token: nam });
T("모임이 사라짐", r.status === 404, r.data);

r = await call("GET", "/api/trip?trip=" + groupTrip, { token: mina });
T("만든 사람은 여전히 봄", r.status === 200, r.data);
T("혼자 여행이 됨", r.data.trip.groupId == null, r.data.trip);
r = await call("GET", "/api/trip?trip=" + groupTrip, { token: nam });
T("모임이던 사람은 못 봄", r.status === 404, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
