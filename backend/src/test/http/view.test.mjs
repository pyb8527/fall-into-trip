/* 일정 링크 — 로그인 없이 일정만, 끊으면·새로 만들면·지나면 404 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0,240) : ""));
async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
async function makeGroup(ownerToken, name, mates = []) {
  const g = await call("POST", "/api/groups", { token: ownerToken, body: { name } });
  const gid = g.data.group.id;
  for (const who of mates) {
    const inv = await call("POST", `/api/groups/${gid}/invites`, { token: ownerToken, body: {} });
    await call("POST", `/api/group-invites/${inv.data.invite.token}/accept`, { token: who });
  }
  return gid;
}
const stamp = Date.now();
const reg = async (who, name) => {
  const r = await call("POST", "/api/auth/register",
    { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678", over14: true, terms: true, privacy: true } });
  return r.data.accessToken;
};

const A = await reg("vga", "가"), B = await reg("vna", "나"), X = await reg("vx", "남");
const groupId = await makeGroup(A, "링크 시험", [B]);
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
let r = await call("POST", "/api/trips", { token: A, body: { title: "속초", startIso: today, nights: 1, groupId } });
const tripId = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
await call("POST", "/api/places", { token: A, body: { dayId: r.data.days[0].id, name: "중앙시장", lat: 38.2, lng: 128.59, time: "12:00", note: "닭강정" } });
await call("PUT", `/api/trips/${tripId}/notice`, { token: A, body: { text: "도어락 4321" } });
await call("POST", `/api/trips/${tripId}/expenses`, { token: A, body: { name: "비밀 지출", amount: 9999 } });

console.log("\n[1] 만들기");
r = await call("POST", `/api/trips/${tripId}/view-link`, { token: X });
T("남은 못 만듦", r.status === 404, r.status);
r = await call("POST", `/api/trips/${tripId}/view-link`, { token: B });
const path = r.data.path;
T("모임 사람이 만듦", /^\/view\/[A-Za-z0-9_-]+$/.test(path), r.data);
const key = path.split("/").pop();
r = await call("GET", `/api/trips/${tripId}/view-link`, { token: A });
T("켜짐과 끝 날", r.data.on === true && !!r.data.until, r.data);

console.log("\n[2] 로그인 없이 보기");
r = await call("GET", "/api/view/" + key);
T("200", r.status === 200, r.data);
T("일정이 보임", r.data.title === "속초" && r.data.days[0].places[0].name === "중앙시장"
  && r.data.days[0].places[0].time === "12:00", r.data);
const raw = JSON.stringify(r.data);
T("안내판 안 나감", !raw.includes("4321"), raw.slice(0, 300));
T("가계부 안 나감", !raw.includes("9999") && !raw.includes("비밀"), raw.slice(0, 300));
T("사람 칸 안 나감", !/ownerId|updatedBy|groupId/.test(raw), raw.slice(0, 300));
r = await call("GET", "/api/trip?trip=" + tripId);
T("열쇠로는 다른 API 못 부름", r.status === 401, r.status);

console.log("\n[3] 새로 만들면 옛 링크는 죽음");
r = await call("POST", `/api/trips/${tripId}/view-link`, { token: A });
const key2 = r.data.path.split("/").pop();
r = await call("GET", "/api/view/" + key);
T("옛 링크 404", r.status === 404, r.status);
r = await call("GET", "/api/view/" + key2);
T("새 링크 200", r.status === 200, r.status);

console.log("\n[4] 끊기와 모르는 열쇠");
await call("DELETE", `/api/trips/${tripId}/view-link`, { token: A });
const cut = await call("GET", "/api/view/" + key2);
const unknown = await call("GET", "/api/view/nope");
T("끊은 것과 모르는 것이 똑같이 404",
  cut.status === 404 && unknown.status === 404 && JSON.stringify(cut.data) === JSON.stringify(unknown.data), [cut, unknown]);

console.log("\n[5] 지난 여행은 저절로 죽음");
r = await call("POST", "/api/trips", { token: A, body: { title: "지난 여행", startIso: "2020-01-01", nights: 1, groupId } });
const old = r.data.trip.id;
r = await call("POST", `/api/trips/${old}/view-link`, { token: A });
r = await call("GET", "/api/view/" + r.data.path.split("/").pop());
T("마지막 날 다음 날부터 404", r.status === 404, r.status);

console.log("\n[6] 장소 메모 가리기");
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
const dayId6 = r.data.days[0].id;
/* 원래부터 메모가 없는 장소 — §8 에서 "가려진 메모"와 응답 모양을 견줄 짝. */
await call("POST", "/api/places", { token: A, body: { dayId: dayId6, name: "스타벅스", lat: 38.21, lng: 128.6, time: "13:00" } });

r = await call("POST", `/api/trips/${tripId}/view-link`, { token: A });
const key3 = r.data.path.split("/").pop();
r = await call("GET", `/api/trips/${tripId}/view-link`, { token: A });
T("새 링크는 notes:true", r.data.notes === true, r.data);

r = await call("GET", "/api/view/" + key3);
T("켜진 채로 보면 메모가 보임", r.data.days[0].places[0].note === "닭강정", r.data);
const placeOn = r.data.days[0].places[0];

r = await call("PATCH", `/api/trips/${tripId}/view-link`, { token: X, body: { notes: false } });
T("남(X)이 PATCH 하면 404", r.status === 404, r.status);
const forbidden404 = r.data;

r = await call("PATCH", `/api/trips/nope-trip-id/view-link`, { token: A, body: { notes: false } });
T("없는 여행 번호로 PATCH 하면 404 — 3 과 같은 응답",
  r.status === 404 && JSON.stringify(r.data) === JSON.stringify(forbidden404), r.data);

r = await call("PATCH", `/api/trips/${tripId}/view-link`, { token: B, body: { notes: false } });
T("모임 사람(B)이 꺼도 됨 — notes:false", r.status === 200 && r.data.notes === false, r.data);

r = await call("GET", "/api/view/" + key3);
T("같은 열쇠로 보임 — 링크가 안 죽음", r.status === 200, r.status);
const placeOff = r.data.days[0].places[0];
const neverNoted = r.data.days[0].places[1];
T("메모가 가려짐, 이름·시각은 그대로",
  placeOff.note == null && placeOff.name === placeOn.name && placeOff.time === placeOn.time, placeOff);
T("가려진 장소의 키 모음이 원래 메모 없던 장소와 같음 — 응답 모양으로 안 드러남",
  JSON.stringify(Object.keys(placeOff).sort()) === JSON.stringify(Object.keys(neverNoted).sort()),
  { placeOff, neverNoted });

r = await call("PATCH", `/api/trips/${tripId}/view-link`, { token: A, body: {} });
T("notes 없이 PATCH 하면 400", r.status === 400, r.status);

/* 다시 켜 둡니다 — 2 와 같은 확인이라 세지 않습니다. 뒤에 메모를 기대하는
   테스트가 더 생겨도 이 파일을 다시 켜진 상태로 남겨 둡니다. */
await call("PATCH", `/api/trips/${tripId}/view-link`, { token: A, body: { notes: true } });

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
