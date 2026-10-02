/*
  피드 — 사진과 글.

  가장 조심할 자리는 댓글입니다. post_comments.post_id 가 두 표(여행기·피드)를
  가리키게 되어 외래키를 뗐습니다. 그래서 「글을 지우면 댓글도 간다」를 이제
  DB 가 아니라 코드가 합니다 — 빼먹으면 열어 볼 글이 없는 댓글이 운영 화면에
  영영 남습니다. 글을 지우는 자리가 셋이라(글 하나, 모임 통째로, 여행기) 셋 다
  봅니다.
*/
import { Buffer } from "node:buffer";

const BASE = process.env.BASE || "http://127.0.0.1:8080";
const SETUP_TOKEN = process.env.SETUP_TOKEN || "devtoken";
let pass = 0, fail = 0;
const T = (n, ok, x) => ok ? (pass++, console.log("  ok   " + n))
                           : (fail++, console.log("  FAIL " + n, x !== undefined ? JSON.stringify(x).slice(0, 220) : ""));

async function call(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

/* 가장 작은 JPEG 하나. 사진이 필요한 자리에만 씁니다. */
const TINY = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEB" +
  "AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh" +
  "ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ" +
  "WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG" +
  "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z",
  "base64",
);

async function photo(token) {
  const form = new FormData();
  form.append("file", new Blob([TINY], { type: "image/jpeg" }), "a.jpg");
  const r = await fetch(BASE + "/api/photos", {
    method: "POST", headers: { authorization: "Bearer " + token }, body: form,
  });
  const data = await r.json();
  return data.id;
}

const TAG = Date.now().toString(36);
const reg = (who, name) => call("POST", "/api/auth/register",
  { body: { email: `${who}-${TAG}@local.test`, name, password: "feed-test-1234" } });

async function makeGroup(ownerToken, name, mates = []) {
  const g = await call("POST", "/api/groups", { token: ownerToken, body: { name } });
  const gid = g.data.group.id;
  for (const who of mates) {
    const inv = await call("POST", `/api/groups/${gid}/invites`, { token: ownerToken, body: {} });
    await call("POST", `/api/group-invites/${inv.data.invite.token}/accept`, { token: who });
  }
  return gid;
}

let r;

console.log("\n[1] 셋이 가입하고 모임 하나");
/* 미나가 운영자입니다. 글을 지웠을 때 댓글이 고아로 남는지를 운영 화면으로
   봐야 하는데, 그 화면은 운영자만 엽니다. */
r = await call("POST", "/api/auth/setup",
  { body: { email: "admin@local.test", name: "미나", password: "feed-test-1234", token: SETUP_TOKEN } });
const mina = r.data.accessToken;
T("운영자 준비", r.status === 200, r.data);
r = await reg("jun", "준");
const jun = r.data.accessToken;
r = await reg("nam", "남");
const nam = r.data.accessToken;
T("셋 다", !!mina && !!jun && !!nam);

const groupId = await makeGroup(mina, "토요일 등산", [jun]);
T("모임 생김", !!groupId);

r = await call("POST", "/api/trips", { token: mina, body: { title: "관악산", startIso: "2027-03-06", nights: 0, groupId } });
const groupTrip = r.data.trip.id;
r = await call("POST", "/api/trips", { token: mina, body: { title: "혼자 걷기", startIso: "2027-04-01", nights: 0 } });
const soloTrip = r.data.trip.id;
T("여행 둘", !!groupTrip && !!soloTrip);

console.log("\n[2] 올리기 — 사진만, 글만, 둘 다");
r = await call("POST", "/api/feed", { token: mina, body: { groupId } });
T("둘 다 비면 거부", r.status === 400, r.data);

r = await call("POST", "/api/feed", { token: mina, body: { groupId, text: "오늘 날씨 좋았다" } });
T("글만 올려도 됨", r.status === 200, r.data);
const textOnly = r.data.post.id;
T("사진은 비어 있음", r.data.post.photoIds.length === 0, r.data.post);
T("내 것으로 옴", r.data.post.mine === true, r.data.post);

const pic1 = await photo(mina);
const pic2 = await photo(mina);
r = await call("POST", "/api/feed", { token: mina, body: { groupId, photoIds: [pic1, pic2] } });
T("사진만 올려도 됨", r.status === 200, r.data);
const picOnly = r.data.post.id;
T("고른 차례대로", r.data.post.photoIds[0] === pic1 && r.data.post.photoIds[1] === pic2, r.data.post);

r = await call("POST", "/api/feed", {
  token: mina,
  body: { groupId, tripId: groupTrip, text: "정상에서", tags: ["#등산", "등산", " 관악산 "], photoIds: [pic1] },
});
T("사진·글·태그·여행 다 함께", r.status === 200, r.data);
const full = r.data.post.id;
T("태그가 다듬어짐 — # 떼고 겹친 것 하나로",
  r.data.post.tags.length === 2 && r.data.post.tags.includes("등산") && r.data.post.tags.includes("관악산"),
  r.data.post.tags);
T("여행 이름이 함께 옴", r.data.post.tripTitle === "관악산", r.data.post);

console.log("\n[3] 남의 사진은 못 쓴다");
const hisPic = await photo(nam);
r = await call("POST", "/api/feed", { token: mina, body: { groupId, photoIds: [hisPic] } });
T("남의 사진 번호를 박으면 거부", r.status === 400, r.data);

console.log("\n[4] 모임 피드는 멤버만");
r = await call("GET", `/api/feed?group=${groupId}`, { token: jun });
T("모임 사람이 봄", r.status === 200 && r.data.posts.length === 3, r.data.posts?.length);
T("최근 것이 먼저", r.data.posts[0].id === full, r.data.posts.map((p) => p.id));
T("남이 쓴 것은 mine 이 아님", r.data.posts[0].mine === false, r.data.posts[0]);

r = await call("GET", `/api/feed?group=${groupId}`, { token: nam });
T("모임 사람이 아니면 404", r.status === 404, r.data);

console.log("\n[5] 태그로 거르기");
r = await call("GET", `/api/feed?group=${groupId}&tag=등산`, { token: jun });
T("그 태그가 달린 것만", r.data.posts.length === 1 && r.data.posts[0].id === full, r.data.posts);
r = await call("GET", `/api/feed?group=${groupId}&tag=%23등산`, { token: jun });
T("# 를 붙여 물어도 같음", r.data.posts.length === 1, r.data.posts);
r = await call("GET", `/api/feed?group=${groupId}&tag=없는태그`, { token: jun });
T("없는 태그면 빔", r.data.posts.length === 0, r.data.posts);

console.log("\n[6] 내 피드는 글쓴이만");
r = await call("POST", "/api/feed", { token: mina, body: { text: "혼자 적어 두는 말", tripId: soloTrip } });
T("모임 없이 올림", r.status === 200 && r.data.post.groupId == null, r.data.post);
const privatePost = r.data.post.id;

r = await call("GET", "/api/feed?mine=true", { token: mina });
T("내 것 전부 — 모임에 올린 것도 함께", r.data.posts.length === 4, r.data.posts?.length);
r = await call("GET", "/api/feed?mine=true", { token: jun });
T("준의 내 피드는 비었음", r.data.posts.length === 0, r.data.posts);
r = await call("GET", `/api/feed/${privatePost}`, { token: jun });
T("같은 모임 사람도 내 피드 글은 못 봄", r.status === 404, r.data);
r = await call("GET", `/api/feed/${privatePost}`, { token: mina });
T("글쓴이는 봄", r.status === 200, r.data);

console.log("\n[7] 어느 여행 이야기인지");
r = await call("POST", "/api/feed", { token: mina, body: { groupId, text: "엉뚱한 여행", tripId: soloTrip } });
T("모임 글에 그 모임 여행이 아닌 것은 거부", r.status === 400, r.data);
r = await call("POST", "/api/feed", { token: jun, body: { groupId, text: "남의 여행", tripId: "없는여행" } });
T("못 보는 여행이면 404", r.status === 404, r.data);

r = await call("GET", `/api/feed?trip=${groupTrip}`, { token: jun });
T("여행에 붙은 글", r.data.posts.length === 1 && r.data.posts[0].id === full, r.data.posts);
r = await call("GET", `/api/feed?trip=${soloTrip}`, { token: jun });
T("남의 여행은 404", r.status === 404, r.data);

console.log("\n[8] 고치기는 글쓴이만");
r = await call("PATCH", `/api/feed/${textOnly}`, { token: jun, body: { text: "내가 고침" } });
T("모임 사람이라도 남의 글은 못 고침", r.status === 403, r.data);
r = await call("PATCH", `/api/feed/${textOnly}`, { token: nam, body: { text: "남이 고침" } });
T("모임 밖은 404", r.status === 404, r.data);

r = await call("PATCH", `/api/feed/${textOnly}`, { token: mina, body: { text: "고쳤어요", tags: ["날씨"] } });
T("글쓴이가 고침", r.status === 200 && r.data.post.text === "고쳤어요", r.data.post);
T("태그도 바뀜", r.data.post.tags[0] === "날씨", r.data.post.tags);

r = await call("PATCH", `/api/feed/${picOnly}`, { token: mina, body: { photoIds: [] } });
T("사진만 있던 글에서 사진을 다 빼면 거부", r.status === 400, r.data);
r = await call("PATCH", `/api/feed/${picOnly}`, { token: mina, body: { photoIds: [pic2] } });
T("사진을 갈아 끼움", r.status === 200 && r.data.post.photoIds.length === 1, r.data.post);

console.log("\n[9] 댓글");
r = await call("POST", `/api/feed/${full}/comments`, { token: jun, body: { text: "나도 가고 싶다" } });
T("모임 사람이 한마디", r.status === 200, r.data);
const c1 = r.data.comment.id;
r = await call("POST", `/api/feed/${full}/comments`, { token: nam, body: { text: "끼어들기" } });
T("모임 밖은 404", r.status === 404, r.data);
r = await call("POST", `/api/feed/${full}/comments`, { token: jun, body: { text: "  " } });
T("빈 말은 거부", r.status === 400, r.data);

r = await call("GET", `/api/feed/${full}/comments`, { token: mina });
T("댓글 목록", r.data.comments.length === 1 && r.data.comments[0].text === "나도 가고 싶다", r.data.comments);

r = await call("GET", `/api/feed?group=${groupId}`, { token: mina });
T("목록에 댓글 수가 함께", r.data.posts.find((p) => p.id === full)?.commentCount === 1, r.data.posts);

r = await call("DELETE", `/api/comments/${c1}`, { token: nam });
T("남은 못 지움", r.status === 403, r.data);
r = await call("DELETE", `/api/comments/${c1}`, { token: mina });
T("글쓴이가 제 마당의 댓글을 지움", r.status === 200, r.data);
r = await call("GET", `/api/feed/${full}/comments`, { token: mina });
T("사라짐", r.data.comments.length === 0, r.data.comments);

console.log("\n[10] 여행기 댓글과 안 섞인다");
r = await call("GET", "/api/trip?trip=" + groupTrip, { token: mina });
const dayId = r.data.days[0].id;
await call("POST", "/api/places", { token: mina, body: { dayId, name: "정상", lat: 37.44, lng: 126.96, time: "09:00" } });
r = await call("POST", `/api/trips/${groupTrip}/publish`, { token: mina, body: { summary: "짧은 산행", feedback: true } });
T("여행기 올림", r.status === 200, r.data);
const journalId = r.data.postId;
r = await call("POST", `/api/posts/${journalId}/comments`, { token: jun, body: { text: "여행기 쪽 댓글" } });
T("여행기에 댓글", r.status === 200, r.data);
const jc = r.data.comment.id;

r = await call("GET", `/api/posts/${journalId}/comments`);
T("여행기 목록에는 하나", r.data.comments.length === 1, r.data.comments);
r = await call("GET", `/api/feed/${full}/comments`, { token: mina });
T("피드 목록에는 안 섞임", r.data.comments.length === 0, r.data.comments);

console.log("\n[11] 여행기를 내리면 그 댓글도 간다");
r = await call("DELETE", `/api/posts/${journalId}`, { token: mina });
T("여행기 내림", r.status === 200, r.data);
r = await call("GET", `/api/admin/comments`, { token: mina });
T("운영 목록에 지운 글의 댓글이 안 남음",
  !(r.data?.items ?? []).some((i) => i.id === jc), r.data?.items);

console.log("\n[12] 피드 글을 지우면 그 댓글도 간다");
r = await call("POST", `/api/feed/${full}/comments`, { token: jun, body: { text: "지워질 댓글" } });
const doomed = r.data.comment.id;
r = await call("POST", `/api/comments/${doomed}/report`, { token: mina, body: { reason: "확인용" } });
T("신고해서 운영 목록에 올림", r.status === 200, r.data);
r = await call("GET", "/api/admin/comments", { token: mina });
T("운영 목록에 보임", (r.data?.items ?? []).some((i) => i.id === doomed), r.data?.items);

r = await call("DELETE", `/api/feed/${full}`, { token: jun });
T("모임 사람이라도 남의 글은 못 지움", r.status === 403, r.data);
r = await call("DELETE", `/api/feed/${full}`, { token: mina });
T("글쓴이가 지움", r.status === 200, r.data);
r = await call("GET", `/api/feed/${full}`, { token: mina });
T("글이 사라짐", r.status === 404, r.data);
r = await call("GET", "/api/admin/comments", { token: mina });
T("댓글도 함께 사라짐 — DB 가 아니라 코드가 한 일",
  !(r.data?.items ?? []).some((i) => i.id === doomed), r.data?.items);

console.log("\n[13] 모임 주인은 남의 글을 치울 수 있다");
r = await call("POST", "/api/feed", { token: jun, body: { groupId, text: "준이 올린 글" } });
const hisPost = r.data.post.id;
r = await call("POST", `/api/feed/${hisPost}/comments`, { token: mina, body: { text: "여기 댓글" } });
const hisComment = r.data.comment.id;
await call("POST", `/api/comments/${hisComment}/report`, { token: jun, body: { reason: "확인용" } });

r = await call("DELETE", `/api/feed/${hisPost}`, { token: mina });
T("모임 주인이 치움", r.status === 200, r.data);
r = await call("GET", "/api/admin/comments", { token: mina });
T("그 댓글도 함께", !(r.data?.items ?? []).some((i) => i.id === hisComment), r.data?.items);

console.log("\n[14] 여행을 지워도 글은 남는다");
r = await call("DELETE", `/api/trips/${soloTrip}`, { token: mina });
T("여행 지움", r.status === 200, r.data);
r = await call("GET", `/api/feed/${privatePost}`, { token: mina });
T("글은 그대로", r.status === 200, r.data);
T("여행만 떨어짐", r.data.post.tripId == null && r.data.post.tripTitle == null, r.data.post);

console.log("\n[15] 모임을 지우면 그 글도 가고 댓글도 간다");
r = await call("POST", "/api/feed", { token: mina, body: { groupId, text: "모임과 함께 갈 글" } });
const withGroup = r.data.post.id;
r = await call("POST", `/api/feed/${withGroup}/comments`, { token: jun, body: { text: "함께 갈 댓글" } });
const withComment = r.data.comment.id;
await call("POST", `/api/comments/${withComment}/report`, { token: mina, body: { reason: "확인용" } });
r = await call("GET", "/api/admin/comments", { token: mina });
T("지우기 전에는 보임", (r.data?.items ?? []).some((i) => i.id === withComment), r.data?.items);

r = await call("DELETE", `/api/groups/${groupId}`, { token: mina });
T("모임 지움", r.status === 200, r.data);
r = await call("GET", `/api/feed/${withGroup}`, { token: mina });
T("그 모임의 글도 사라짐", r.status === 404, r.data);
r = await call("GET", "/api/admin/comments", { token: mina });
T("댓글도 함께 — 열어 볼 글이 없는 댓글을 안 남깁니다",
  !(r.data?.items ?? []).some((i) => i.id === withComment), r.data?.items);

r = await call("GET", "/api/feed?mine=true", { token: mina });
T("내 피드 글은 그대로", r.data.posts.some((p) => p.id === privatePost), r.data.posts);

console.log("\n[16] 한도");
const many = [];
for (let i = 0; i < 11; i++) {
  many.push(await photo(mina));
}
r = await call("POST", "/api/feed", { token: mina, body: { text: "너무 많이", photoIds: many } });
T("사진은 열 장까지", r.status === 400, r.data);
r = await call("POST", "/api/feed", { token: mina, body: { text: "ㄱ".repeat(2001) } });
T("글은 2000자까지", r.status === 400, r.data);
r = await call("POST", "/api/feed", {
  token: mina,
  body: { text: "태그 많이", tags: ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ"] },
});
T("태그는 다섯 개까지 — 넘으면 잘라서 받음", r.status === 200 && r.data.post.tags.length === 5, r.data.post?.tags);

r = await call("GET", "/api/feed", { token: mina });
T("어느 피드인지 안 말하면 거부", r.status === 400, r.data);

console.log("\n[17] 공개 범위 — 모두 · 내 모임 사람만 · 나만");
/*
  올린 자리가 곧 공개 범위였던 것을 글이 들고 있게 바꿨습니다(V52).

  가장 조심할 자리는 「나만」입니다. 못 보는 사람에게 403 으로 답하면 "있긴
  있는데 못 본다" 가 되어, 번호를 하나씩 넣어 보며 닫아 둔 글이 몇 편인지를
  가려낼 수 있습니다. 404 여야 하고, 그래서 여기서는 상태를 그대로 짚습니다.

  미나와 준은 새 모임을 함께 씁니다. 남은 어느 모임도 함께 쓰지 않습니다 —
  앞 토막에서 모임을 지웠으므로 셋의 사이가 여기서 다시 시작됩니다.
*/
const ourGroup = await makeGroup(mina, "금요일 저녁", [jun]);
T("새 모임", !!ourGroup);

r = await call("POST", "/api/feed", { token: mina, body: { groupId: ourGroup, text: "모임에만", audience: "MATES" } });
T("내 모임 사람만 — 모임 글", r.status === 200 && r.data.post.audience === "MATES", r.data.post);
const forMates = r.data.post.id;
r = await call("GET", `/api/feed/${forMates}`, { token: jun });
T("그 모임 사람이 봄", r.status === 200, r.data);
r = await call("GET", `/api/feed/${forMates}`, { token: nam });
T("모임 밖은 404", r.status === 404, r.data);

r = await call("POST", "/api/feed", { token: mina, body: { groupId: ourGroup, text: "올려 두고 나만", audience: "ONLY_ME" } });
T("나만 — 모임에 올려 두고 닫음", r.status === 200 && r.data.post.audience === "ONLY_ME", r.data.post);
const onlyMine = r.data.post.id;
r = await call("GET", `/api/feed/${onlyMine}`, { token: jun });
T("같은 모임 사람에게도 「볼 수 없다」가 아니라 「없다」", r.status === 404, r.data);
r = await call("GET", `/api/feed/${onlyMine}`, { token: mina });
T("글쓴이는 봄", r.status === 200, r.data);
r = await call("GET", `/api/feed?group=${ourGroup}`, { token: jun });
T("모임 피드에도 안 뜸", !r.data.posts.some((p) => p.id === onlyMine), r.data.posts.map((p) => p.id));
r = await call("GET", `/api/feed?group=${ourGroup}`, { token: mina });
T("글쓴이의 모임 피드에는 뜸", r.data.posts.some((p) => p.id === onlyMine), r.data.posts.map((p) => p.id));

r = await call("POST", "/api/feed", { token: mina, body: { text: "내 피드에 쓰고 모두", audience: "EVERYONE" } });
T("모두 — 내 피드 글", r.status === 200 && r.data.post.groupId == null, r.data.post);
const forAll = r.data.post.id;
r = await call("GET", `/api/feed/${forAll}`, { token: nam });
T("함께 든 모임이 없는 사람도 봄", r.status === 200, r.data);

r = await call("POST", "/api/feed", { token: mina, body: { text: "내 피드에 쓰고 모임 사람만", audience: "MATES" } });
const mateFeed = r.data.post.id;
r = await call("GET", `/api/feed/${mateFeed}`, { token: jun });
T("모임을 함께 쓰는 사람이 봄 — 모임 없이 올린 글이라도", r.status === 200, r.data);
r = await call("GET", `/api/feed/${mateFeed}`, { token: nam });
T("함께 든 모임이 없으면 404", r.status === 404, r.data);

console.log("\n[18] 안 보내면 올린 자리가 정한다");
/* 공개 범위가 없던 때의 동작입니다. 옛 화면이 보내던 몸체가 그대로 통해야
   하고, V52 의 되메움도 같은 규칙으로 옛 글을 채웁니다. */
r = await call("POST", "/api/feed", { token: mina, body: { groupId: ourGroup, text: "안 골랐음" } });
T("모임에 올리면 그 모임 사람", r.data.post.audience === "MATES", r.data.post);
r = await call("GET", `/api/feed/${r.data.post.id}`, { token: jun });
T("모임 사람이 그대로 봄", r.status === 200, r.data);
r = await call("POST", "/api/feed", { token: mina, body: { text: "내 피드에 안 골랐음" } });
T("내 피드에 쓰면 나만", r.data.post.audience === "ONLY_ME", r.data.post);
r = await call("GET", `/api/feed/${r.data.post.id}`, { token: jun });
T("모임 사람도 못 봄", r.status === 404, r.data);

console.log("\n[19] 남의 피드 목록");
const minaId = (await call("GET", "/api/auth/me", { token: mina })).data.user.id;
T("미나의 번호", !!minaId, minaId);

r = await call("GET", `/api/feed?author=${minaId}`, { token: jun });
T("모임 글은 뜸", r.data.posts.some((p) => p.id === forMates), r.data.posts.map((p) => p.id));
T("열어 둔 내 피드 글도 뜸 — 안 뜨면 고른 값이 아무 일도 안 한다",
  r.data.posts.some((p) => p.id === mateFeed) && r.data.posts.some((p) => p.id === forAll),
  r.data.posts.map((p) => p.id));
T("나만 보는 글은 안 뜸", !r.data.posts.some((p) => p.id === onlyMine), r.data.posts.map((p) => p.id));

r = await call("GET", `/api/feed?author=${minaId}`, { token: nam });
T("함께 든 모임이 없으면 「모두」로 열어 둔 글도 목록에는 안 뜸 — 번호를 받아야 열립니다",
  r.data.posts.length === 0, r.data.posts);

console.log("\n[20] 올린 뒤에 바꾼다");
r = await call("PATCH", `/api/feed/${forAll}`, { token: mina, body: { audience: "ONLY_ME" } });
T("좁힘", r.status === 200 && r.data.post.audience === "ONLY_ME", r.data.post);
r = await call("GET", `/api/feed/${forAll}`, { token: nam });
T("보던 사람이 더는 못 봄", r.status === 404, r.data);
r = await call("PATCH", `/api/feed/${forAll}`, { token: mina, body: { text: "말만 고침" } });
T("안 보낸 범위는 그대로", r.status === 200 && r.data.post.audience === "ONLY_ME", r.data.post);
r = await call("PATCH", `/api/feed/${forMates}`, { token: jun, body: { audience: "EVERYONE" } });
T("남의 글 범위는 못 바꿈", r.status === 403, r.data);
r = await call("POST", "/api/feed", { token: mina, body: { text: "없는 값", audience: "FRIENDS" } });
T("없는 값은 거부", r.status === 400, r.data);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
