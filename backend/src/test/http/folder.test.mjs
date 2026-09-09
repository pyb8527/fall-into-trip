/* 여행을 폴더로 묶는다. 폴더는 여행이 아니라 보는 사람의 것이다. */
const BASE = "http://127.0.0.1:8080";
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

console.log("\n[1] 두 사람");
let r = await reg("owner", "주인");
const owner = r.data.accessToken;
T("주인 가입", r.status === 200, r.data);
r = await reg("mate", "동행자");
const mate = r.data.accessToken;
T("동행자 가입", r.status === 200, r.data);

r = await call("POST", "/api/trips", { token: owner, body: { title: "제주 2박 3일", startIso: "2026-12-01", nights: 2 } });
const tripId = r.data.trip.id;
T("여행 생성", r.status === 200, r.data);

console.log("\n[2] 폴더 만들기");
r = await call("POST", "/api/folders", { token: owner, body: { name: "제주 갈 때마다" } });
T("만들어짐", r.status === 200 && !!r.data.folder.id, r.data);
const folderId = r.data.folder.id;
r = await call("POST", "/api/folders", { token: owner, body: { name: "제주 갈 때마다" } });
T("같은 이름은 두 번 못 만듦", r.status === 400, r.data);
r = await call("POST", "/api/folders", { token: owner, body: { name: "   " } });
T("빈 이름은 거절", r.status === 400, r.data);
r = await call("GET", "/api/folders", { token: owner });
T("목록에 하나", r.data.folders.length === 1 && r.data.folders[0].tripCount === 0, r.data.folders);

console.log("\n[3] 여행을 넣고 뺀다");
r = await call("PUT", `/api/trips/${tripId}/folder`, { token: owner, body: { folderId } });
T("넣기", r.status === 200, r.data);
r = await call("GET", "/api/trips", { token: owner });
T("목록에 폴더가 실림", r.data.trips.find(t => t.id === tripId)?.folderId === folderId, r.data.trips?.[0]);
r = await call("GET", "/api/folders", { token: owner });
T("폴더가 하나 들었다고 셈", r.data.folders[0].tripCount === 1, r.data.folders);

r = await call("PUT", `/api/trips/${tripId}/folder`, { token: owner, body: {} });
T("빼기", r.status === 200, r.data);
r = await call("GET", "/api/trips", { token: owner });
T("폴더가 비었음", r.data.trips.find(t => t.id === tripId)?.folderId == null, r.data.trips?.[0]);
r = await call("PUT", `/api/trips/${tripId}/folder`, { token: owner, body: { folderId } });

console.log("\n[4] 폴더는 보는 사람 것");
r = await call("POST", `/api/trips/${tripId}/invites`, { token: owner, body: { role: "EDITOR" } });
const invite = r.data.invite.token;
r = await call("POST", `/api/invites/${invite}/accept`, { token: mate });
T("동행자가 들어옴", r.status === 200, r.data);

r = await call("GET", "/api/folders", { token: mate });
T("남의 폴더는 안 보임", r.data.folders.length === 0, r.data.folders);
r = await call("GET", "/api/trips", { token: mate });
T("같은 여행이 보이되 폴더는 안 붙음",
  r.data.trips.find(t => t.id === tripId)?.folderId == null, r.data.trips?.[0]);

r = await call("POST", "/api/folders", { token: mate, body: { name: "친구랑" } });
const mateFolder = r.data.folder.id;
r = await call("PUT", `/api/trips/${tripId}/folder`, { token: mate, body: { folderId: mateFolder } });
T("동행자도 자기 폴더에 넣음", r.status === 200, r.data);
r = await call("GET", "/api/trips", { token: owner });
T("그래도 주인 폴더는 그대로",
  r.data.trips.find(t => t.id === tripId)?.folderId === folderId, r.data.trips?.[0]);

r = await call("PUT", `/api/trips/${tripId}/folder`, { token: mate, body: { folderId } });
T("남의 폴더에는 못 넣음", r.status === 404, r.data);

console.log("\n[5] 이름 바꾸기와 지우기");
r = await call("PATCH", `/api/folders/${folderId}`, { token: owner, body: { name: "제주" } });
T("이름 바꿈", r.status === 200 && r.data.folder.name === "제주", r.data);
r = await call("PATCH", `/api/folders/${mateFolder}`, { token: owner, body: { name: "가로채기" } });
T("남의 폴더는 못 고침", r.status === 404, r.data);

r = await call("DELETE", `/api/folders/${folderId}`, { token: owner });
T("폴더 지움", r.status === 200, r.data);
r = await call("GET", "/api/trips", { token: owner });
T("안에 든 여행은 남음", r.data.trips.some(t => t.id === tripId), r.data.trips);
T("폴더 표시만 풀림", r.data.trips.find(t => t.id === tripId)?.folderId == null, r.data.trips?.[0]);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
