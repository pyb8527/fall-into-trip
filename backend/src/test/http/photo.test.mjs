/* 사진 올리기. 위치 딱지가 지워지는지, 아무거나 안 받는지. */
import { Buffer } from "node:buffer";

const BASE = process.env.BASE || "http://127.0.0.1:8080";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : ""));

async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

async function upload(bytes, { token, name = "a.jpg", type = "image/jpeg" } = {}) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  const headers = {};
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + "/api/photos", { method: "POST", headers, body: form });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

/*
  위치 딱지가 붙은 JPEG 한 장을 손으로 만듭니다.

  <p>진짜 폰 사진을 넣어 둘 수는 없으니(저장소에 남기면 그것대로 짐입니다),
  JPEG 의 뼈대에 EXIF 조각을 끼워 넣습니다. 우리가 보는 것은 "올린 뒤에 그
  조각이 남아 있는가" 하나입니다.
*/
function jpegWithExif() {
  /* 가장 작은 JPEG 하나(1x1, 흰 점). */
  const tiny = Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEB" +
    "AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh" +
    "ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ" +
    "WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG" +
    "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z",
    "base64",
  );
  /* APP1 조각. 안에 알아볼 수 있는 표시를 심어 두고 그것이 남는지 봅니다. */
  const mark = Buffer.from("Exif\0\0FITTESTGPS35.6812,139.7671PADDING");
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1]),
    Buffer.from([((mark.length + 2) >> 8) & 0xff, (mark.length + 2) & 0xff]),
    mark,
  ]);
  /* SOI(2바이트) 바로 뒤에 끼웁니다. */
  return Buffer.concat([tiny.subarray(0, 2), app1, tiny.subarray(2)]);
}

const stamp = Date.now();

console.log("\n[1] 사람 하나");
let r = await call("POST", "/api/auth/register", {
  body: { email: `photo-${stamp}@test.com`, name: "찍는 사람", password: "pw-12345678" },
});
const me = r.data.accessToken;
T("가입", r.status === 200, r.data);

console.log("\n[2] 로그인 없이는 못 올린다");
r = await upload(jpegWithExif());
T("거절", r.status === 401 || r.status === 403, r.status);

console.log("\n[3] 그림이 아닌 것은 안 받는다");
for (const [what, bytes] of [
  ["빈 것", Buffer.alloc(0)],
  ["글자", Buffer.from("이건 사진이 아닙니다")],
  ["확장자만 jpg 인 zip", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0])],
]) {
  r = await upload(bytes, { token: me });
  T(`막힘: ${what}`, r.status === 400, r.data);
}

console.log("\n[4] 위치 딱지가 지워진다");
const withGps = jpegWithExif();
T("올리기 전에는 딱지가 있다", withGps.includes("FITTESTGPS"), false);
r = await upload(withGps, { token: me });
T("올라감", r.status === 200 && !!r.data.id, r.data);
const id = r.data.id;

const got = await fetch(`${BASE}/api/photos/${id}`);
T("로그인 없이도 보인다", got.status === 200, got.status);
T("JPEG 으로 나온다", (got.headers.get("content-type") || "").includes("image/jpeg"),
  got.headers.get("content-type"));
const body = Buffer.from(await got.arrayBuffer());
/* 핵심입니다. 폰 사진에는 어디서 찍었는지가 들어 있고, 여행기에 올린 사진
   한 장으로 집 주소가 드러나는 일이 실제로 있습니다. */
T("받아 보면 딱지가 없다", !body.includes("FITTESTGPS"), body.subarray(0, 64).toString("latin1"));
T("그림은 살아 있다", body.length > 100 && body[0] === 0xff && body[1] === 0xd8, body.length);

console.log("\n[5] 내 것만 지운다");
r = await call("POST", "/api/auth/register", {
  body: { email: `other-${stamp}@test.com`, name: "남", password: "pw-12345678" },
});
const other = r.data.accessToken;
r = await call("DELETE", `/api/photos/${id}`, { token: other });
T("남의 사진은 못 지움", r.status === 403, r.data);

r = await call("DELETE", `/api/photos/${id}`, { token: me });
T("내 사진은 지워짐", r.status === 200, r.data);

const gone = await fetch(`${BASE}/api/photos/${id}`);
T("지운 뒤에는 없다", gone.status === 404, gone.status);

console.log("\n[6] 없는 것과 이상한 이름");
for (const bad of ["없는번호", "../../etc/passwd", "a"]) {
  const res = await fetch(`${BASE}/api/photos/${encodeURIComponent(bad)}`);
  T(`막힘: ${bad}`, res.status === 404 || res.status === 400, res.status);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail > 0 ? 1 : 0);
