/* 캘린더 구독 — 열쇠로 로그인 없이 읽힘, 못 가요는 빠짐, 새로 만들면 옛 주소는 404 */
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

const A = await reg("cga", "가"), B = await reg("cna", "나");
const groupId = await makeGroup(A, "캘린더 시험", [B]);
let r = await call("POST", "/api/trips", { token: A, body: { title: "오사카, 먹방", startIso: "2027-02-10", nights: 1, groupId } });
const t1 = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + t1, { token: A });
await call("POST", "/api/places", { token: A, body: { dayId: r.data.days[0].id, name: "도톤보리", lat: 34.6687, lng: 135.5013, time: "18:00" } });
r = await call("POST", "/api/trips", { token: A, body: { title: "안 가는 여행", startIso: "2027-03-10", nights: 0, groupId } });
const t2 = r.data.trip.id;
await call("PUT", `/api/trips/${t2}/going`, { token: B, body: { answer: "NOT_GOING" } });
await call("POST", `/api/trips/${t1}/expenses`, { token: A, body: { name: "비밀 지출", amount: 777, currency: "JPY" } });

console.log("\n[1] 처음에는 꺼져 있음");
r = await call("GET", "/api/me/calendar", { token: B });
T("off", r.data.on === false, r.data);

console.log("\n[2] 켜고 읽기");
r = await call("POST", "/api/me/calendar", { token: B });
const path = r.data.path;
T("주소를 줌", /^\/api\/cal\/[A-Za-z0-9_-]+\.ics$/.test(path), r.data);
let res = await fetch(BASE + path);
let ics = await res.text();
T("로그인 없이 200", res.status === 200, res.status);
T("text/calendar", (res.headers.get("content-type") ?? "").startsWith("text/calendar"), res.headers.get("content-type"));
const flat = ics.replace(/\r\n /g, "");
T("여행이 들어감 · 쉼표는 막아 둠", flat.includes("SUMMARY:오사카\\, 먹방"), flat.split("\r\n").filter((l) => l.startsWith("SUMMARY")));
T("하루 종일 · 끝 다음 날", flat.includes("DTSTART;VALUE=DATE:20270210") && flat.includes("DTEND;VALUE=DATE:20270212"), flat);
T("장소와 시각", flat.includes("18:00 도톤보리"), flat);
T("못 간다고 한 여행은 빠짐", !flat.includes("안 가는 여행"), flat);
T("가계부는 안 담김", !flat.includes("비밀 지출"), flat);
T("줄은 CRLF 로 끝남", ics.includes("\r\nEND:VCALENDAR\r\n"), ics.slice(-40));
T("한 줄이 75바이트를 안 넘음", ics.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75), ics.split("\r\n").map((l) => Buffer.byteLength(l)).filter((n) => n > 75));
r = await call("GET", "/api/me/calendar", { token: B });
T("on", r.data.on === true, r.data);

console.log("\n[3] 새로 만들면 옛 주소는 죽음");
r = await call("POST", "/api/me/calendar", { token: B });
res = await fetch(BASE + path);
T("옛 주소 404", res.status === 404, res.status);
res = await fetch(BASE + r.data.path);
T("새 주소 200", res.status === 200, res.status);
res = await fetch(BASE + "/api/cal/모르는열쇠.ics");
T("모르는 열쇠 404", res.status === 404, res.status);

console.log("\n[4] 끄기");
await call("DELETE", "/api/me/calendar", { token: B });
res = await fetch(BASE + r.data.path);
T("끈 주소 404", res.status === 404, res.status);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
