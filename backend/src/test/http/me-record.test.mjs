/* 마이페이지 기록 — 소개 · 함께한 사람 · 리뷰 장소 이름 · 다녀온 곳 */
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

const A = await reg("mra", "가"), B = await reg("mrb", "나");
const groupId = await makeGroup(A, "기록 시험", [B]);
const S = Date.now().toString(36);
const P1 = `gp-sushi-${S}`, P2 = `gp-tower-${S}`;

console.log("\n[1] 프로필 — 한 줄 소개 · 함께한 사람");
let r = await call("PATCH", "/api/me/profile", { token: A, body: { bio: "  먹으러 다니는 여행러  " } });
T("소개 저장(앞뒤 공백 걷음)", r.status === 200 && r.data.bio === "먹으러 다니는 여행러", r.data);
T("함께한 사람 1명", r.data.companions === 1, r.data);
r = await call("PATCH", "/api/me/profile", { token: A, body: { bio: "가".repeat(81) } });
T("81자는 거절", r.status === 400, r.status);
r = await call("PATCH", "/api/me/profile", { token: A, body: { name: "가나", bio: "" } });
T("이름 바꾸고 소개 비움", r.data.name === "가나" && !r.data.bio, r.data);

console.log("\n[2] 끝난 여행의 곳");
r = await call("POST", "/api/trips", { token: A, body: { title: "지난 도쿄", startIso: "2025-03-01", nights: 1, groupId } });
const past = r.data.trip.id;
r = await call("GET", "/api/trip?trip=" + past, { token: A });
await call("POST", "/api/places", { token: A, body: { dayId: r.data.days[0].id, name: "스시 잔마이", lat: 35.66, lng: 139.77, placeId: P1 } });
await call("POST", "/api/places", { token: A, body: { dayId: r.data.days[1].id, name: "도쿄 타워", lat: 35.6586, lng: 139.7454, placeId: P2 } });
r = await call("POST", "/api/trips", { token: A, body: { title: "다가올 여행", startIso: "2099-01-01", nights: 0, groupId } });
r = await call("GET", "/api/trip?trip=" + r.data.trip.id, { token: A });
await call("POST", "/api/places", { token: A, body: { dayId: r.data.days[0].id, name: "아직 안 간 곳", lat: 1, lng: 1, placeId: `gp-future-${S}` } });

r = await call("GET", "/api/me/visited", { token: B });
T("모임 여행도 같이 다녀온 곳", r.data.places === 2 && r.data.trips === 1, r.data);
T("다가올 여행 곳은 안 셈", !r.data.pins.some((p) => p.name === "아직 안 간 곳"), r.data.pins);

console.log("\n[3] 리뷰에 장소 이름");
await call("POST", `/api/places/${P1}/tips`, { token: B, body: { text: "참치가 좋았다", stars: 5 } });
r = await call("GET", "/api/me/reviews", { token: B });
const mine = r.data.reviews.find((x) => x.placeId === P1);
T("이름이 붙음(일정의 장소에서)", mine?.name === "스시 잔마이" && mine?.stars === 5, r.data.reviews);
T("안 남긴 곳에 도쿄 타워", r.data.unreviewed.some((x) => x.placeId === P2 && x.name === "도쿄 타워"), r.data.unreviewed);
T("남긴 곳은 안 남긴 곳에 없음", !r.data.unreviewed.some((x) => x.placeId === P1), r.data.unreviewed);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
