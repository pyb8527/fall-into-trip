/* 장소에 한 줄 팁을 남기고, 신고가 쌓이면 감춰지고, 운영자가 되돌린다 */
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
const stamp = Date.now();
const reg = (who, name) => call("POST", "/api/auth/register",
  { body: { email: `${who}-${stamp}@test.com`, name, password: "pw-12345678" } });

const PLACE = "gplace-ichiran-" + stamp;

console.log("\n[1] 운영자와 사람들");
let r = await call("POST", "/api/auth/setup",
  { body: { email: `admin-${stamp}@test.com`, name: "운영자", password: "pw-12345678", token: "devtoken" } });
const admin = r.data.accessToken;
T("운영자 생성", r.status === 200, r.data);
r = await reg("a", "가");
const a = r.data.accessToken;
r = await reg("b", "나");
const b = r.data.accessToken;
r = await reg("c", "다");
const c = r.data.accessToken;
T("셋 가입", !!a && !!b && !!c);

console.log("\n[2] 남기기");
r = await call("POST", `/api/places/${PLACE}/tips`, { token: a, body: { text: "지금 대기 40분" } });
T("남김", r.status === 200 && !!r.data.tip.id, r.data);
const tipId = r.data.tip.id;
T("내 것이라고 표시", r.data.tip.mine === true, r.data.tip);

r = await call("POST", `/api/places/${PLACE}/tips`, { token: a, body: { text: "  " } });
T("빈 글은 거절", r.status === 400, r.data);
r = await call("POST", `/api/places/${PLACE}/tips`, { token: a, body: { text: "x".repeat(201) } });
T("너무 길면 거절", r.status === 400, r.data);
r = await call("POST", `/api/places/${PLACE}/tips`, { body: { text: "로그인 없이" } });
T("로그인 없이는 못 남김", r.status === 401 || r.status === 403, r.data);

console.log("\n[3] 도배 막기");
await call("POST", `/api/places/${PLACE}/tips`, { token: a, body: { text: "둘" } });
await call("POST", `/api/places/${PLACE}/tips`, { token: a, body: { text: "셋" } });
r = await call("POST", `/api/places/${PLACE}/tips`, { token: a, body: { text: "넷" } });
T("하루 세 번까지", r.status === 400, r.data);

console.log("\n[4] 읽기는 로그인 없이도");
r = await call("GET", `/api/places/${PLACE}/tips`);
T("목록이 열림", r.status === 200 && r.data.tips.length === 3, r.data.tips?.length);
T("최근 것이 먼저", r.data.tips[0].text === "셋", r.data.tips?.[0]);
T("남긴 사람 이름이 보임", r.data.tips[0].authorName === "가", r.data.tips?.[0]);
T("로그인 안 했으면 내 것 아님", r.data.tips[0].mine === false, r.data.tips?.[0]);

r = await call("POST", "/api/tips/counts", { token: b, body: { placeIds: [PLACE, "없는곳"] } });
T("장소별 개수", r.data.counts[PLACE] === 3 && r.data.counts["없는곳"] === undefined, r.data.counts);

console.log("\n[5] 지우기");
r = await call("DELETE", `/api/tips/${tipId}`, { token: b });
T("남의 것은 못 지움", r.status === 403, r.data);
r = await call("DELETE", `/api/tips/${tipId}`, { token: a });
T("내 것은 지움", r.status === 200, r.data);
r = await call("GET", `/api/places/${PLACE}/tips`);
T("둘 남음", r.data.tips.length === 2, r.data.tips?.length);

console.log("\n[6] 신고와 되돌리기");
const target = r.data.tips[0].id;
r = await call("POST", `/api/tips/${target}/report`, { token: a, body: { reason: "내 것" } });
T("내가 남긴 것은 신고 못 함", r.status === 400, r.data);
r = await call("POST", `/api/tips/${target}/report`, { token: b, body: {} });
T("신고", r.status === 200, r.data);
r = await call("POST", `/api/tips/${target}/report`, { token: b, body: {} });
T("두 번은 못 함", r.status === 400, r.data);

r = await call("GET", `/api/places/${PLACE}/tips`);
T("한 건으로는 안 감춰짐", r.data.tips.some(t => t.id === target), r.data.tips);

await call("POST", `/api/tips/${target}/report`, { token: c, body: {} });
await call("POST", `/api/tips/${target}/report`, { token: admin, body: {} });
r = await call("GET", `/api/places/${PLACE}/tips`);
T("셋 쌓이면 감춰짐", !r.data.tips.some(t => t.id === target), r.data.tips);

r = await call("GET", "/api/admin/tips", { token: admin });
T("운영자 목록에 보임", r.status === 200 && r.data.items.some(i => i.id === target), r.data.items);
T("신고 수가 보임", r.data.items.find(i => i.id === target)?.reportCount === 3, r.data.items?.[0]);
r = await call("GET", "/api/admin/tips", { token: a });
T("운영자만 볼 수 있음", r.status === 403, r.data);

r = await call("PATCH", `/api/admin/tips/${target}/hidden`, { token: admin, body: { hidden: false } });
T("다시 올림", r.status === 200, r.data);
r = await call("GET", `/api/places/${PLACE}/tips`);
T("되살아남", r.data.tips.some(t => t.id === target), r.data.tips);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
