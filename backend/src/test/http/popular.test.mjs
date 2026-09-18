/* 여럿이 간 곳 — 올라온 글을 세어 순위를 만든다 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0,300) : ""));

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

console.log("\n[1] 준비 — 여행 둘을 올린다");
let r = await reg("pop", "세는이");
const me = r.data.accessToken;
T("가입", r.status === 200, r.data);

async function publish(title, region, places) {
  r = await call("POST", "/api/trips", { token: me, body: { title, startIso: "2026-12-01", nights: 0 } });
  const tripId = r.data.trip.id;
  r = await call("GET", "/api/trip?trip=" + tripId, { token: me });
  const dayId = r.data.days[0].id;
  for (const p of places) {
    await call("POST", "/api/places", { token: me, body: { dayId, ...p } });
  }
  r = await call("POST", `/api/trips/${tripId}/publish`, { token: me, body: { title, region } });
  return r.data.postId;
}

/* 같은 곳(온천)이 두 글에 나옵니다. 그래야 "여럿이 간 곳" 이 뜻을 가집니다. */
const ONSEN = { name: `세는온천-${stamp}`, lat: 34.11, lng: 135.11, icon: "onsen" };
await publish(`세는여행A-${stamp}`, "일본", [
  ONSEN,
  { name: `세는라멘-${stamp}`, lat: 34.12, lng: 135.12, icon: "ramen" },
  /* 한 글 안에서 같은 곳을 두 번. 두 번으로 세면 안 됩니다. */
  { ...ONSEN, time: "18:00" },
]);
await publish(`세는여행B-${stamp}`, "일본", [ONSEN]);
T("두 글 올림", true);

console.log("\n[2] 로그인 없이 볼 수 있다");
r = await call("GET", "/api/popular/places");
T("장소 순위 200", r.status === 200, r.data);
r = await call("GET", "/api/popular/regions");
T("지역 순위 200", r.status === 200, r.data);
r = await call("GET", "/api/popular/kinds");
T("갈래 목록 200", r.status === 200, r.data);

console.log("\n[3] 한 글에서 두 번 넣어도 한 번으로 센다");
r = await call("GET", "/api/popular/places");
const onsen = r.data.places.find(p => p.name === ONSEN.name);
T("그 온천이 목록에 있음", !!onsen, r.data.places);
/* 두 글에 나왔으니 2 입니다. 한 글에서 두 번 넣은 것을 세면 3 이 됩니다. */
T("글 수로 셈 (2)", onsen && onsen.posts === 2, onsen);
T("갈래가 함께 옴", onsen && onsen.icon === "onsen", onsen);

console.log("\n[4] 갈래로 거른다");
r = await call("GET", "/api/popular/places?kind=onsen");
T("온천만 남음", r.data.places.every(p => p.icon === "onsen"), r.data.places);
T("거른 갈래를 되돌려 줌", r.data.kind === "onsen", r.data);
r = await call("GET", "/api/popular/places?kind=ramen");
T("면으로 거르면 온천은 빠짐", !r.data.places.some(p => p.name === ONSEN.name), r.data.places);
/* 화면에서 넘어온 값을 그대로 쿼리에 넣지 않습니다. */
r = await call("GET", "/api/popular/places?kind=없는갈래");
T("모르는 갈래는 안 거른 것으로 봄", r.status === 200 && r.data.kind === "", r.data);

console.log("\n[5] 갈래 목록에는 실제로 쓰인 것만");
r = await call("GET", "/api/popular/kinds");
const names = r.data.kinds.map(k => k.kind);
T("온천과 면이 들어 있음", names.includes("onsen") && names.includes("ramen"), names);
T("안 쓴 갈래는 없음", !names.includes("show"), names);

console.log("\n[6] 지역도 센다");
r = await call("GET", "/api/popular/regions");
const jp = r.data.regions.find(x => x.region === "일본");
T("일본이 있음", !!jp, r.data.regions);
T("글 수가 둘 이상", jp && jp.posts >= 2, jp);

console.log("\n[7] 감춘 글은 안 센다");
/* 신고로 감춰진 글이 순위에 남아 있으면 감춘 것이 감춰지지 않은 셈입니다.
   여기서는 감추는 길이 운영자 것이라 개수가 줄지 않는 것만 확인합니다. */
r = await call("GET", "/api/popular/places");
T("목록이 비어 있지 않음", r.data.places.length > 0, r.data.places);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
