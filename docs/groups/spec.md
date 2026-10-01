# 기능명세서 — 그룹

> [`verdict.md`](verdict.md) 에서 정한 것을 **데이터·규칙·API** 로 적습니다.
> 화면은 [`screens.md`](screens.md) 에 따로 있습니다.

## 0. 낱말

| 말 | 뜻 | 기존의 무엇과 다른가 |
|---|---|---|
| **그룹** | 여러 여행을 같이 가는 무리 | 여행보다 한 층 위 |
| **그룹 멤버** | 그룹에 속한 사람 | 여행 멤버와 별개 |
| **그룹 글** | 그룹 안에서만 보이는 글 | 여행기(사본·공개)와 별개 |
| **그룹 사진첩** | 장소에 안 붙는 사진 | `place_photos`(장소에 붙음)와 별개 |

## 1. 데이터

### 1-1. `groups`

| 칸 | 꼴 | 설명 |
|---|---|---|
| `id` | VARCHAR(16) PK | 난수 |
| `name` | VARCHAR(40) NOT NULL | 「오사카 모임」 |
| `about` | VARCHAR(200) | 한 줄 소개. 없어도 됨 |
| `emoji` | VARCHAR(8) | 그림 하나. 여행의 `emoji` 와 같은 방식 |
| `cover_photo_id` | VARCHAR(16) → `photos` | 표지. 없어도 됨 |
| `owner_id` | VARCHAR(16) NOT NULL → `users` | 만든 사람 |
| `created_at` | TIMESTAMPTZ NOT NULL | |

> **왜 사진이 아니라 그림(emoji)이 먼저인가** — 그룹을 만드는 자리에서 사진을
> 고르라고 하면 거기서 멈춥니다. 그림 하나는 두 번 두드리면 끝납니다.
> 표지 사진은 나중에 채웁니다.

### 1-2. `group_members`

| 칸 | 꼴 | 설명 |
|---|---|---|
| `group_id` | VARCHAR(16) PK1 → `groups` ON DELETE CASCADE | |
| `user_id` | VARCHAR(16) PK2 → `users` ON DELETE CASCADE | |
| `role` | VARCHAR(16) NOT NULL | `OWNER` / `MEMBER` |
| `joined_at` | TIMESTAMPTZ NOT NULL | |

`TripMember` 를 그대로 본뜹니다.

### 1-3. `group_invites`

`TripInvite` 를 **그대로** 본뜹니다 — 토큰은 해시로만, 만료 있음.

| 칸 | 꼴 |
|---|---|
| `id` | VARCHAR(16) PK |
| `group_id` | VARCHAR(16) NOT NULL → `groups` ON DELETE CASCADE |
| `token_hash` | VARCHAR(64) NOT NULL UNIQUE |
| `created_by` | VARCHAR(16) NOT NULL |
| `created_at` | TIMESTAMPTZ NOT NULL |
| `expires_at` | TIMESTAMPTZ |

### 1-4. `trips` 에 칸 하나

```sql
ALTER TABLE trips ADD COLUMN group_id VARCHAR(16) REFERENCES groups (id) ON DELETE SET NULL;
CREATE INDEX idx_trips_group ON trips (group_id) WHERE group_id IS NOT NULL;
```

> `ON DELETE SET NULL` 입니다. **그룹을 지워도 여행은 안 지웁니다** — 방을
> 정리하려다 지난 여행이 통째로 사라지면 안 됩니다.

### 1-5. `group_posts`

| 칸 | 꼴 | 설명 |
|---|---|---|
| `id` | VARCHAR(16) PK | |
| `group_id` | VARCHAR(16) NOT NULL → `groups` ON DELETE CASCADE | |
| `author_id` | VARCHAR(16) NOT NULL → `users` | |
| `text` | VARCHAR(2000) | 글. 사진만 올려도 됨 |
| `trip_id` | VARCHAR(16) → `trips` ON DELETE SET NULL | 어느 여행 이야기인지. 없어도 됨 |
| `hidden` | BOOLEAN NOT NULL DEFAULT false | 운영자가 내린 것 |
| `created_at` | TIMESTAMPTZ NOT NULL | |
| `updated_at` | TIMESTAMPTZ NOT NULL | |

`trip_posts` 와 **가르는 이유**: 저쪽은 제목·태그·지역·사본(`snapshot`)·
복제·공개 범위를 가집니다. 이쪽은 하나도 안 가집니다. 한 표에 담으면 글마다
"제목이 필수인가, 복제가 되나" 가 달라집니다.

### 1-6. `group_post_photos`

| 칸 | 꼴 |
|---|---|
| `post_id` | VARCHAR(16) PK1 → `group_posts` ON DELETE CASCADE |
| `photo_id` | VARCHAR(16) PK2 → `photos` ON DELETE CASCADE |
| `sort` | INTEGER NOT NULL |

`place_photos` 와 같은 꼴입니다 — 배열 칸이 아니라 줄로 둡니다. 사진이
지워지면 함께 갑니다.

### 1-7. `group_photos` — 사진첩 (4단계)

| 칸 | 꼴 | 설명 |
|---|---|---|
| `group_id` | VARCHAR(16) PK1 → `groups` ON DELETE CASCADE | |
| `photo_id` | VARCHAR(16) PK2 → `photos` ON DELETE CASCADE | |
| `trip_id` | VARCHAR(16) → `trips` ON DELETE SET NULL | 어느 여행 때인지 |
| `added_by` | VARCHAR(16) → `users` ON DELETE SET NULL | |
| `added_at` | TIMESTAMPTZ NOT NULL | |

> **사진을 객체 저장소로 빼기 전에는 만들지 않습니다.**

### 1-8. 댓글은 지금 것을 늘립니다

`post_comments` 에 `kind` 를 더합니다.

```sql
ALTER TABLE post_comments ADD COLUMN kind VARCHAR(8) NOT NULL DEFAULT 'TRIP';
```

`TRIP` 은 여행기 댓글, `GROUP` 은 그룹 글 댓글. `post_id` 가 가리키는 표가
`kind` 로 갈립니다.

> 표를 새로 파는 것보다 낫습니다 — 신고·숨김·운영 화면이 이미 이 표를
> 봅니다. 표가 둘이 되면 그 셋을 다 두 벌로 만들어야 합니다.

## 2. 규칙

### 2-1. 볼 수 있는가 · 고칠 수 있는가

`TripAccessPolicy` 를 늘립니다.

```
여행을 볼 수 있다
  = 여행 멤버이다
  OR (trip.group_id 가 있고) 그 그룹의 멤버이다

여행을 고칠 수 있다
  = 여행 멤버(EDITOR)이다
  OR (trip.group_id 가 있고) 그 그룹의 멤버이다
```

그룹을 못 보는 사람에게는 **404** 입니다(403 아님). 지금 여행과 같은
규칙입니다 — 403 으로 답하면 id 를 바꿔 가며 무엇이 있는지 알아낼 수
있습니다.

### 2-2. 그룹 역할

| | OWNER | MEMBER |
|---|---|---|
| 그룹 이름·소개·표지 고치기 | O | X |
| 초대 링크 만들기 | O | O |
| 멤버 내보내기 | O | X |
| 그룹 지우기 | O | X |
| 그룹에 여행 만들기·고치기 | O | O |
| 글 올리기 | O | O |
| 남의 글 지우기 | O | X (제 글만) |
| 나가기 | X (넘기고 나감) | O |

> **초대는 멤버도 만듭니다.** 모임에 사람을 부르는 것은 흔한 일이고, 그걸
> 주인만 할 수 있게 하면 주인이 안 들어온 날에는 아무도 못 부릅니다.
> 닫힌 그룹이라 링크를 받은 사람만 들어오고, 그 링크는 멤버가 건넵니다.

### 2-3. 그룹을 지우면

1. `group_members`, `group_invites`, `group_posts`, `group_post_photos`,
   `group_photos` 가 같이 지워집니다 (CASCADE)
2. `trips.group_id` 는 **NULL 이 됩니다** — 여행은 남습니다
3. 여행 멤버가 아무도 없는 여행은 **주인만 보게 됩니다**

> 그래서 그룹을 지울 때 **"여행 N개는 남습니다"** 를 반드시 말해 줘야 합니다
> ([`screens.md`](screens.md) 의 G-5).

### 2-4. 나가면

- 그룹에서 나가도 **여행 멤버 자격은 그대로**입니다. 따로 들어온 것이니까요
- 그룹에만 속해 있던 사람은 그 여행들을 못 보게 됩니다
- OWNER 는 못 나갑니다 — 먼저 다른 사람에게 넘기거나 그룹을 지워야 합니다

### 2-5. 한도

| 무엇 | 얼마 | 왜 |
|---|---|---|
| 한 사람이 속하는 그룹 | 50 | 모임이 쉰을 넘기는 일은 없습니다 |
| 그룹 멤버 | 100 | 넘으면 닫힌 모임이 아닙니다 |
| 그룹 글 한 편의 사진 | 10 | 여행 기록(5)보다 넉넉히 — 단체 사진이 여럿입니다 |
| 글 길이 | 2000자 | |

## 3. API

### 3-1. 그룹

| 길 | 하는 일 | 누가 |
|---|---|---|
| `POST /api/groups` | 만들기 | 로그인 |
| `GET /api/groups` | 내가 속한 그룹들 | 로그인 |
| `GET /api/groups/{id}` | 그룹 하나 — 멤버·여행·최근 글 | 멤버 |
| `PATCH /api/groups/{id}` | 이름·소개·그림·표지 | OWNER |
| `DELETE /api/groups/{id}` | 지우기 | OWNER |
| `DELETE /api/groups/{id}/members/me` | 나가기 | MEMBER |
| `DELETE /api/groups/{id}/members/{userId}` | 내보내기 | OWNER |
| `PATCH /api/groups/{id}/owner` | 주인 넘기기 | OWNER |

### 3-2. 초대

`TripInvite` 와 **같은 모양**입니다.

| 길 | 하는 일 | 누가 |
|---|---|---|
| `POST /api/groups/{id}/invites` | 링크 만들기 | 멤버 |
| `GET /api/group-invites/{token}/preview` | 어떤 그룹인지 미리보기 | **로그인 없이** |
| `POST /api/group-invites/{token}/accept` | 들어가기 | 로그인 |

> 미리보기가 로그인 없이 열리는 것은 지금 여행 초대와 같습니다. 링크를
> 받은 사람이 **가입하기 전에** 무엇인지 봐야 합니다.

### 3-3. 그룹의 여행

| 길 | 하는 일 |
|---|---|
| `POST /api/groups/{id}/trips` | 이 그룹의 여행 만들기 |
| `PATCH /api/trips/{id}/group` | 이미 있는 여행을 그룹에 넣기·빼기 |

### 3-4. 그룹 글

| 길 | 하는 일 | 누가 |
|---|---|---|
| `GET /api/groups/{id}/posts` | 피드 (최근 순, 페이지) | 멤버 |
| `POST /api/groups/{id}/posts` | 올리기 | 멤버 |
| `PATCH /api/group-posts/{id}` | 고치기 | 글쓴이 |
| `DELETE /api/group-posts/{id}` | 지우기 | 글쓴이 또는 OWNER |
| `GET /api/group-posts/{id}/comments` | 댓글 | 멤버 |
| `POST /api/group-posts/{id}/comments` | 댓글 달기 | 멤버 |

### 3-5. 사진첩 (4단계)

| 길 | 하는 일 |
|---|---|
| `GET /api/groups/{id}/photos` | 사진첩 (여행별로 묶어서) |
| `POST /api/groups/{id}/photos` | 넣기 |
| `DELETE /api/groups/{id}/photos/{photoId}` | 빼기 |

### 3-6. 마이페이지

| 길 | 하는 일 | 누가 |
|---|---|---|
| `GET /api/me/profile` | 내 것 — 여행 수·글·그룹·사진 | 로그인 |
| `GET /api/users/{id}/profile` | 남의 것 — **공개된 것만** | 같은 그룹 멤버 |

> 남의 프로필은 **같은 그룹 사람에게만** 보입니다. 아무나 id 로 열 수 있으면
> 그게 곧 사람 찾기가 됩니다 — [안 하기로 한 것](verdict.md#친구--지금은-안-합니다)
> 을 뒷문으로 여는 셈입니다.

## 4. 소식

`NewsService` 에 종류를 늘립니다.

| 종류 | 문구 | 누구에게 |
|---|---|---|
| `GROUP_JOINED` | 「지영님이 ○○ 모임에 들어왔어요」 | 그 그룹 멤버 |
| `GROUP_POST` | 「지영님이 ○○ 모임에 글을 올렸어요」 | 그 그룹 멤버 |
| `GROUP_TRIP` | 「○○ 모임에 '오사카 3박' 이 생겼어요」 | 그 그룹 멤버 |

> 글 하나에 알림 하나씩 보내면 모임이 활발할수록 시끄럽습니다. 지금
> 소식함처럼 **묶어서** 보여 주고, 푸시는 **여행이 생겼을 때만** 보냅니다.

## 5. 기존 자리에 생기는 변화

| 자리 | 무엇이 바뀌나 |
|---|---|
| `TripAccessPolicy` | 그룹 멤버십까지 봅니다 (2-1) |
| 아래 갈래 띠 | 칸 하나 늡니다 — 「모임」 |
| 내 여행 목록 | 그룹 여행에 그룹 이름표가 붙습니다 |
| 여행 만들기 | 「어느 모임의 여행인가」를 고를 수 있습니다(안 골라도 됨) |
| 내 계정 | 마이페이지로 커집니다 |
| `post_comments` | `kind` 가 붙습니다 (1-8) |
| 운영 화면 | 그룹 글 신고도 봅니다 |

## 6. 안 바뀌는 것

- **여행기(`trip_posts`)와 둘러보기** — 그대로입니다. 그룹과 무관합니다
- **보석함·가계부·챙길 것·후보 투표** — 여행에 딸린 것이라 그대로
- **사진 굽기·EXIF 제거·`PhotoStore`** — 그대로
