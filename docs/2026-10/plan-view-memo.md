# 보기 링크에 「장소 메모도 보이기」 하나 — 칸별 공개 범위 대신

> `verdict.md` 12번에서 **재설계 권장 · 3차**로 받은 것의 실행 계획입니다.
>
> **2026-10-12 지었음.** §5 의 여섯 파일 전부 §8 순서대로 고쳤습니다 —
> `V61__view_link_notes.sql`, `Trip.viewNotes`, `ViewLinkService.notes()`·
> `show()`, `ViewLinkController` 의 `PATCH`, `view-link-sheet.tsx` 의
> 스위치와 안내 문구. §3~§4, §6 의 API 모양은 적힌 대로입니다.
>
> **벗어난 것 하나 — §7 테스트 7·8번.** `application.yml:25` 의
> `default-property-inclusion: non_null` 때문에 가려진 메모는 JSON
> `null` 이 아니라 **키 자체가 빠집니다**. 그래서 8번의 비교 대상을
> "켜졌을 때의 같은 장소" 에서 "같은 응답 안의, 원래부터 메모가 없던
> 장소" 로 바꿨습니다 — 바뀐 까닭과 새 비교는 §7 표 아래에 적었습니다.
> 지키려던 것("가려졌는지 응답 모양으로 안 드러남")은 그대로 지켜집니다.
>
> **남은 것** — §9 "아직 모르는 것" 셋은 그대로입니다(새 링크 처음 값 ·
> 안내판과의 경계 · 누가 껐는지). 손으로 기기에서 열어 보지는 못했고,
> `backend/src/test/http/view.test.mjs` 만 로컬 스크래치 DB 로 돌렸습니다
> (22 통과 / 0 실패). 커밋은 하지 않았습니다.
>
> 서버 작업이 있고 스키마가 하나 바뀝니다 — `V61__view_link_notes.sql`. 이 폴더의 다른
> 계획(`plan-spend-by-kind.md` · `plan-paste-places.md` · `plan-share-in.md` ·
> `plan-moved-place.md` · `plan-stay-legs.md`)은 마이그레이션을 쓰지 않으므로 V61 은 이
> 계획 것입니다. 이 계획보다 먼저 들어가는 것이 마이그레이션을 쓰게 되면 번호를 다시
> 맞춥니다.

## 1. 하려는 것

로그인 없이 보는 일정 링크는 이미 **일정만** 냅니다(`trip/application/ViewLinkService.java:18-36`).
가계부 · 위치 · 안내판 · 사람 이름 · 숙소 · 항공편은 안 나갑니다. 그런데 **장소 메모는
나갑니다** — `show()` 가 장소 줄을 옮길 때 `p.getNote()` 를 그대로 싣습니다(`:89`).

장소 메모에는 이런 것이 적힙니다.

```
닭강정 · 2층 창가 자리 예약해 둠 (예약번호 48213, 박○○ 이름으로)
에어비앤비 — 현관 비번 0715*
```

숙소 주인이나 집에 있는 가족에게 링크를 보내려는 사람은 지금 이렇게 우회합니다.

| 우회 | 무엇이 불편한가 |
|---|---|
| 보내기 전에 메모를 지웠다가 돌아와서 다시 적음 | 동행 모두의 일정에서 지워집니다. 다시 적는 것을 잊습니다 |
| 링크 대신 캡처 · 인쇄를 보냄 | 일정이 바뀌어도 따라가지 않습니다. 링크를 만든 이유가 사라집니다 |
| 안 보냄 | — |

보기 링크 판도 지금 「날짜 · 장소 · 시각 · **메모**를 볼 수 있어요」 라고 적어
(`components/view-link-sheet.tsx:87-90`) 메모가 나간다는 것은 알려 주지만, 끌 길이 없습니다.

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 |
|---|---|
| 링크 상태 · 만들기 · 끊기 | `trip/api/ViewLinkController.java:26-40` — `GET` · `POST` · `DELETE /api/trips/{id}/view-link` |
| 링크로 보기 | `ViewLinkController.java:43-48` `GET /api/view/{token}` — `Cache-Control: no-store` |
| 장소를 옮겨 싣는 자리 | `ViewLinkService.java:86-92` — 여기 한 곳만 고치면 됩니다 |
| 권한 | `ViewLinkService.java:56-57`, `:66-67` — `access.mine` + `requireCanEdit`. 남의 여행이면 404(`trip/domain/TripAccessPolicy.java:78-84`) |
| 모르는 · 끊긴 · 지난 링크가 똑같이 404 | `ViewLinkService.java:34-35`, `:75-84` |
| 여행 줄에 붙은 링크 칸 | `trip/domain/Trip.java:80-87` `viewTokenHash`, `V47__trip_view_link.sql` |
| 감사 기록 | `ViewLinkService.java:60`, `:69` `audit.log(…, "trip.view.issue" \| "trip.view.revoke", …)` |
| 링크 판 | `components/view-link-sheet.tsx:43-142` `Inner` |
| 링크로 보는 화면 | `app/view/[token].tsx:97-99` — `p.note` 가 있을 때만 줄을 그림. 비면 아무것도 안 그림 |
| 켜고 끄는 부품 | `ui/index.tsx:1679` `Switch({ label, hint, value, onChange })` |
| 무효화 | `api/invalidate.ts:338-341` — `view-link` 쓰기는 일부러 아무 열쇠도 안 알림(「공유 주소 판이 스스로 다시 읽습니다」). 읽기도 열쇠가 없음(`:239`, `TRIP_READS` 에 없음) |
| HTTP 테스트 | `backend/src/test/http/view.test.mjs` — 지금 확인 13 |

## 3. 버리는 것

### 3.1 칸마다 「나만 · 동행 · 바깥」 — 버립니다

조사가 바란 모양입니다(`survey.md` 12번). 모든 칸에 공개 범위가 붙으면 일정 화면 ·
인쇄 · 엑셀(`lib/sheet.ts`) · 여행기 복사 · 보기 링크가 전부 세 겹을 알아야 합니다.
링크로 나가는 칸 중 가릴 만한 것이 **장소 메모 하나**입니다(`verdict.md` 12번 표).

### 3.2 장소마다 「이 메모는 가리기」 — 버립니다

메모 하나하나에 표시를 달면 결국 3.1 의 한 갈래입니다. 장소 표에 칸이 붙고, 장소를
고치는 판 · 복제 · 여행기 올리기가 그 칸을 옮길지 정해야 합니다. 링크 하나에 스위치
하나로 둡니다.

### 3.3 시각 · 장소 이름 가리기 — 버립니다

일정 링크에서 그것을 빼면 보낼 것이 없습니다.

### 3.4 링크를 새로 만들 때만 고를 수 있게 — 버립니다

`verdict.md` 12번은 「링크를 만들 때」 라고 적었습니다. 그런데 링크는 만들 때 한 번만
보이고, 다시 만들면 옛 링크가 죽습니다(`view-link-sheet.tsx:20-23`). 이미 보낸 링크의
메모를 가리려고 링크를 갈아야 하면, 받은 사람에게 새 주소를 다시 보내야 합니다.
그래서 **스위치는 링크와 따로 바뀌고, 지금 살아 있는 링크에 바로 듣습니다.** 판에서는
「링크 만들기」 단추 위에 놓아, 만들기 전에 고를 수 있게도 둡니다.

## 4. 갈 곳

```
[사람]  여행 → 일정 링크 보내기 판
          |
          v
  GET /api/trips/{id}/view-link  → { on, until, notes }
          |
          v
  판:  「장소 메모도 보이기」 스위치 (notes)
       안내 문구가 notes 를 따라 바뀜
         켜짐: 날짜·장소·시각·메모를 볼 수 있어요 …
         꺼짐: 날짜·장소·시각을 볼 수 있어요. 장소 메모는 안 보여요 …
       [링크 만들기]
          |
          | 스위치를 바꾸면 그 자리에서
          v
  PATCH /api/trips/{id}/view-link  { notes: false }
          |   access.mine → requireCanEdit (남의 여행이면 404)
          |   trip.viewNotes = false · audit "trip.view.notes"
          |   링크(viewTokenHash)는 그대로 — 안 죽습니다
          v
  { on, until, notes }  → 판이 다시 그림

  ─────────────────────────────────────────────

[받은 사람]  /view/{열쇠}
          |
          v
  GET /api/view/{token}   (no-store — 바꾼 것이 다음 열기부터 바로 보임)
          |
          v
  show():  trip.viewNotes ? p.getNote() : null
          |   가린 메모는 메모 없는 장소와 똑같이 null. 응답 모양이 안 바뀝니다
          v
  view/[token].tsx  — 지금 그대로. note 가 비면 줄을 안 그립니다
```

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `backend/src/main/resources/db/migration/V61__view_link_notes.sql` | **새로.** `ALTER TABLE trips ADD COLUMN view_notes BOOLEAN NOT NULL DEFAULT TRUE;` 머리 주석에 왜 하나인지(§3), 왜 기본이 켜짐인지(§6 스키마) |
| `backend/src/main/java/net/weeniebeenie/fit/trip/domain/Trip.java` | `:80-87` 아래에 `@Column(name = "view_notes", nullable = false) private boolean viewNotes = true;` |
| `backend/src/main/java/net/weeniebeenie/fit/trip/application/ViewLinkService.java` | ① `State` 에 `notes` ② `notes(me, tripId, boolean)` — `issue`(`:54-62`)와 같은 권한 두 줄, 감사 기록 ③ `show()` `:89` 에서 `trip.isViewNotes() ? p.getNote() : null` ④ 머리말(`:21-27`) 「메모」 줄 고침 |
| `backend/src/main/java/net/weeniebeenie/fit/trip/api/ViewLinkController.java` | `@PatchMapping("/trips/{id}/view-link")` + `record NotesRequest(Boolean notes)` |
| `frontend/src/components/view-link-sheet.tsx` | 상태 모양에 `notes`, `Switch` 하나, 안내 문구(`:87-90`)를 `notes` 에 따라 |
| `backend/src/test/http/view.test.mjs` | §7 |

**안 고치는 것** — `app/view/[token].tsx`(이미 빈 메모를 안 그림), `api/invalidate.ts`
(§6 무효화), `TripAccessPolicy`, 인쇄 · 엑셀 · 여행기.

## 6. API

### 새로 — 메모 스위치

| | |
|---|---|
| 메서드 · 경로 | `PATCH /api/trips/{id}/view-link` |
| 권한 | `TripAccessPolicy.mine` + `requireCanEdit` — 이 여행의 사람(주인 · 모임 사람)만. **없는 여행 · 남의 여행은 404**(`TripAccessPolicy.java:78-84`). 403 을 쓰지 않습니다 |
| 요청 | `{ "notes": true \| false }` |
| 응답 | `{ "on": boolean, "until": "YYYY-MM-DD" \| null, "notes": boolean }` — `GET` 과 같은 모양 |
| 실패 | 400 `notes` 가 없거나 참거짓이 아님 · 401 로그인 안 함 · 404 없는 · 남의 여행 · 409 아님(아래) |
| 링크가 없을 때 | 받습니다. 값만 바뀌고 다음에 만드는 링크가 그 값을 씁니다 — 만들기 전에 고르게 하려는 것이라(§3.4) |

**버전 충돌** — `Trip` 에 `@Version` 이 있습니다(`Trip.java:92-94`). 스위치를 바꾸면
여행 판 번호가 올라가, 그 사이 여행 이름을 고치던 동행은 「다른 사람이 먼저 고쳤어요」
를 볼 수 있습니다. 링크 만들기 · 끊기(`issue` · `revoke`)가 이미 같은 일을 하고 있어
새로 생기는 문제가 아닙니다. 판이 `version` 을 따로 받지 않습니다 — 켜고 끄는 값이라
마지막 누른 것이 맞습니다.

### 바뀌는 것

| | |
|---|---|
| `GET /api/trips/{id}/view-link` | 응답에 `notes` 가 더해짐 |
| `POST /api/trips/{id}/view-link` | 그대로. `notes` 를 안 받습니다 — 판이 스위치를 먼저 `PATCH` 합니다 |
| `GET /api/view/{token}` | 모양 그대로. `notes` 가 꺼져 있으면 장소의 `note` 가 전부 `null`. **꺼져 있다는 표시를 응답에 안 싣습니다** — 받은 사람에게 「가린 것이 있다」 를 알리지 않고, 링크의 다른 404 들처럼 모양으로 드러나는 것이 없게 합니다(`verdict.md` 12번 「지켜야 할 것」) |

### 무효화

`keysOfWrite` 의 `trips` 갈래에서 `view-link` 는 기본 줄로 떨어져 `[]` 입니다
(`api/invalidate.ts:338-341`). `PATCH` 도 같은 주소라 같은 줄을 탑니다. 판은 응답으로
스스로 다시 그립니다. **`keysOfWrite` · `keysOfRead` 에 더할 것이 없습니다.** 다른
화면 중 이 값을 읽는 곳이 없습니다.

### 구글 호출

0 입니다. `touchesGoogle` 그대로입니다.

### 스키마

`V61__view_link_notes.sql` — 지금 마지막이 `V60__consent.sql` 입니다.

```sql
ALTER TABLE trips ADD COLUMN view_notes BOOLEAN NOT NULL DEFAULT TRUE;
```

- **기본은 켜짐**입니다. 이미 보낸 링크가 받은 사람 손에서 어느 날 갑자기 달라지지
  않게 합니다. 새로 만드는 링크의 기본을 끔으로 둘지는 §9 에 남깁니다 — 그 값은
  컬럼 기본이 아니라 판에서 정할 수 있습니다.
- **되돌리기** — `ALTER TABLE trips DROP COLUMN view_notes;` 한 줄입니다. Flyway 는
  되돌리는 파일을 두지 않으므로, 되돌린다면 다음 번호로 이 한 줄을 냅니다. 지우면
  모든 링크가 지금처럼 메모를 냅니다(잃는 것은 스위치 값뿐).

## 7. 테스트

`backend/src/test/http/view.test.mjs` 에 **[6] 장소 메모 가리기** 를 더합니다 — **확인
아홉**. 지금의 13 이 22 가 됩니다. 이미 위에서 「닭강정」 메모를 단 장소를 만들어
두었습니다(`view.test.mjs:35`).

| # | 확인 | 무엇을 보나 |
|---|---|---|
| 1 | 새 링크의 상태에 `notes: true` | 기본값 · 기존 링크가 안 바뀜 |
| 2 | 켜진 채로 보면 메모 「닭강정」 이 보임 | 지금 동작 그대로 |
| 3 | **남(X)이 `PATCH` 하면 404** | 동행자만 부를 수 있는가 |
| 4 | **없는 여행 번호로 `PATCH` 하면 404** — 3 과 응답이 같음 | 403 이 아니라 404, 있는지 없는지 안 드러남 |
| 5 | **모임 사람(B)이 `PATCH {notes:false}`** → 200, `notes: false` | 동행자는 부를 수 있는가(주인만이 아님) |
| 6 | 같은 열쇠로 보면 200 — 링크가 안 죽음 | §3.4 |
| 7 | 메모가 가려짐(`null`), 이름 · 시각은 그대로 | 가린 것만 가림 |
| 8 | 가려진 장소의 키 모음이 **원래 메모가 없던 장소**와 같음 | 응답 모양으로 안 드러남 |
| 9 | `notes` 없이 `PATCH` → 400 | 요청 검증 |

**지었을 때 바뀜 — §8 비교 대상.** `application.yml:25` 의
`default-property-inclusion: non_null` 때문에 `note` 가 `null` 이면 그
칸은 JSON `null` 이 아니라 **키 자체가 안 실립니다**(`undefined`). 그래서
8번을 "켜졌을 때의 같은 장소"와 비교하면 켜졌을 때는 `note` 키가 있고
꺼지면 없어서 오히려 달라집니다 — 비교 대상을 **같은 응답 안의, 원래부터
메모가 없던 다른 장소**로 바꿨습니다. 둘의 키 모음이 같아야 "메모가
가려진 장소"와 "메모가 없던 장소"가 응답으로 구별되지 않는다는 뜻이고,
이것이 §6 이 지키려던 것입니다. 이 비교를 위해 `view.test.mjs` [6] 에
메모 없는 장소("스타벅스")를 하나 더 만듭니다.

다시 켜서 「닭강정」 이 돌아오는 것은 2 와 같은 확인이라 세지 않고 [6] 끝에서 한 번 더
부르기만 합니다(뒤의 테스트가 메모를 기대할 경우를 위해).

**돌리는 법** — `docker compose up -d --build` 뒤 `node backend/src/test/http/view.test.mjs`.
`./gradlew build` 로 마이그레이션이 붙는지 먼저 봅니다.

## 8. 순서와 의존

다른 계획에 기대지 않습니다. `verdict.md` 순서로는 3차의 셋째입니다.

1. **기본값을 정합니다** — §9 첫 줄. 컬럼 기본(켜짐)은 정했고, 판에서 새 링크의 처음
   값을 무엇으로 보일지만 남았습니다.
2. `V61` 과 `Trip.viewNotes`.
3. `ViewLinkService` — `show()` 한 줄을 먼저 고치고 테스트 7 · 8 이 서는지 봅니다.
   그다음 `notes()` 와 `State`.
4. `ViewLinkController` 의 `PATCH`.
5. `view.test.mjs` [6].
6. `view-link-sheet.tsx` — 스위치와 문구.

백엔드(2~5)를 끝내고 프런트(6)로 갑니다. 옛 웹이 새 서버를 만나도 `notes` 칸을 모를
뿐 고장 나지 않습니다.

## 9. 아직 모르는 것

- **새 링크를 만들 때 스위치의 처음 값.** 켜 두면 지금과 같고, 꺼 두면 메모에 숙소 ·
  비번을 적는 사람이 실수로 내보낼 일이 줄어듭니다. 대신 「집합 장소는 3번 출구」 처럼
  받는 사람에게 필요한 메모도 빠집니다. 메모에 무엇을 적는 사람이 많은지 모릅니다
  (`verdict.md` 「아직 모르는 것」).
- **여행 안내판과의 경계.** 안내판은 링크로 안 나가는데(`ViewLinkService.java:25-26`)
  사람들이 비번 같은 것을 메모에 적는 까닭이 「장소 옆에 있어야 해서」 라면, 스위치보다
  장소 판에서 「비번은 안내판에」 를 권하는 쪽이 나을 수 있습니다. 써 보고 봅니다.
- **스위치를 동행 누구나 바꿀 수 있는 것이 맞는지.** 링크 만들기 · 끊기가 이미 동행
  누구나입니다(`view.test.mjs:42-44` 「모임 사람이 만듦」). 같은 규칙으로 두었지만,
  누가 껐는지 판에 안 보이므로 「왜 메모가 안 보이지」 가 동행 사이에 생길 수 있습니다.
  감사 기록에는 남습니다.
