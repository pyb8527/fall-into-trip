# 기능명세서 — 그룹 · 피드 · 리뷰

> [`verdict.md`](verdict.md) 에서 정한 것을 **데이터 · 규칙 · API** 로
> 적습니다. 화면은 [`screens.md`](screens.md) 에 있습니다.

## 0. 낱말

| 말 | 뜻 |
|---|---|
| **그룹** | 여행을 같이 가는 무리. 사람이 사는 자리 |
| **여행** | 그룹의 것이거나 혼자 것 |
| **피드 글** | 사진 + 글 + 태그. 그룹에 올리거나 내 것으로 올립니다 |
| **리뷰** | 장소에 다는 별점과 한 줄. 지금 「한 줄 팁」을 늘린 것 |
| **여행기** | 밖에 내놓는 사본. 지금 그대로 (`trip_posts`) |

## 1. 새 데이터

### 1-1. `groups`

| 칸 | 꼴 | 설명 |
|---|---|---|
| `id` | VARCHAR(16) PK | |
| `name` | VARCHAR(40) NOT NULL | |
| `about` | VARCHAR(200) | 한 줄 소개. 없어도 됨 |
| `emoji` | VARCHAR(8) | 그림 하나 |
| `cover_photo_id` | VARCHAR(16) → `photos` | 표지. 없어도 됨 |
| `owner_id` | VARCHAR(16) NOT NULL → `users` | |
| `created_at` | TIMESTAMPTZ NOT NULL | |

> **왜 그림이 먼저이고 사진이 나중인가** — 그룹 만드는 자리에서 사진을
> 고르라고 하면 거기서 멈춥니다. 그룹 만들기는 **이름 하나**로 끝나야
> 합니다. 「이번 여행만 같이 짜는 동료」에게도 그룹을 만들어야 하므로
> (여행 멤버를 없앴으니) **가벼운 것이 설계의 조건**입니다.

### 1-2. `group_members`

| 칸 | 꼴 |
|---|---|
| `group_id` | VARCHAR(16) PK1 → `groups` ON DELETE CASCADE |
| `user_id` | VARCHAR(16) PK2 → `users` ON DELETE CASCADE |
| `role` | VARCHAR(16) NOT NULL — `OWNER` / `MEMBER` |
| `joined_at` | TIMESTAMPTZ NOT NULL |

### 1-3. `group_invites`

지금 `trip_invites` 를 **그대로 옮깁니다** — 토큰은 해시로만, 만료 있음.

| 칸 | 꼴 |
|---|---|
| `id` | VARCHAR(16) PK |
| `group_id` | VARCHAR(16) NOT NULL → `groups` ON DELETE CASCADE |
| `token_hash` | VARCHAR(64) NOT NULL UNIQUE |
| `created_by` | VARCHAR(16) NOT NULL |
| `created_at` | TIMESTAMPTZ NOT NULL |
| `expires_at` | TIMESTAMPTZ |

### 1-4. `posts` — 피드 글

> 이름을 `group_posts` 가 아니라 `posts` 로 둡니다. **그룹 없이도 올리므로**
> 그룹이 이 글의 주인이 아닙니다.

| 칸 | 꼴 | 설명 |
|---|---|---|
| `id` | VARCHAR(16) PK | |
| `author_id` | VARCHAR(16) NOT NULL → `users` | |
| `group_id` | VARCHAR(16) → `groups` ON DELETE CASCADE | **없으면 내 피드** |
| `trip_id` | VARCHAR(16) → `trips` ON DELETE SET NULL | 어느 여행 이야기인지 |
| `text` | VARCHAR(2000) | 사진만 올려도 됨 |
| `tags` | TEXT[] NOT NULL DEFAULT '{}' | 자유 태그 |
| `hidden` | BOOLEAN NOT NULL DEFAULT false | |
| `created_at` | TIMESTAMPTZ NOT NULL | |
| `updated_at` | TIMESTAMPTZ NOT NULL | |

```sql
CREATE INDEX idx_posts_group ON posts (group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX idx_posts_mine  ON posts (author_id, created_at DESC);
CREATE INDEX idx_posts_trip  ON posts (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX idx_posts_tags  ON posts USING GIN (tags);
```

> `trip_posts`(여행기)와 **가릅니다**. 저쪽은 제목·지역·사본·복제·공개
> 범위를 가집니다. 이쪽은 하나도 안 가집니다.

### 1-5. `post_photos`

| 칸 | 꼴 |
|---|---|
| `post_id` | VARCHAR(16) PK1 → `posts` ON DELETE CASCADE |
| `photo_id` | VARCHAR(16) PK2 → `photos` ON DELETE CASCADE |
| `sort` | INTEGER NOT NULL |

`place_photos` 와 같은 꼴 — 배열이 아니라 줄로 둡니다. 사진이 지워지면
함께 갑니다.

### 1-6. `place_tips` 에 별점 한 칸

```sql
ALTER TABLE place_tips ADD COLUMN stars SMALLINT;
```

**새 표를 안 만듭니다.** 별점만 두는 표를 또 파면 「한 줄은 썼는데 별점은
없는 사람」과 「별점만 있는 사람」이 갈리고, 평균을 낼 때 둘을 합쳐야
합니다. 한 줄이나 별점 **둘 중 하나만 있어도** 한 줄로 섭니다.

> `place_tips` 는 여행이 아니라 **구글 장소 번호**에 답니다. 그래서 남의
> 일정에서도 보이고, 쌓이면 그대로 랭킹과 추천의 재료가 됩니다.

### 1-7. 댓글은 지금 것을 늘립니다

```sql
ALTER TABLE post_comments ADD COLUMN kind VARCHAR(8) NOT NULL DEFAULT 'JOURNAL';
```

`JOURNAL` 은 여행기 댓글, `FEED` 는 피드 글 댓글.

> 표를 새로 파는 것보다 낫습니다 — 신고·숨김·운영 화면이 이미 이 표를
> 봅니다. 대신 **외래키를 못 겁니다**(한 칸이 두 표를 가리킵니다). 글을
> 지울 때 댓글을 **코드가** 지워야 합니다.

## 2. 없애는 데이터

```sql
-- 도장
ALTER TABLE places DROP COLUMN visited_at;
ALTER TABLE places DROP COLUMN visited_by;

-- 장소마다 기록 (별점은 place_tips 로, 글은 posts 로)
ALTER TABLE places DROP COLUMN stars;
ALTER TABLE places DROP COLUMN review;
DELETE FROM place_photos WHERE kind = 'RECORD';   -- REFERENCE 는 남습니다

-- 여행 멤버 → 그룹 멤버
DROP TABLE trip_invites;
DROP TABLE trip_members;
```

### 지금 데이터를 어떻게 옮기나

**멤버가 둘 이상인 여행마다 그룹을 하나씩 만듭니다.**

```
여행 「오사카 3박 4일」 (지영·민수·유정)
   ↓
그룹 「오사카 3박 4일」 (지영 OWNER, 민수·유정 MEMBER)
   └── 여행 「오사카 3박 4일」
```

- 그룹 이름은 **여행 이름을 그대로** 씁니다. 사람이 나중에 고칩니다
- 혼자 쓰던 여행은 그룹을 안 만듭니다 — `group_id` 가 NULL 로 남습니다
- **`RECORD` 사진은 버려집니다.** 피드 글로 옮기는 길도 있지만, 장소마다
  글 한 편이 생겨 피드가 첫날부터 쓰레기가 됩니다

> **되돌릴 수 없습니다.** 지금 쓰는 사람이 혼자라 값이 작지만, 그래서
> **지금 하는 것**이 맞습니다.

## 3. 규칙

### 3-1. 볼 수 있는가

```
여행을 볼 수 있다  = trips.owner_id 가 나다
                   OR (trips.group_id 가 있고) 그 그룹의 멤버다
여행을 고칠 수 있다 = 위와 같다
```

멤버 표가 하나라 **갈래가 안 생깁니다.** 지금 `TripAccessPolicy` 의
`requireCanRead` / `requireCanEdit` 두 갈래가 하나로 합쳐집니다.

못 보는 사람에게는 **404** 입니다(403 아님).

### 3-2. 피드 글을 볼 수 있는가

```
group_id 가 있으면  → 그 그룹의 멤버만
group_id 가 없으면  → 글쓴이만
```

### 3-3. 그룹 역할

| | OWNER | MEMBER |
|---|---|---|
| 이름·소개·표지 고치기 | O | X |
| 초대 링크 만들기 | O | O |
| 멤버 내보내기 | O | X |
| 그룹 지우기 | O | X |
| 여행 만들기·고치기 | O | O |
| 글 올리기 | O | O |
| 남의 글 지우기 | O | X (제 글만) |
| 나가기 | X (넘기고 나감) | O |

### 3-4. 지우면

| 지우는 것 | 같이 가는 것 | 남는 것 |
|---|---|---|
| 그룹 | 멤버·초대·그 그룹 피드 글 | **여행** — `group_id` 가 NULL 이 되어 만든 사람 것으로 |
| 여행 | 날짜·장소·가계부·후보 | 그 여행을 가리키던 피드 글 (`trip_id` 만 NULL) |
| 피드 글 | 사진 연결·댓글 | 사진 파일 (올린 글에 실려 있으면 안 지웁니다 — 지금 규칙 그대로) |

### 3-5. 한도

| 무엇 | 얼마 |
|---|---|
| 한 사람이 속하는 그룹 | 50 |
| 그룹 멤버 | 100 |
| 피드 글 한 편의 사진 | 10 |
| 글 길이 | 2000자 |
| 태그 | 한 글에 5개 |
| 리뷰 별점 | 1~5, 장소마다 한 사람 하나 |

## 4. API

### 4-1. 그룹

| 길 | 하는 일 | 누가 |
|---|---|---|
| `POST /api/groups` | 만들기 | 로그인 |
| `GET /api/groups` | 내가 속한 그룹들 | 로그인 |
| `GET /api/groups/{id}` | 멤버·여행·최근 글 | 멤버 |
| `PATCH /api/groups/{id}` | 이름·소개·그림·표지 | OWNER |
| `DELETE /api/groups/{id}` | 지우기 | OWNER |
| `DELETE /api/groups/{id}/members/me` | 나가기 | MEMBER |
| `DELETE /api/groups/{id}/members/{userId}` | 내보내기 | OWNER |
| `PATCH /api/groups/{id}/owner` | 주인 넘기기 | OWNER |

### 4-2. 초대

| 길 | 하는 일 | 누가 |
|---|---|---|
| `POST /api/groups/{id}/invites` | 링크 만들기 | 멤버 |
| `GET /api/group-invites/{token}/preview` | 미리보기 | **로그인 없이** |
| `POST /api/group-invites/{token}/accept` | 들어가기 | 로그인 |

### 4-3. 여행

| 길 | 바뀌는 점 |
|---|---|
| `POST /api/trips` | `groupId` 를 받을 수 있습니다(없으면 혼자 여행) |
| `GET /api/trips` | `scope=mine` / `scope=group` 으로 가릅니다 |
| `PATCH /api/trips/{id}/group` | 그룹에 넣기·빼기 |
| ~~`/api/trips/{id}/invites`~~ | **없어집니다** |
| ~~`/api/trips/{id}/members`~~ | **없어집니다** |

### 4-4. 피드

| 길 | 하는 일 |
|---|---|
| `GET /api/feed?group={id}` | 그룹 피드 |
| `GET /api/feed?mine=true` | 내 피드 |
| `GET /api/feed?trip={id}` | 그 여행에 붙은 글들 |
| `POST /api/feed` | 올리기 (`groupId` 없으면 내 것) |
| `PATCH /api/feed/{id}` | 고치기 |
| `DELETE /api/feed/{id}` | 지우기 |
| `GET /api/feed/{id}/comments` · `POST` | 댓글 |

### 4-5. 리뷰

| 길 | 바뀌는 점 |
|---|---|
| `POST /api/places/{placeId}/tips` | `stars` 를 함께 받습니다 |
| `GET /api/places/{placeId}/tips` | 평균 별점과 몇 명인지가 함께 옵니다 |

### 4-6. 마이페이지

| 길 | 누가 |
|---|---|
| `GET /api/me/profile` | 로그인 |
| `GET /api/users/{id}/profile` | **같은 그룹 멤버만** |

> 아무나 id 로 열 수 있으면 그게 곧 사람 찾기가 되고,
> [안 하기로 한 것](verdict.md#그리고-안-한다)을 뒷문으로 여는 셈입니다.

## 5. 소식

| 종류 | 문구 | 누구에게 |
|---|---|---|
| `GROUP_JOINED` | 지영님이 ○○ 에 들어왔어요 | 그룹 멤버 |
| `FEED_POST` | 지영님이 ○○ 에 글을 올렸어요 | 그룹 멤버 |
| `GROUP_TRIP` | ○○ 에 '오사카 3박' 이 생겼어요 | 그룹 멤버 |

푸시는 **여행이 생겼을 때만** 보냅니다. 글마다 보내면 활발한 모임일수록
시끄럽습니다.

## 6. 기존 자리에 생기는 변화

| 자리 | 무엇이 |
|---|---|
| `TripAccessPolicy` | 두 갈래가 하나로 — 그룹만 봅니다 |
| `MemberService` · `InviteService` | **없어집니다** (그룹 쪽으로) |
| `VisitService` | **거의 없어집니다** — 도장과 기록이 사라집니다. `REFERENCE` 사진만 남습니다 |
| `PostService`(여행기) | 사본에 장소 기록 대신 **고른 피드 글**을 담습니다 |
| `NewsService` | 종류 셋이 늡니다 |
| `PlaceTipService` | 별점과 평균이 붙습니다 |
| 아래 갈래 띠 | 칸이 바뀝니다 ([`screens.md`](screens.md) 참고) |

## 7. 안 바뀌는 것

- **여행기와 둘러보기** — 사본에 담기는 것만 바뀌고 나머지는 그대로
- **보석함 · 가계부 · 챙길 것 · 후보 투표** — 여행에 딸린 것이라 그대로
- **사진 굽기 · EXIF 제거 · `PhotoStore`** — 그대로
- **챙겨 둔 사진**(`place_photos.kind = REFERENCE`) — 그대로
