# 내가 남긴 한 줄이 쓰였다는 것

> `verdict-ideas.md` 3 번에서 **찬성** 으로 받은 것의 실행 계획입니다.
> `plan-news.md` 가 먼저 서야 합니다 — 같은 화면의 아래층입니다.
> 아직 코드는 한 줄도 바뀌지 않았습니다.

## 1. 하려는 것

`PlaceTip`(한 줄)은 이 앱에서 **여행이 끝난 뒤에도 계속 값이 생기는 유일한
것**입니다. "2번 출구로 나와야 함" 을 남기면 몇 달 뒤 다른 사람이 그
장소를 열 때 쓰입니다.

그런데 **남기고 끝입니다.** 자기가 남긴 것이 쓰였는지 알 길이 없습니다.
남긴 사람에게 이 앱은 "한 번 글자를 넣은 곳" 으로 끝납니다.

지금 우회할 방법도 없습니다. 내 팁 목록을 보는 화면조차 없습니다 —
팁은 장소를 열어야만 보입니다(`components/tip-sheet.tsx:58`).

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 |
|---|---|
| 팁 한 줄 | `tip/domain/PlaceTip.java` — `placeId`·`userId`·`text`·`hidden`·`createdAt` |
| 팁을 읽는 **단 한 곳** | `tip/api/TipController.java:27` `GET /api/places/{placeId}/tips` |
| 하루 한 번만 세는 본보기 | `community/domain/PostView.java` — `(postId, userId, onDate)` |
| 그 본보기를 부르는 자리 | `community/api/PostController.java:102-104` |
| 세는 쪽 | `community/application/PostService.java:245` `countView` |

**`PlaceTip` 에는 조회를 세는 것이 없습니다.** 새로 만드는 것은 그것
하나입니다.

## 3. 버리는 것

### 3.1 뱃지·점수·등급 — 버립니다

"팁 마스터", "레벨 3" 같은 것. 이 앱은 게임이 아닙니다. 보여 줄 것은
**실제로 남을 도운 횟수** 하나면 됩니다. 수를 점수로 바꾸는 순간 수를
올리려는 행동이 생기고, 그러면 팁 칸이 쓰레기로 찹니다.

### 3.2 소식 목록에 한 줄씩 올리는 것 — 버립니다

`plan-news.md` 3.4 와 같은 판단입니다. 조회 하나하나가 소식으로 올라오면
목록이 그것만으로 찹니다. **합쳐서 아래 요약 줄 하나**로 둡니다.

| | 소식 (`plan-news.md`) | 이것 |
|---|---|---|
| 예 | "지영님이 장소를 넣었어요" | "내 한 줄을 47명이 봤어요" |
| 성격 | 읽으면 지나감 · 새것 표시 | 사라지지 않고 누적 |
| 자리 | 위쪽 목록 | 아래 요약 줄 |

### 3.3 손님(비로그인) 조회를 세는 것 — 버립니다

팁 읽기는 로그인 없이 열려 있습니다(`SecurityConfig.java:84`). 손님에게는
사람 번호가 없어 **"하루 한 번" 을 셀 수가 없습니다.** 아이피로 세면
자취를 쌓는 일이 되고, 그건 위치 규칙과 같은 이유로 하지 않습니다.

글 쪽도 같은 이유로 로그인한 사람만 셉니다
(`PostController.java:102` 의 `if (me != null)`). 같은 규칙을 씁니다.

그래서 이 수는 **"이만큼은 확실히 쓰였다"** 이지 전체 조회수가 아닙니다.
화면에서도 그렇게 말합니다 — 부풀린 수 한 줄이 나머지 전부를 못 믿게
만듭니다.

### 3.4 내가 내 팁을 본 것 — 안 셉니다

장소를 열 때마다 내 수가 오릅니다. `userId != tip.userId` 로 거릅니다.

### 3.5 내려간 팁 — 안 셉니다

`hidden = true` 인 것은 신고가 쌓여 내려간 것입니다. 그것이 쓰였다고
말하면 안 됩니다.

## 4. 갈 곳

```
[남이 장소 하나를 연다]
        |
        v
GET /api/places/{placeId}/tips        ← 이미 있는 자리
        |
        +-- 목록을 돌려주고 (지금 하는 일)
        |
        +-- 로그인했고, 내 팁이 아니고, 안 내려간 것이면
              place_tip_views 에 (tipId, userId, onDate) 를 한 줄
              이미 있으면 아무 일도 없음
        |
        v
[내가 소식함을 연다]
        |
        v
GET /api/news  →  아래 요약 줄
        "남긴 한 줄 4개를 47명이 봤습니다"
```

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `backend/.../tip/domain/PlaceTipView.java` | 새로 만듭니다. `PostView` 와 같은 모양 |
| `backend/.../tip/domain/PlaceTipViewRepository.java` | 새로 만듭니다 |
| `backend/src/main/resources/db/migration/V22__place_tip_views.sql` | 새 표 |
| `backend/.../tip/application/TipService.java` | 목록을 줄 때 세는 줄을 더합니다 |
| `backend/.../tip/api/TipController.java` | `@CurrentUser` 를 세는 쪽으로 넘깁니다 |
| `backend/.../news/application/NewsService.java` | 요약 한 줄을 더합니다 |
| `frontend/src/app/news.tsx` | 아래 요약 줄 |

### 5.1 `V22` 인 이유

`plan-news.md` 가 `V21__news_seen.sql` 을 씁니다. 그것이 먼저입니다.
순서가 바뀌면 번호를 맞춰 고칩니다.

### 5.2 표 모양

```sql
create table place_tip_views (
    tip_id   varchar(12)  not null,
    user_id  varchar(12)  not null,
    on_date  date         not null,
    primary key (tip_id, user_id, on_date)
);

create index idx_tip_views_tip on place_tip_views (tip_id);
```

`PostView` 와 같습니다. 열쇠 셋이 곧 "하루 한 번" 규칙입니다 — 두 번째
넣기가 조용히 실패하면 그만이라, 세는 쪽에 조건문이 필요 없습니다.

되돌릴 수 있습니다. 표 하나를 지우면 그만이고, 지워도 팁 자체는
멀쩡합니다.

## 6. API

**새 엔드포인트가 없습니다.** 두 자리를 고칩니다.

### 6.1 `GET /api/places/{placeId}/tips` — 세는 일이 붙습니다

| | |
|---|---|
| 권한 | 지금과 같음. 로그인 없이 열립니다 |
| 요청·응답 | **안 바뀝니다** |
| 달라지는 것 | 로그인한 사람이 부르면 행이 늘 수 있습니다 |

세는 일이 실패해도 목록은 돌려줍니다. 세는 것 때문에 읽는 것이 막히면
앞뒤가 바뀝니다 — `PlaceService.announce` 가 같은 자리에서 같은 판단을
합니다(`PlaceService.java:39-40` 주석).

### 6.2 `GET /api/news` — 요약이 붙습니다

`plan-news.md` 6.1 의 응답에 한 덩이를 더합니다.

```json
{
  "items": [ ... ],
  "unseen": 3,
  "mine": {
    "tipCount": 4,
    "viewCount": 47
  }
}
```

`mine` 은 팁을 하나도 안 남긴 사람에게는 **안 실립니다**(`null`).
0 을 보여 주면 "너는 아무것도 안 했다" 가 되고, 그건 돌아올 이유가
아니라 안 돌아올 이유입니다.

### 구글 호출

0. `GoogleQuotaFilter.callsOf` 는 그대로입니다. `/tips` 는 지금도 구글을
안 부릅니다.

## 7. 테스트

`backend/src/test/http/tip.test.mjs` 에 **여덟을 더합니다.**

| 무엇을 | 몇 |
|---|---|
| 남이 읽으면 는다 | 1 |
| 같은 사람이 다시 읽어도 안 는다 | 1 |
| 내가 내 팁을 읽으면 안 는다 | 1 |
| 손님이 읽으면 안 는다 | 1 |
| 내려간 팁은 안 센다 | 1 |
| 팁이 없는 사람에게는 `mine` 이 안 실린다 | 1 |
| `mine.tipCount` 가 내 팁 수와 같다 | 1 |
| **남의 팁 조회수가 내 것으로 안 실린다** | 1 |

마지막 하나가 이 묶음에서 가장 중요합니다. 집계 질의에서 `userId`
조건이 빠지면 전체 조회수가 모두에게 자기 것처럼 보입니다. 눈으로는
"수가 크네" 정도로만 보여서 안 걸립니다.

## 8. 순서와 의존

1. **`plan-news.md` 가 4 번까지 끝나 있어야 합니다** — 요약이 붙을 응답과
   화면이 있어야 합니다
2. `V22__place_tip_views.sql` + `PlaceTipView` + 저장소
3. `TipService` 에 세는 줄. `tip.test.mjs` 로 다섯 가지 경우를 먼저 봅니다
4. `NewsService` 에 요약 한 덩이 + 나머지 셋
5. `news.tsx` 아래 줄

3 이 초록불이 되기 전에 4 로 가지 않습니다. 세는 규칙이 틀리면 요약이
틀리고, 요약이 틀린 것은 화면에서 안 보입니다.

## 9. 아직 모르는 것

- **"47명" 인지 "47번" 인지.** 열쇠가 `(tipId, userId, onDate)` 라
  같은 사람이 다른 날 보면 둘로 셉니다. 그러면 "명" 이 아닙니다. 사람
  수로 세려면 `count(distinct user_id)` 이고, 그건 질의가 무거워집니다.
  1차는 `count(*)` 로 하고 화면에서 "번" 으로 적을지, 아니면 사람 수로
  갈지 — 실제 수가 얼마나 되는지 본 뒤에 정합니다.
- **팁 하나하나를 보여 줄지, 합계만 보여 줄지.** "내가 남긴 것" 화면이
  따로 필요한지는 요약 줄을 눌러 보는 사람이 있는지 보고 정합니다.
- **오래된 조회를 버릴지.** `PostView` 도 지금은 안 버립니다. 같이
  생각해야 할 문제라 여기서 혼자 정하지 않습니다.
