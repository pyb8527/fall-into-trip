# 옮긴 가게 — 「문을 닫은 곳이에요」 아래 한 줄로 새 자리를 가리킨다

> `verdict.md` 7번에서 **조건부 찬성**(요금 등급이 안 오를 때만, 푸시 없이)으로 받은
> 것의 실행 계획입니다(2026-10-12).
>
> **지었음 — 2026-10-12.** `plan-constraints.md` 위에 얹었습니다. 백엔드(`FIELDS` 에 `movedPlaceId` ·
> `displayName` · `location` · `formattedAddress`, `Raw` · `Info` 의 `movedTo` · `name` · `lat` · `lng` ·
> `address`, `viewOf` 의 「아주 닫았고 자기가 아닐 때만」), 프런트(`PlaceInfo` 다섯 칸, 일정 줄의 「문을
> 닫은 곳이에요 · 옮긴 자리가 있어요」, 장소 판의 「옮겼어요 · 새 자리 보기 ›」 → 새 자리 판 → 「원래
> 자리로」 · 「여기로 바꾸기」, 일정 화면의 `replaceWith`), 시험(`PlaceInfoReadTest` 6,
> `place.test.mjs` [3-1] 2 — `group-access.test.mjs` 의 둘은 `plan-constraints.md` 가 먼저 더함)까지
> 들어갔습니다. 관문은 §10 — 옮긴 가게가 표본에 없었는데도 지은 까닭을 §10.2 에 적었습니다. 계획과
> 달라진 것은 §11 에 있습니다.
> **남은 것:** 옮긴 가게의 실제 응답을 아직 한 번도 못 봤습니다(§10.2). 그런 가게를 하나 찾아, 구글
> 키가 있는 서버에서 일정 줄 · 「새 자리 보기」 · 「여기로 바꾸기」 를 사람이 한 번 눌러 봐야 합니다.
> 화면의 따라가기와 바꾸기는 타입 검사까지만 봤고 기기에서 돌려 보지 않았습니다.
>
> **조건은 넘었습니다.** 판단 때 「확인 전」 이던 요금 등급을 이 문서를 쓰며 구글
> 문서로 확인했습니다 — `movedPlaceId` 는 가장 싼 등급(Essentials IDs Only)이고, 지금
> 필드마스크는 이미 Enterprise 입니다. 등급이 안 오릅니다(§6.1).
> 남은 관문은 하나입니다 — **구글이 우리 장소들에 이 값을 실제로 주는지** 는 운영 키로
> 한 번 찍어 봐야 압니다(§9). — 2026-10-12 에 찍어 봤습니다(§10).

## 1. 하려는 것

지금은 일정이나 보석함에 넣어 둔 가게가 아주 문을 닫으면 「문을 닫은 곳이에요」 까지만
나옵니다(`frontend/src/app/trip/[id].tsx:4275-4280`, `components/place-detail-sheet.tsx:350-354`).
**그 가게가 망한 것인지 옆 골목으로 옮긴 것인지는 말하지 않습니다.**

사람은 지금 이렇게 우회합니다 — 「구글 지도에서 보기」 를 눌러 앱 밖으로 나가, 구글
지도가 띄우는 「이전함」 표시를 보고, 새 가게 이름을 외워 돌아와 검색해서 다시 넣고,
옛 줄을 지웁니다. 다섯 걸음이고, 그 사이 메모 · 시각 · 비용 칸은 옛 줄에 남습니다.

구글은 2025-10-20 부터 `movedPlaceId` 를 줍니다(survey 7번). 「아주 닫았는데 다른 자리로
옮겼으면 그 자리의 번호」 입니다. 우리는 이미 같은 상세 호출을 하고 있으므로, **호출을
늘리지 않고** 그 번호를 받아 한 줄로 보여 줄 수 있습니다.

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 | 새로 / 고쳐 씀 |
|---|---|---|
| 장소 상세를 구글에 묻기 | `trip/application/PlaceInfoService.java:314-363` `ask()` — 상세 한 번에 할당량 1(`:317`) | 고쳐 씀 (필드 더함) |
| 무엇을 달라고 할지 | `PlaceInfoService.java:137-157` `FIELDS` | 고쳐 씀 |
| 가게 형편 읽기 | `:91-93` 세 값, `:104-117` `opensOn()` — 아는 값만 안다고 말함 | 그대로 |
| 메모리에 1시간 | `:56` `KEEP`, `:178-184` 캐시 1000개 | 그대로 |
| 화면이 받는 모양 | `:532-540` `Info`, `:543-548` `Raw` | 고쳐 씀 (칸 더함) |
| 번호 하나로 상세 보기 | `GET /api/places/{placeId}/info` — `trip/api/PlaceController.java:119-133`, `PlaceInfoService.about()`(`:248-254`) | 그대로 — 새 자리를 볼 때 이 길을 씀 |
| 하루치 영업 정보 | `GET /api/days/{dayId}/places-info` — `trip/api/DayExtrasController.java:66-69`, `ofDay()`(`:209-234`) | 그대로 |
| 장소 판 | `components/place-detail-sheet.tsx:89` `PlaceDetailSheet`, 정보는 `:196-206` 에서 `/info` 로 받음 | 고쳐 씀 |
| 일정 줄 밑 영업 한 줄 | `app/trip/[id].tsx:3635` 에서 `PlaceHours`(`:4274-`) | 고쳐 씀 |
| 일정의 장소를 다른 곳으로 바꾸기 | `PATCH /api/places/{id}` — `PlaceController.java:85-90`, `PlaceService.java:103-120` 이 이름 · 좌표 · 구글 번호를 받음 | 그대로 — 사람이 누르는 「여기로 바꾸기」 가 이 길 |
| 바꾼 뒤 다시 읽기 | `frontend/src/api/invalidate.ts` — `PATCH /api/places/…` 가 성공하면 `trip` · `trips` 를 알림. 일정이 다시 읽히면 `daySeq`(`app/trip/[id].tsx:825-833`)가 바뀌어 영업 정보 · 이동 시간도 다시 물음 | 그대로 |

## 3. 버리는 것

### 3.1 옮김을 푸시로 알리기 — 버립니다

알리려면 사람이 안 보는 동안 서버가 저장된 장소(보석함 300 × 사람 수, 일정 전부)를 돌며
구글에 물어야 합니다. 아무도 안 볼 때 나가는 호출이고, 「부름 단위로 셉니다」 의 문턱은
사람이 누른 요청에만 걸립니다(`GoogleQuota.java:96-100` — 요청 밖이면 안 셈). 열었을 때
보이면 됩니다(verdict 7번).

### 3.2 저절로 새 자리로 바꾸기 — 버립니다

「사람이 수락해야 바뀝니다」(`trip/domain/RouteTidy.java`). 판에서 새 자리를 보여 주고,
바꾸는 것은 사람이 「여기로 바꾸기」 를 누를 때만입니다.

### 3.3 `movedPlace`(자원 이름) — 버립니다

`movedPlace` 는 `places/…` 모양, `movedPlaceId` 는 번호입니다. 같은 것을 두 번 받을 이유가
없습니다. 우리 장소는 번호(`Place.placeId`)로 들고 있으므로 번호 쪽만 받습니다.

### 3.4 옮긴 것을 줄줄이 따라가기 — 버립니다

새 자리도 또 옮겼을 수 있습니다. 서버가 끝까지 따라가면 한 번 보는 데 상세 호출이 몇 번
나갈지 모릅니다. **한 칸만** 가리킵니다. 새 자리 판을 열면 그 판이 다시 자기 상세를 묻고,
거기도 옮겼으면 거기서 또 한 줄이 뜹니다 — 사람이 한 칸씩 누르는 만큼만 나갑니다.

### 3.5 보석함 줄을 새 자리로 바꾸기 — 이번에는 안 합니다

`PATCH /api/saved/{id}` 는 지금 그림 · 메모만 고칩니다(`SavedPlaceService.java:121` `edit(me, savedId, icon, note)`). 좌표 · 구글 번호를 바꾸게
하려면 보석함의 「같은 구글 번호는 하나로」(`SavedPlaceService.java:81-86`)를 다시 따져야
합니다. 보석함에서는 새 자리 판을 보여 주고, 사람이 그 판의 책갈피로 새로 담습니다.

### 3.6 일정 줄에서 바로 「새 자리 보기」 단추 — 버립니다

일정 줄은 이미 누르면 장소 판이 열립니다(`app/trip/[id].tsx:1929` `onLook`). 줄 안에 단추를
하나 더 세우면 한 줄에 누를 곳이 둘이 됩니다. 줄에는 글자 한 줄만, 단추는 판에만 둡니다.

## 4. 갈 곳

```
[일정을 펼친다] ── GET /api/days/{dayId}/places-info ──▶ PlaceInfoService.ofDay
                                                          │ 상세 1회(캐시 1시간), FIELDS 에 movedPlaceId
                                                          ▼
                                     Info { permanentlyClosed: true, movedTo: "ChIJ…새" }
      │
      ▼
 일정 줄:  「문을 닫은 곳이에요 · 옮긴 자리가 있어요」        (글자만)
      │ 줄을 누름 (이미 있는 길)
      ▼
 장소 판: 「문을 닫은 곳이에요.」
          「옮겼어요 · 새 자리 보기 ›」  ── 누름 ──▶ GET /api/places/{movedTo}/info
                                                    │ 상세 1회(캐시 1시간) — 사람이 누를 때만
                                                    ▼
          판이 새 자리로 바뀜 (이름 · 주소 · 영업시간 · 별점 · 사진)
          「‹ 원래 자리로」   「일정의 장소를 여기로 바꾸기」(고칠 수 있는 사람에게만)
                                       │
                                       ▼
                         PATCH /api/places/{id} {name, lat, lng, placeId, version}
                                       │ invalidate: trip, trips (이미 있음)
                                       ▼
                         일정이 다시 읽히고, daySeq 가 바뀌어 영업 · 이동 시간도 다시 물음
```

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `backend/src/main/java/net/weeniebeenie/fit/trip/application/PlaceInfoService.java` | `FIELDS`(`:137-157`)에 `movedPlaceId` · `displayName` · `location` · `formattedAddress` 넷을 더합니다(§6.1). `ask()` 의 응답 읽기(`:346-362`)를 `static Raw rawOf(JsonNode)` 로 떼어 냅니다 — 단위 시험이 고정 JSON 을 먹일 자리입니다. `Raw` · `Info` 에 `movedTo` · `name` · `lat` · `lng` · `address` 를 더합니다. `viewOf()`(`:272-300`)는 **`CLOSED_PERMANENTLY` 이고 번호가 자기와 다를 때만** `movedTo` 를 채웁니다 |
| `backend/src/test/java/net/weeniebeenie/fit/trip/application/PlaceInfoReadTest.java` | 새로 만듭니다(§7) |
| `frontend/src/api/types.ts` | `PlaceInfo`(`:593-`)에 `movedTo` · `name` · `lat` · `lng` · `address` (모두 `Maybe`) |
| `frontend/src/app/trip/[id].tsx` | `PlaceHours`(`:4274-4281`)의 「문을 닫은 곳이에요」 뒤에 `info.movedTo` 가 있으면 「 · 옮긴 자리가 있어요」. `PlaceDetailSheet`(`:2030-2080`)에 `replaceWith` 를 넘김 — 고칠 수 있는 사람일 때만, `PATCH /api/places/{looking.place.id}` |
| `frontend/src/components/place-detail-sheet.tsx` | 닫힘 한 줄(`:349-354`) 아래 「옮겼어요 · 새 자리 보기」. 판 안에 `following` 상태 하나 — 누르면 `/api/places/{movedTo}/info` 를 받아 그 응답의 이름 · 좌표 · 주소로 `Looked`(`:601-608`)를 만들어 보여 줍니다. 따라간 동안에는 부르는 쪽이 준 `talk` · `ours` · `scrap` · `actions` 를 숨깁니다(원래 자리에 대한 것이라서). 새 prop `replaceWith?: (to: Looked) => Promise<void>` |

다른 화면(`saved.tsx`, `search.tsx`, `popular.tsx` 등)은 판을 그대로 쓰므로 「새 자리 보기」
까지는 저절로 따라옵니다. `replaceWith` 를 안 넘기므로 「바꾸기」 단추는 안 뜹니다.

## 6. API

새 엔드포인트가 없습니다. 있는 두 길의 응답에 칸이 늡니다.

| | `GET /api/days/{dayId}/places-info` | `GET /api/places/{placeId}/info?on=` |
|---|---|---|
| 권한 | `TripAccessPolicy.requireCanRead`(`PlaceInfoService.java:212`) — 남의 날짜 · 없는 날짜 모두 **404** | 로그인만(`/api/**`). 구글에 공개된 가게 정보이고 어느 여행에도 안 매임(`:242-244`) |
| 요청 | 그대로 | 그대로 |
| 응답에 더해지는 칸 | `info[].movedTo` · `name` · `lat` · `lng` · `address` | `info.movedTo` · `name` · `lat` · `lng` · `address` |
| 실패 | 401(로그인 없음), 404(없는 · 남의 날짜), 429(문턱) — 그대로 | 401, 429. 구글이 모르는 번호 · 키 없음은 오류가 아니라 `info: null`(`PlaceController.java:128-131`) — 그대로 |

`movedTo` 는 **값이 있을 때만** 채웁니다. 아주 닫지 않았거나, 구글이 안 줬거나, 자기 번호를
가리키면 `null` 입니다. 「아는 것만 말합니다」.

`PATCH /api/places/{id}` 는 손대지 않습니다. 권한(`requireCanEdit` → 404)과 버전 확인이 이미
있습니다.

### 6.1 구글 호출

| | |
|---|---|
| `touchesGoogle` | 변화 없음 — `/places-info` · `/info` 둘 다 이미 들어 있음(`GoogleQuotaFilter.java:61, :64`) |
| 하루를 펼칠 때 | **0 증가.** 같은 상세 호출에 필드만 늘어남. `ask()` 의 `quota.spend(…, 1)`(`:317`) 그대로 |
| 새 자리를 볼 때 | 사람이 「새 자리 보기」 를 누를 때만 상세 1. `about()` → `lookup()` → `ask()` 로 같은 자리에서 셈. 캐시 1시간 |
| 요금 등급 | **안 오름.** 아래 표 |
| 캐시 | 그대로 — 메모리 1시간, 1000개(`:56`, `:74`). 디스크에 안 남김 |

구글 Place Details (New) 의 필드별 등급입니다(<https://developers.google.com/maps/documentation/places/web-service/place-details>, 2026-10-12 확인). 한 요청은 달라고 한 필드 중 **가장 높은 등급** 으로 셉니다.

| 필드 | 등급 | |
|---|---|---|
| `regularOpeningHours` · `nationalPhoneNumber` · `websiteUri` · `rating` · `userRatingCount` | Enterprise | 지금 있음 — 이 요청은 이미 Enterprise |
| `businessStatus` · `utcOffsetMinutes` · `googleMapsUri` | Pro | 지금 있음 |
| `photos` | Essentials IDs Only | 지금 있음 |
| **`movedPlaceId`** | **Essentials IDs Only** | 더함 |
| **`displayName`** | **Pro** | 더함 — 새 자리 판의 이름 |
| **`location`** · **`formattedAddress`** | **Essentials** | 더함 — 새 자리 판의 지도 · 주소, 「여기로 바꾸기」 의 좌표 |

verdict 는 「필드 둘」(`movedPlace` · `movedPlaceId`)이라고 적었습니다. 하나(`movedPlace`)는
버리고(§3.3) 셋을 더 받습니다. 새 자리는 우리 DB 에 없는 곳이라, **번호만으로는 판을 그릴
이름과 좌표가 없기 때문**입니다. 셋 다 Enterprise 아래라 값은 그대로입니다.

### 6.2 스키마

없습니다. 새 자리 번호는 저장하지 않습니다 — 사람이 「여기로 바꾸기」 를 누르면 그때 이미
있는 `places.place_id` 칸이 바뀝니다. 마이그레이션 번호를 쓰지 않습니다.

### 6.3 다시 읽기 열쇠

새로 다는 열쇠가 없습니다. `/info` · `/places-info` 는 구글에 묻는 길이라 일부러 열쇠 밖에
있습니다(`invalidate.ts:61-63`). 「여기로 바꾸기」 는 `PATCH /api/places/…` 라 이미
`trip` · `trips` 를 알립니다.

## 7. 테스트

구글 키가 없는 확인용 서버에서는 `info` 가 늘 비어 옵니다. 그래서 **읽기는 단위 시험이,
권한은 HTTP 시험이** 봅니다.

**`PlaceInfoReadTest.java`(새로) — 6**

| 무엇을 | |
|---|---|
| 닫힘 + 다른 번호 → `movedTo` 가 그 번호 | 고정 JSON |
| 닫힘 + `movedPlaceId` 없음 → `null` | 망한 가게 |
| 영업 중 + `movedPlaceId` 있음 → `null` | 구글이 잘못 줘도 안 띄움 |
| 닫힘 + 자기 번호 → `null` | 제자리를 가리키는 고리 |
| `displayName.text` · `location` · `formattedAddress` 를 읽음 | 새 자리 판의 재료 |
| 새 필드가 하나도 없는 옛 모양 응답도 그대로 읽힘 | 지금 동작이 안 깨지는가 |

**`backend/src/test/http/place.test.mjs` — 2**

- `/api/places/{아무 번호}/info` 의 응답이 키가 없을 때 `info: null` 로 200 (500 이 아님)
- 로그인 없이는 401

**`backend/src/test/http/group-access.test.mjs` — 2** (「동행자만 부를 수 있는가」)

- 같은 모임 동행이 `GET /api/days/{dayId}/places-info` → 404 가 아님(키 없으면 200 + 빈 목록)
- 모임 밖 사람이 같은 주소 → **404** (403 이 아님)

`quota.test.mjs` 는 손대지 않습니다 — 경로가 늘지 않았습니다.

## 8. 순서와 의존

1. **응답을 한 번 찍어 봅니다**(관문, §9). 운영 키로 닫힌 가게 몇 곳의 상세를 `movedPlaceId`
   를 넣어 물어봅니다. `docs/2026-09/plan-places-fields.md` §8 의 재 보기와 같은 절차입니다.
   한 곳도 안 나오면 여기서 멈추고 verdict 에 적습니다.
2. 백엔드 — `rawOf` 를 떼어 내고 단위 시험부터, 그다음 `FIELDS` · `Raw` · `Info`.
   `./gradlew build`.
3. 프런트 — `types.ts`, 장소 판의 따라가기, 일정 줄 한 줄, `replaceWith`. `npm run typecheck`.
4. HTTP 시험 넷.

**`plan-constraints.md` 와 같은 상수를 고칩니다**(`FIELDS`, `Info`). 둘 중 먼저 들어가는 쪽이
`rawOf` 를 떼어 내고, 뒤의 것은 그 위에 한 칸씩 더합니다. 같은 날 둘 다 열어 두지 않습니다.

## 9. 아직 모르는 것

- **구글이 우리 장소들에 `movedPlaceId` 를 얼마나 주는지.** 2025-10 GA 라는 것만 압니다.
  2026-10-12 에 15곳을 찍어 봤지만 옮긴 가게가 그 안에 없었습니다(§10.1). 구글이 이 필드를
  **받아 준다** 는 것까지는 압니다. 일본 · 한국에서 「이전」 이 얼마나 잡히는지는 여전히
  모릅니다 — 옮긴 가게를 하나 찾아 그 응답을 봐야 압니다.
- **옛 자리가 `CLOSED_PERMANENTLY` 가 아닌데 `movedPlaceId` 가 오는 일이 있는지.** 구글
  문서는 「아주 닫았고 옮겼으면」 이라고 적었습니다. 그 밖의 경우는 띄우지 않기로 했습니다
  (§5) — 실제로 오는지는 모릅니다.
- **`displayName` 을 받으면 일정 줄 이름과 어긋나 보일지.** 사람이 일정에 적은 이름(「할머니
  국숫집」)과 구글 이름이 다를 수 있습니다. 새 자리 판에서만 구글 이름을 쓰고, 「여기로
  바꾸기」 를 눌러도 **사람이 적은 이름을 남길지 구글 이름으로 바꿀지** 는 화면을 그려 봐야
  정합니다. 지금 계획은 구글 이름으로 바꿉니다 — 옛 이름이 남으면 옮기기 전 가게를 가리킵니다.

## 10. 관문 결과

### 10.1 응답을 찍어 본 것

2026-10-12, 주인이 운영 서버에서 Place Details (New) 를 필드마스크
`displayName,businessStatus,movedPlaceId,accessibilityOptions` 로 우리가 넣어 둔 장소 15곳(일본
· 한국 · 발리)에 물었습니다.

| | |
|---|---|
| 응답 | 15곳 모두 정상 — 구글이 `movedPlaceId` 를 필드마스크에 받아 줍니다(거절 없음) |
| `movedPlaceId` 가 온 곳 | **0 / 15** |
| `CLOSED_PERMANENTLY` | 1곳 — 카츠미도리 회전초밥 시부야점. `movedPlaceId` 없이 왔습니다 |

### 10.2 §8 의 1 「한 곳도 안 나오면 멈춤」 을 어떻게 읽었나

글자 그대로면 멈출 자리입니다. 그래도 지었습니다 — 주인이 결과를 보고 짓기로 했고, 까닭은
이렇습니다.

- 찍어 본 15곳에 **옮긴 가게가 처음부터 없었습니다.** 아주 닫은 곳이 한 곳이고 그곳은 옮긴 것이
  아니라 닫은 것입니다. 「구글이 이 값을 안 준다」 가 아니라 「물어본 곳 중에 옮긴 곳이 없었다」
  입니다. 멈춤 줄이 막으려던 것은 앞쪽입니다.
- **값을 치르지 않습니다.** 필드가 받아들여졌으니 오류가 날 일이 없고, 등급도 안 오르고(§6.1),
  값이 안 오면 `movedTo` 가 `null` 이라 화면은 지금과 똑같습니다. 틀려도 잃는 것이 없습니다.
- 그 한 곳(카츠미도리)은 단위 시험 「닫힘 + `movedPlaceId` 없음 → `null`」 의 모양이 됐습니다.

**남은 것:** 실제로 옮긴 가게 하나의 응답을 아직 못 봤습니다. 「옮겼어요 · 새 자리 보기」 가 운영에서
한 번이라도 뜨는지는 그런 가게를 찾아야 압니다.

## 11. 계획과 달라진 것

| 계획 | 실제 | 왜 |
|---|---|---|
| §5 — `viewOf()` 가 「번호가 자기와 다를 때만」 | `viewOf(placeId, googleId, raw, on)` 로 구글 번호를 따로 받음 | 하루치(`ofDay`)는 화면에 **우리 장소 id** 를 돌려주므로, 첫 인자로는 자기 구글 번호와 견줄 수 없습니다 |
| §4 — 「일정의 장소를 여기로 바꾸기」 | 「여기로 바꾸기」 | §3.2 의 이름 그대로. 판이 이미 「옮긴 자리예요」 라고 말하고 있어 짧게 둡니다 |
| §4 — `PATCH {name, lat, lng, placeId, version}` | `ja: ''` · `en: ''` 를 함께 보냄 | 장소 고치기 판(`place-form.tsx`)이 다른 곳으로 바꿀 때 원어 이름을 지우는 것과 같게 — 옛 가게의 원어 이름이 새 자리에 남지 않게 |
| §5 — 따라간 동안 `talk` · `ours` · `scrap` · `actions` 를 숨김 | `about` 도 숨김 | 보석함의 「왜 담았는지」 도 원래 자리에 대한 말입니다 |
| §5 — 판 안의 `following` 상태 하나 | `{ from, to }` — 출발한 판의 구글 번호를 함께 들고 있음 | 판이 다른 곳으로 바뀌었는데 따라간 상태가 남으면 남의 새 자리가 뜹니다. 닫을 때도 지웁니다 |
| §8 의 1 — 한 곳도 안 나오면 멈춤 | 지음 | §10.2 |
