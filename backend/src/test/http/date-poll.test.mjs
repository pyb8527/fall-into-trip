/* 날짜 정하기 — 모두 되는 날이 위로, 확정은 만든 사람이, 장소는 그대로 */
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
    { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678" } });
  return r.data.accessToken;
};

console.log("\n[1] 셋이 든 모임");
const A = await reg("dga", "가"), B = await reg("dna", "나"), C = await reg("dda", "다"), X = await reg("dx", "남");
const groupId = await makeGroup(A, "날짜 시험", [B, C]);
let r = await call("POST", "/api/trips", { token: A, body: { title: "제주", startIso: "2027-05-01", nights: 2, groupId } });
const tripId = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
const [d1, d2, d3] = r.data.days.map((d) => d.id);
await call("POST", "/api/places", { token: A, body: { dayId: d1, name: "성산", lat: 33.4588, lng: 126.9425 } });

console.log("\n[2] 후보 올리기");
r = await call("POST", `/api/trips/${tripId}/dates`, { token: B, body: { startIso: "2027-06-05", nights: 2 } });
T("모임 사람이 올림", r.status === 200, r.data);
r = await call("POST", `/api/trips/${tripId}/dates`, { token: A, body: { startIso: "2027-06-12", nights: 1 } });
r = await call("POST", `/api/trips/${tripId}/dates`, { token: A, body: { startIso: "2027-06-12", nights: 1 } });
T("같은 날은 또 못 올림", r.status === 409, r.data);
r = await call("POST", `/api/trips/${tripId}/dates`, { token: X, body: { startIso: "2027-06-19", nights: 1 } });
T("남은 못 올림", r.status === 404, r.data);
r = await call("POST", `/api/trips/${tripId}/dates`, { token: A, body: { startIso: "2027-06-19", nights: 40 } });
T("30박 넘으면 거절", r.status === 400, r.data);

r = await call("GET", `/api/trips/${tripId}/dates`, { token: A });
T("둘 올라옴", r.data.options.length === 2 && r.data.people === 3, r.data);
const o5 = r.data.options.find((o) => o.startIso === "2027-06-05");
const o12 = r.data.options.find((o) => o.startIso === "2027-06-12");
T("올린 사람은 돼요로 깔림", o5.answers.length === 1 && o5.answers[0].answer === "YES", o5);
T("끝 날도 셈", o5.endIso === "2027-06-07", o5);

console.log("\n[3] 답하고 줄 세우기");
await call("PUT", `/api/trips/${tripId}/dates/${o12.id}/answer`, { token: B, body: { answer: "IF_NEED" } });
await call("PUT", `/api/trips/${tripId}/dates/${o12.id}/answer`, { token: C, body: { answer: "YES" } });
await call("PUT", `/api/trips/${tripId}/dates/${o5.id}/answer`, { token: A, body: { answer: "YES" } });
await call("PUT", `/api/trips/${tripId}/dates/${o5.id}/answer`, { token: C, body: { answer: "NO" } });
r = await call("GET", `/api/trips/${tripId}/dates`, { token: A });
T("안 돼요 없는 날이 위", r.data.options[0].id === o12.id && r.data.options[0].tier === 2, r.data.options.map((o) => [o.startIso, o.tier]));
T("안 돼요 있는 날은 셋째", r.data.options[1].tier === 3, r.data.options[1]);

await call("PUT", `/api/trips/${tripId}/dates/${o12.id}/answer`, { token: B, body: { answer: "YES" } });
r = await call("GET", `/api/trips/${tripId}/dates`, { token: B });
T("모두 돼요면 1순위", r.data.options[0].tier === 1, r.data.options[0]);
T("내 답이 보임", r.data.options[0].mine === "YES", r.data.options[0]);

await call("PUT", `/api/trips/${tripId}/dates/${o12.id}/answer`, { token: B, body: {} });
r = await call("GET", `/api/trips/${tripId}/dates`, { token: B });
T("답을 거두면 다시 2순위", r.data.options[0].tier === 2 && r.data.options[0].mine == null, r.data.options[0]);
await call("PUT", `/api/trips/${tripId}/dates/${o12.id}/answer`, { token: B, body: { answer: "YES" } });

console.log("\n[4] 못 가는 사람의 안 돼요는 막지 않음");
await call("PUT", `/api/trips/${tripId}/going`, { token: C, body: { answer: "NOT_GOING" } });
r = await call("GET", `/api/trips/${tripId}/dates`, { token: A });
const again5 = r.data.options.find((o) => o.id === o5.id);
T("가는 사람 둘", r.data.people === 2, r.data.people);
T("6/5 가 둘 다 돼요로 1순위", again5.tier === 1, again5);
await call("PUT", `/api/trips/${tripId}/going`, { token: C, body: { answer: "MAYBE" } });

console.log("\n[5] 모임 달력");
r = await call("GET", `/api/groups/${groupId}/dates`, { token: C });
T("열린 후보 둘", r.data.options.length === 2 && r.data.options[0].tripTitle === "제주", r.data);
r = await call("GET", `/api/groups/${groupId}/dates`, { token: X });
T("남은 못 봄", r.status === 404 || r.status === 403, r.status);

console.log("\n[6] 확정");
r = await call("POST", `/api/trips/${tripId}/dates/${o12.id}/confirm`, { token: B });
T("만든 사람만 확정", r.status === 403, r.data);

await call("POST", "/api/places", { token: A, body: { dayId: d3, name: "협재", lat: 33.394, lng: 126.2397 } });
r = await call("POST", `/api/trips/${tripId}/dates/${o12.id}/confirm`, { token: A });
T("넘치는 날에 장소가 있으면 막음", r.status === 409, r.data);

r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
const third = r.data.days[2].places[0];
await call("DELETE", `/api/places/${third.id}`, { token: A });
r = await call("POST", `/api/trips/${tripId}/dates/${o12.id}/confirm`, { token: A });
T("비우고 나면 확정", r.status === 200, r.data);

r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
T("이틀로 줄어듦", r.data.days.length === 2, r.data.days.map((d) => d.iso));
T("날짜가 옮겨짐", r.data.days[0].iso === "2027-06-12" && r.data.days[1].iso === "2027-06-13", r.data.days.map((d) => d.iso));
T("첫날 장소는 그대로", r.data.days[0].places[0]?.name === "성산", r.data.days[0].places);

r = await call("GET", `/api/trips/${tripId}/dates`, { token: C });
const done = r.data.options.find((o) => o.id === o12.id);
T("확정 표시", done.confirmed === true, done);
r = await call("GET", `/api/groups/${groupId}/dates`, { token: C });
T("정해진 여행은 모임 달력에서 빠짐", r.data.options.length === 0, r.data);

console.log("\n[7] 늘리기");
r = await call("POST", `/api/trips/${tripId}/dates`, { token: A, body: { startIso: "2027-07-01", nights: 3 } });
r = await call("GET", `/api/trips/${tripId}/dates`, { token: A });
const o7 = r.data.options.find((o) => o.startIso === "2027-07-01");
T("새 후보가 오르면 확정이 풀림", r.data.options.every((o) => !o.confirmed), r.data.options);
r = await call("POST", `/api/trips/${tripId}/dates/${o7.id}/confirm`, { token: A });
r = await call("GET", "/api/trip?trip=" + tripId, { token: A });
T("나흘로 늘어남", r.data.days.length === 4 && r.data.days[3].iso === "2027-07-04", r.data.days.map((d) => d.iso));

console.log("\n[8] 내리기");
r = await call("DELETE", `/api/trips/${tripId}/dates/${o12.id}`, { token: C });
T("올리지 않은 사람은 못 내림", r.status === 403, r.data);
r = await call("DELETE", `/api/trips/${tripId}/dates/${o5.id}`, { token: B });
T("올린 사람은 내림", r.status === 200, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
