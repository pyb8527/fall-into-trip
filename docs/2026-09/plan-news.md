# 소식함 — 내가 없는 동안 무엇이 바뀌었나

> `verdict-ideas.md` 2 번의 실행 계획입니다. 조건은 하나 —
> **시각이 있는 재료만 담습니다**.
>
> **먼저 볼 것:** `verdict.md` §11.1 이 이보다 한 단계 앞입니다. 새
> 엔드포인트 없이 일정 화면에서 `updatedBy`·`updatedAt` 을 바로 쓰는
> 쪽이고 서버를 안 건드립니다. 그것을 먼저 하고, 소식이 여러 여행에
> 걸쳐 모여야 할 때 이 문서로 넘어옵니다.
> 아직 코드는 한 줄도 바뀌지 않았습니다.

## 1. 하려는 것

협업 기능이 셋 있습니다 — 투표장(`CandidateService`), 챙길 것
(`TripItem`), 함께 고치기. 그런데 **누가 뭘 했는지 보이지 않습니다.**
동행자가 둘째 날에 가게를 하나 넣어도, 들어가서 일정 전체를 다시 훑어야
압니다.

그래서 지금은 카톡으로 "야 투표해" 를 따로 보냅니다. 앱 밖에서 앱을
쓰라고 알리고 있는 셈입니다.

재료는 이미 저장되고 있습니다. `Place.updatedBy`·`updatedAt` 이
`api/types.ts:80-81` 로 프런트까지 내려오는데, **어느 화면도 읽지
않습니다.**

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 | 쓸 수 있나 |
|---|---|---|
| 누가·언제 장소를 고쳤나 | `Place.updatedBy`·`updatedAt` | 그대로 |
| 후보가 올라왔나 | `TripCandidate.createdAt`·`addedBy` | 그대로 |
| 표가 모였나 | `CandidateVote.createdAt`·`userId`·`yes` | 그대로 |
| 전원 찬성인지 판단 | `trip/application/CandidateService.java` | 그대로 |
| 내 글에 추천이 붙었나 | `PostLike.createdAt`·`userId` | 그대로 |
| 내 글에 댓글이 달렸나 | `PostComment.createdAt`·`userId` | 그대로 |
| 내가 속한 여행 목록 | `TripMemberRepository.findAllByIdTripId` | 그대로 |
| 볼 수 있는지 판단 | `trip/domain/TripAccessPolicy.java` | 그대로 |
| "누가 무엇을 고쳤다" 문장 | `trip/application/PlaceService.java:43` `announce` | 본보기로 |

`announce` 는 이미 `"11.02 (월)에 「이치란」 을 넣었습니다."` 같은 문장을
만들어 푸시로 보내고 **버립니다**(`:84`·`:139`·`:154`·`:193`). 소식함이
쓰는 말은 여기에 맞춥니다. 같은 일을 두 가지 말로 하면 푸시를 받고 들어온
사람이 다른 문장을 보게 됩니다.

## 3. 버리는 것

### 3.1 `AuditLog` 재사용 — 버립니다

모양은 비슷하지만 색인 기준이 반대입니다.

| | `AuditLog` | 소식함 |
|---|---|---|
| 기준 | **누가 했는가**(`userId`) | **누구에게 보일 것인가** |
| 용도 | 운영자 감사 | 사용자 화면 |
| 보관 | 감사 정책 | 오래되면 버림 |

부르는 자리가 41 곳입니다. 여기에 화면 사정을 섞으면 나중에 둘 다 못
고칩니다.

### 3.2 챙길 것 · 동행자 들고남 · 날짜 변경 — **이번에는 못 담습니다**

`ideas.md` 의 보기에 `민수님이 '어댑터'를 챙긴다고 했어요` 가 있지만,
**그 시각이 저장되고 있지 않습니다.**

| 재료 | 가진 시각 | 그래서 |
|---|---|---|
| `TripItem` | `createdAt` 만 | `done`·`ownerId` 가 언제 바뀌었는지 모릅니다 |
| `TripMember` | 없음 | 언제 들어왔는지 모릅니다 |
| `Day` | `version` 만 | 언제 바뀌었는지 모릅니다 |

칸을 더하면 담을 수 있습니다. 다만 **1차에서는 안 더합니다** — 소식함이
실제로 읽히는지 보기 전에 표 셋을 고치면, 안 읽히는 소식을 위해 스키마를
세 번 바꾼 것이 됩니다. 읽힌다는 것이 확인되면 그때 `V21` 로 한 번에
더합니다.

문서에 남겨 둡니다. 나중에 "왜 챙길 것은 안 나오나" 를 다시 묻지 않기
위해서입니다.

### 3.3 푸시 늘리기 — 버립니다

들어왔을 때만 보입니다. 알림이 한 건도 늘지 않습니다. 지금 푸시는
`PlaceService.announce` 와 `TripReminder` 둘뿐이고, 그대로 둡니다.

### 3.4 조회 하나하나를 소식 줄로 올리는 것 — 버립니다

`'오사카 3박 4일' 을 12명이 봤어요` 를 12줄로 올리면 목록이 그것만으로
찹니다. 누적되는 것은 `plan-tip-used.md` 가 맡는 **아래 요약 줄**입니다.

### 3.5 여행 복제 알림 — 이번에는 버립니다

`'오사카 3박 4일' 을 12명이 가져갔어요` 는 좋은 줄이지만, 복제 기록이
`AuditLog` 에만 남습니다(`post.copy`). 3.1 에서 안 쓰기로 한 표입니다.
`TripPost` 에 복제 수 칸을 더하는 쪽이 맞고, 그건 2차입니다.

## 4. 갈 곳

```
[앱을 연다]
     |
     v
GET /api/news
     |
     v
NewsService — 읽을 때 모읍니다 (표를 안 늘립니다)
     |
     +-- 내가 속한 여행에서
     |     Place.updatedAt > since, updatedBy != 나
     |     TripCandidate.createdAt > since, addedBy != 나
     |     CandidateVote.createdAt > since, userId != 나
     |
     +-- 내가 올린 글에서
     |     PostLike.createdAt > since, userId != 나
     |     PostComment.createdAt > since, userId != 나
     |
     v
시각 내림차순으로 섞어 최대 30줄
     |
     v
홈 — 새것이 있으면 점 하나. 열면 목록
     |
     v
[열었다] → PUT /api/news/seen → users.news_seen_at = now
```

`since` 는 **마지막으로 본 시각**이 아니라 **30일 전**입니다. 마지막으로
본 시각은 "새것" 표시에만 씁니다 — 열어 본 뒤에도 어제 것이 남아 있어야
"아까 뭐였더라" 가 됩니다.

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `backend/.../news/application/NewsService.java` | 새로 만듭니다 |
| `backend/.../news/api/NewsController.java` | 새로 만듭니다 |
| `backend/.../account/domain/User.java` | `newsSeenAt` 한 칸 |
| `backend/src/main/resources/db/migration/V21__news_seen.sql` | 위 칸 |
| `backend/.../trip/domain/PlaceRepository.java` | 여행 여럿에서 최근 변경을 뽑는 질의 |
| `backend/.../trip/domain/TripCandidateRepository.java` | 같음 |
| `backend/.../trip/domain/CandidateVoteRepository.java` | 같음 |
| `backend/.../community/domain/PostLikeRepository.java` | 내 글에 붙은 것 |
| `backend/.../community/domain/PostCommentRepository.java` | 같음 |
| `frontend/src/api/types.ts` | `NewsItem` 타입 |
| `frontend/src/app/news.tsx` | 새 화면 |
| `frontend/src/app/(app)/home.tsx` | 새것이 있으면 점 하나 |

### 5.1 왜 `news` 라는 새 묶음인가

`community` 도 `trip` 도 아닙니다. 양쪽에서 재료를 가져옵니다. 어느 한쪽에
넣으면 그 묶음이 반대쪽 표를 읽게 되어, 나중에 둘을 가를 수 없습니다.

## 6. API

### 6.1 소식 읽기

| | |
|---|---|
| 메서드·경로 | `GET /api/news` |
| 권한 | 로그인 필수. `SecurityConfig` 의 `/api/**` 규칙에 그대로 걸립니다 |
| 요청 | 없음 |
| 응답 | `{ "items": [...], "unseen": 3, "seenAt": "..." }` |
| 실패 | 401 (로그인 없음) |

```json
{
  "items": [
    {
      "at": "2026-09-11T02:14:00Z",
      "kind": "place.add",
      "actorName": "지영",
      "tripId": "8tBuz2-RWMhp",
      "tripTitle": "오사카 3박 4일",
      "text": "11.02 (월)에 「이치란」 을 넣었습니다.",
      "url": "/trip/8tBuz2-RWMhp",
      "fresh": true
    }
  ],
  "unseen": 3,
  "seenAt": "2026-09-10T22:00:00Z"
}
```

`kind` 는 `place.add` · `place.edit` · `place.remove` · `candidate.add` ·
`candidate.vote` · `post.like` · `post.comment` 입니다. 화면이 그림을
고르는 데 씁니다. **문장은 서버가 만듭니다** — `announce` 가 이미 그렇게
하고 있고, 같은 말을 두 군데서 만들면 갈립니다.

`fresh` 는 `at > seenAt` 입니다. 서버가 판단해 내려보냅니다.

### 6.2 봤다고 표시하기

| | |
|---|---|
| 메서드·경로 | `PUT /api/news/seen` |
| 권한 | 로그인 필수 |
| 요청 | 없음 |
| 응답 | `{ "seenAt": "..." }` |
| 실패 | 401 |

화면을 **열었을 때** 부릅니다. 스크롤 끝까지 내렸는지는 보지 않습니다 —
그것을 재려면 화면이 훨씬 복잡해지고, 얻는 것은 "정확히 다 읽었나" 뿐
입니다.

### 6.3 권한

여행 쪽 재료는 **내가 동행자인 여행에서만** 뽑습니다. 질의가
`TripMemberRepository.findAllByIdTripId` 로 얻은 여행 번호 목록 안에서만
돌므로, 남의 여행 것은 애초에 후보에 안 들어옵니다.

`TripAccessPolicy.requireCanRead` 를 줄마다 부르지 않습니다 — 목록을
먼저 좁히는 쪽이 질의 한 번이고, 뒤에서 거르는 쪽은 N 번입니다. 다만
**테스트로는 반드시 확인합니다**(7 번).

내 글 쪽은 `TripPost.authorId = 나` 로 좁힙니다.

### 6.4 내가 한 일은 안 담습니다

`updatedBy != 나`, `userId != 나`. 내가 방금 넣은 장소가 소식으로 돌아오면
목록이 내 발자국으로 찹니다. `announce` 도 같은 규칙입니다 — "고친
사람에게는 가지 않고"(`PlaceService.java:37` 주석).

### 구글 호출

0. `GoogleQuotaFilter.callsOf` 에 더할 것이 없습니다. 이 자리는 구글을
안 부릅니다.

### 스키마

`V21__news_seen.sql` — `users` 에 `news_seen_at timestamptz` 한 칸.
`NULL` 허용입니다. 없으면 "한 번도 안 봤다" 로 보고 전부 새것으로 칩니다.

되돌릴 수 있습니다. 칸 하나를 더하는 것뿐이라 지우면 그만입니다.

## 7. 테스트

`backend/src/test/http/news.test.mjs` 를 **새로 만듭니다**. 기존 묶음에
끼우기에는 재료가 여행과 게시판 양쪽에 걸쳐 있습니다.

| 무엇을 | 몇 |
|---|---|
| 로그인 없이는 401 | 1 |
| **남의 여행 것은 안 실린다** | 2 |
| **남의 글에 붙은 추천은 안 실린다** | 1 |
| 내가 한 일은 안 실린다 | 2 |
| 동행자가 장소를 넣으면 실린다 | 1 |
| 후보·투표가 실린다 | 2 |
| 내 글의 추천·댓글이 실린다 | 2 |
| 시각 내림차순으로 섞인다 | 1 |
| 봤다고 표시하면 `unseen` 이 0 | 2 |
| 표시한 뒤에도 목록은 남는다 | 1 |
| 내려간 글의 댓글은 안 실린다 | 1 |

열여섯 중 **셋이 "남의 것이 새지 않는가"** 입니다. 이 자리는 여러 사람의
표를 한 질의로 긁으므로, 조건 하나가 빠지면 남의 여행이 그대로 보입니다.
눈으로 지키기 어려운 자리입니다.

`README.md` 의 점검 목록에도 한 줄 더합니다.

## 8. 순서와 의존

1. `V21__news_seen.sql` + `User.newsSeenAt`
2. 저장소 질의 다섯 — 각각 따로. 여기서 틀리면 위가 전부 틀립니다
3. `NewsService` — 모으고 섞고 자릅니다
4. `NewsController` + `news.test.mjs`. **여기까지 초록불을 보고 넘어갑니다**
5. `src/app/news.tsx`
6. `home.tsx` 에 점 하나

4 가 끝나기 전에 5 를 열지 않습니다. 화면을 먼저 만들면 질의가 틀렸을 때
화면 탓인지 질의 탓인지 모릅니다.

## 9. 아직 모르는 것

- **질의가 몇 ms 인가.** 여행 5개 × 동행자 5명 × 장소 50개에서 재 봐야
  압니다. 실측 전입니다. 느리면 `announce` 자리에서 소식 한 줄을 쌓는
  쪽으로 옮깁니다 — 그 문장을 만드는 코드가 이미 거기 있습니다.
- **30줄·30일이 맞는 수인지.** 근거 없이 고른 값입니다. 붙여 놓고
  줄어드는지 늘어나는지 봅니다.
- **홈의 점을 어디에 다는지.** 오른쪽 위 설정 아이콘 옆인지, 메뉴 카드를
  하나 더 만드는지. 카드를 더하면 넷이 다섯이 되어 `home.tsx` 의 2열
  배치가 흐트러집니다.
- **`kind` 별로 그림을 붙일지.** 글자만으로 충분할 수 있습니다. 목록이
  실제로 얼마나 길어지는지 본 뒤에 정합니다.
