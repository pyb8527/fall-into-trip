# 사람마다의 제약 — 사람 쪽은 안내판에 두고, 장소 판에 휠체어 입구 한 줄

> `verdict.md` 13번에서 **재설계 권장**(사람 쪽은 안내판으로, 장소 쪽은 휠체어 입구 한
> 줄만)으로 받은 것의 실행 계획입니다(2026-10-12).
>
> **지었음 — 2026-10-12.** 관문(§10.1, 15곳 중 10곳에 값이 옴)을 넘고 §5 의 네 파일을 고쳤습니다 —
> 백엔드(`FIELDS` 에 `accessibilityOptions.wheelchairAccessibleEntrance`, `Raw` · `Info` 의
> `wheelchairEntrance`, 응답 읽기를 `rawOf` 로 떼어 냄), 프런트(`PlaceInfo.wheelchairEntrance`, 장소 판
> 사실 상자의 「입구 · 휠체어로 들어갈 수 있어요」 한 줄과 상자 조건), 시험(`PlaceInfoReadTest` 3,
> `group-access.test.mjs` [5-0] 2). `false` 는 화면에 안 띄우기로 했습니다(§10.2). 계획과 달라진 것은
> §11 에 적었습니다.
> **남은 것:** 구글 키가 있는 서버에서 휠체어 값이 오는 가게(§10.1 의 아홉 곳 중 하나)의 판을 열어 줄이
> 실제로 서는지, 사실 상자에서 어떻게 읽히는지를 사람이 봐야 합니다. 확인용 서버에는 키가 없어
> `info` 가 늘 비어, 실제 응답이 실린 판은 아직 한 번도 못 봤습니다.
>
> verdict 가 「확인 후」 로 걸어 둔 요금 등급은 이 문서를 쓰며 확인했습니다 —
> `accessibilityOptions` 는 **Pro** 이고, 지금 필드마스크는 이미 Enterprise 라 등급이
> 안 오릅니다(§6.1). 13번이 반대한 Atmosphere 필드(`servesVegetarianFood` · `goodForChildren`
> · `menuForChildren`)도 같은 표에서 **Enterprise + Atmosphere** 로 확인됐습니다 —
> 반대는 그대로 섭니다.

## 1. 하려는 것

조사가 본 불편은 둘이었습니다(survey 13번).

| | 지금 | 사람의 우회 |
|---|---|---|
| **사람 쪽** — 「민지는 갑각류 못 먹음」, 「준호 무릎 때문에 계단 적게」 | 단톡에 말로, 기억에 기댐 | 여행 안내판에 적을 수 있음 — 이미 됨 |
| **장소 쪽** — 「여기 휠체어로 들어가지나」 | 우리 앱은 말하지 않음 | 「구글 지도에서 보기」 로 나가 정보 탭을 뒤짐 |

사람 쪽은 **새로 지을 것이 없습니다.** 장소 쪽은 구글이 이미 아는 값이고, 우리가 이미
부르는 상세 호출에 필드 하나만 더하면 장소 판에 한 줄로 설 수 있습니다.

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 | 새로 / 고쳐 씀 |
|---|---|---|
| 여행 전체에 걸린 글 한 장 | 여행 안내판 — `PUT /api/trips/{id}/notice`(`trip/api/TripController.java:102-107`), `frontend/src/components/notice-box.tsx`. 동행이 다 봄, 답글 · 읽음 표시 없음(`:20-22`) | 그대로 — 사람 쪽의 자리 |
| 장소 상세를 구글에 묻기 | `trip/application/PlaceInfoService.java:314-363` `ask()`, 할당량 1(`:317`) | 고쳐 씀 (필드 하나) |
| 무엇을 달라고 할지 | `PlaceInfoService.java:137-157` `FIELDS` | 고쳐 씀 |
| 아는 값만 안다고 말하는 버릇 | `:76-117` — 모르는 값은 `null` 로 둠 | 같은 버릇 |
| 화면이 받는 모양 | `:532-540` `Info`, `:543-548` `Raw` | 고쳐 씀 (칸 하나) |
| 장소 판의 사실 상자 | `components/place-detail-sheet.tsx:356-388` — 주소 · 영업시간이 라벨 왼쪽 정렬로 섬 | 고쳐 씀 (줄 하나) |
| 판이 정보를 받는 길 | `place-detail-sheet.tsx:196-206` → `GET /api/places/{placeId}/info`(`PlaceController.java:119-133`) | 그대로 |

## 3. 버리는 것

### 3.1 동행마다 제약 칸(알레르기 · 건강 · 아이 표시) — 버립니다

알레르기와 건강은 개인정보 보호법상 **따로 동의를 받아야 하는 민감 정보**입니다. 칸을
두면 앱이 그 정보를 받는 것이 되고, 지금 막 지은 동의(`V60__consent.sql`)와 처리방침 ·
Data safety 를 다시 써야 합니다(`docs/plan-store-readiness.md` 2단계). 안내판은 사람이
스스로 적는 글이라 앱이 「건강 정보 칸」 을 받는 것과 다릅니다(verdict 13번).

### 3.2 안내판 안내 문구에 「못 먹는 것」 을 예로 넣기 — 버립니다

안내판의 빈칸 문구는 지금 「숙소 도어락, 모이는 곳, 비상 연락처」 입니다(`notice-box.tsx:76`,
`:92`, `:117-118`). 여기에 「못 먹는 것 · 걷기 힘든 것」 을 예로 넣으면 안내판이 사람을
그쪽으로 이끕니다. 앱이 민감 정보를 **청하는** 자리가 되면 §3.1 의 선을 옆문으로 넘습니다.
적을 수 있는 자리는 이미 있고, 적을지는 사람이 정합니다. **사람 쪽은 코드를 바꾸지 않습니다.**

### 3.3 사람 제약과 장소 속성 맞춰 보기 — 버립니다

맞춰 볼 장소 필드가 가장 비싼 등급입니다(§6.1 표). 하나만 넣어도 상세 호출 전부가 그
등급으로 올라갑니다. 2026-09 의 4 · 5 · 10번을 반대한 것과 같은 자리입니다.

### 3.4 휠체어 화장실 · 주차 · 좌석 — 버립니다

`accessibilityOptions` 는 넷을 함께 줍니다(입구 · 화장실 · 주차 · 좌석). 같은 등급이라 값은
안 들지만, 판에 넷을 다 세우면 사실 상자가 접근성 칸으로 채워지고, 넷 중 몇이 비는
가게마다 모양이 달라집니다. **들어갈 수 있는가** 가 첫 물음이고, 그 하나로 시작합니다
(verdict 「휠체어 입구 한 줄」). 필드마스크도 `accessibilityOptions.wheelchairAccessibleEntrance`
하나만 적습니다 — 화면이 안 쓰는 것을 받지 않는다는 `FIELDS` 머리말(`:127-131`)을 따릅니다.

### 3.5 일정 줄 · 추천 카드에 띄우기 — 버립니다

일정 줄 밑에는 이미 영업 한 줄이 섭니다(`app/trip/[id].tsx:3635`). 접근성까지 붙이면 모든
줄이 두 줄이 됩니다. 필요한 사람은 판을 엽니다. 추천 카드도 같습니다 — 고르는 자리에서
걸러 내는 것은 §3.3 의 「맞춰 보기」 이고, 그건 버렸습니다.

### 3.6 값이 없을 때 「모름」 이라고 적기 — 버립니다

구글이 값을 안 주는 가게가 대부분일 수 있습니다(§9). 그때마다 「휠체어 정보 없음」 을
적으면 판마다 빈말이 한 줄 섭니다. **값이 있을 때만** 줄을 세웁니다(verdict 13번).

## 4. 갈 곳

```
[장소 판을 연다] ── GET /api/places/{placeId}/info ──▶ PlaceInfoService.about → lookup → ask
                                                        │ 상세 1회(캐시 1시간)
                                                        │ FIELDS 에 accessibilityOptions.wheelchairAccessibleEntrance
                                                        ▼
                                         Info { wheelchairEntrance: true | false | null }
      │
      ▼
 사실 상자:  주소      …
             영업      …
             입구      휠체어로 들어갈 수 있어요        ← true 일 때
                                                       ← false · null 이면 줄이 없음(§10.2)
```

사람 쪽은 흐름이 없습니다. 안내판에 사람이 적고, 동행이 읽습니다 — 지금과 같습니다.

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `backend/src/main/java/net/weeniebeenie/fit/trip/application/PlaceInfoService.java` | `FIELDS`(`:137-157`)에 `accessibilityOptions.wheelchairAccessibleEntrance`. `Raw` · `Info` 에 `Boolean wheelchairEntrance` — 응답에 칸이 없으면 `null`, 있으면 그 참거짓 |
| `backend/src/test/java/net/weeniebeenie/fit/trip/application/PlaceInfoReadTest.java` | 셋을 더합니다(§7). `plan-moved-place.md` 가 먼저 들어갔으면 그 파일에, 아니면 이 계획이 `rawOf` 를 떼어 내며 만듭니다 |
| `frontend/src/api/types.ts` | `PlaceInfo`(`:593-`)에 `wheelchairEntrance?: Maybe<boolean>` |
| `frontend/src/components/place-detail-sheet.tsx` | 사실 상자(`:372-388`)에 줄 하나. 상자를 세우는 조건(`:213-214` `hasHours`, `:372` `place.address \|\| hasHours`)에 「휠체어 값이 있음」 을 더합니다 — 안 더하면 주소 · 영업시간이 없는 가게에서 휠체어 줄이 상자째 안 뜹니다 |

`notice-box.tsx` 는 **손대지 않습니다**(§3.2).

## 6. API

새 엔드포인트가 없습니다. 있는 두 길의 응답에 칸이 하나 늡니다.

| | `GET /api/places/{placeId}/info?on=` | `GET /api/days/{dayId}/places-info` |
|---|---|---|
| 권한 | 로그인만(`/api/**`) — 구글 공개 정보, 여행에 안 매임(`PlaceInfoService.java:242-244`) | `TripAccessPolicy.requireCanRead`(`:212`) — 남의 · 없는 날짜 모두 **404** |
| 더해지는 칸 | `info.wheelchairEntrance` (`true` / `false` / `null`) | `info[].wheelchairEntrance` — 같은 `Info` 라 따라옴. 화면은 안 씀 |
| 실패 | 그대로 — 401, 429, 못 받으면 `info: null` | 그대로 — 401, 404, 429 |

### 6.1 구글 호출

| | |
|---|---|
| `touchesGoogle` | 변화 없음(`GoogleQuotaFilter.java:61, :64`) |
| 호출 수 | **0 증가** — 같은 상세 호출에 필드 하나 |
| 요금 등급 | **안 오름.** 아래 표 |
| 캐시 | 그대로 — 메모리 1시간(`:56`) |

Place Details (New) 필드별 등급(<https://developers.google.com/maps/documentation/places/web-service/place-details>, 2026-10-12 확인). 한 요청은 달라고 한 필드 중 가장 높은 등급으로 셉니다.

| 필드 | 등급 | |
|---|---|---|
| `regularOpeningHours` · `rating` · `nationalPhoneNumber` · `websiteUri` … | Enterprise | 지금 있음 — 이미 Enterprise |
| **`accessibilityOptions`** | **Pro** | 더함 — 등급 안 오름 |
| `servesVegetarianFood` · `goodForChildren` · `menuForChildren` | **Enterprise + Atmosphere** | 안 받음(§3.3) |

### 6.2 스키마

없습니다. 마이그레이션 번호를 쓰지 않습니다.

### 6.3 다시 읽기 열쇠

새 열쇠가 없습니다. `/info` 는 구글에 묻는 길이라 열쇠 밖입니다(`invalidate.ts:61-63`).

## 7. 테스트

구글 키가 없는 확인용 서버에서는 `info` 가 비어 옵니다. 읽기는 단위 시험이 봅니다.

**`PlaceInfoReadTest.java` — 3**

| 무엇을 | |
|---|---|
| `wheelchairAccessibleEntrance: true` → `true` | |
| `false` → `false` | 「없다」 도 아는 값 |
| `accessibilityOptions` 가 없음 → `null` | 「모름」 이 「없음」 으로 읽히지 않는가 — 이 계획에서 가장 중요한 줄 |

**HTTP** — 새 길이 없어 더하지 않습니다. 「동행자만 부를 수 있는가」 를 볼 자리는
`/places-info` 인데, 이 계획은 그 권한을 건드리지 않습니다. `plan-moved-place.md` §7 이
`group-access.test.mjs` 에 그 둘(동행 → 404 아님, 남 → 404)을 더하므로, 이 계획이 먼저
들어가면 그 둘을 이쪽에서 더합니다.

## 8. 순서와 의존

1. **응답을 한 번 찍어 봅니다**(관문, §9). 운영 키로 우리 일정에 자주 오는 지역(오사카 ·
   도쿄 · 후쿠오카 · 서울 · 부산)의 가게 열 곳쯤에 `accessibilityOptions` 를 넣어 물어봅니다.
   `docs/2026-09/plan-places-fields.md` §8 의 재 보기와 같은 절차입니다. 값이 오는 가게가
   거의 없으면 줄이 거의 안 서는 기능이 되므로, 여기서 멈추고 verdict 에 적습니다.
2. 백엔드 — 읽기 시험 셋, 그다음 `FIELDS` · `Raw` · `Info`. `./gradlew build`.
3. 프런트 — 타입, 사실 상자의 줄과 상자 조건. `npm run typecheck`.

`plan-moved-place.md` 와 같은 상수 · 레코드를 고칩니다. 둘을 한 날에 열어 두지 않고, 먼저
들어간 쪽 위에 얹습니다. 순서는 상관없지만, 둘 다 §8 의 1번(찍어 보기)을 같은 날 한 번에
하면 키를 한 번만 꺼냅니다.

## 9. 아직 모르는 것

- ~~**구글이 일본 · 한국 가게에 `accessibilityOptions` 를 얼마나 주는지.**~~ — 2026-10-12 운영
  키로 재 봤습니다. 15곳 중 10곳에 왔습니다(§10.1). 다만 15곳은 우리가 넣어 둔 장소에서 고른
  것이라, 일정 전체에서 몇 할에 줄이 설지는 아직 모릅니다.
- ~~**`false` 를 어떻게 적을지.**~~ — 2026-10-12 정했습니다. 화면에 안 띄웁니다(§10.2).
- **안내판이 사람 쪽 제약을 실제로 받아 내는지.** 안내판에 「못 먹는 것」 을 적는 사람이
  있는지 우리는 알 수 없습니다 — 안내판 글은 사람이 쓴 글이라 들여다보지 않습니다. 단톡에
  남는 편이 낫다는 결론이 나와도, 그것이 §3.1 을 뒤집을 근거는 아닙니다.

## 10. 관문 결과와 정한 것

### 10.1 응답을 찍어 본 것 — 관문 넘음

2026-10-12, 주인이 운영 서버에서 Place Details (New) 를 필드마스크
`displayName,businessStatus,movedPlaceId,accessibilityOptions` 로 우리가 넣어 둔 장소 15곳(일본
· 한국 · 발리)에 물었습니다. 응답은 15곳 모두 정상이었습니다.

| | 곳 | |
|---|---|---|
| `wheelchairAccessibleEntrance` 가 옴 | **10 / 15** | `true` 9, `false` 1(아키하바라 가차폰 회관) |
| 안 옴 | 5 / 15 | 아사히 스카이룸, 만세이바시역 터, 나리타 공항 터미널(화장실만 옴), 갓파바시(주차만 옴) 등 |
| 함께 보인 다른 칸 | — | `wheelchairAccessibleParking` · `Restroom` · `Seating` |

「값이 오는 가게가 거의 없으면 멈춤」(§8 의 1)에 걸리지 않습니다. 셋 중 둘에 값이 왔습니다.
화장실 · 주차만 오는 곳이 있다는 것은 §3.4 를 다시 보게 하지만 — 「들어갈 수 있는가」 를 모르면서
화장실을 말하는 것은 순서가 거꾸로라 그대로 버립니다.

### 10.2 `false` 는 화면에 안 띄웁니다

§9 가 「실제 값을 보고 정한다」 고 미뤄 둔 것입니다. 본 값은 `false` 한 곳이고, 그것이 맞는지는
우리가 확인할 길이 없습니다 — 가차폰 회관에 가 본 사람이 없고, 이 값은 구글 지도 사용자가 답한
것일 수 있습니다. 그래서 띄우지 않기로 했습니다.

- **틀렸을 때의 값이 다릅니다.** 틀린 `true` 는 사람을 문 앞까지 보내고, 거기서 사람은 구글 지도를
  다시 봅니다. 틀린 `false` 는 들어갈 수 있는 곳을 사람이 **아예 빼게** 합니다 — 지나친 곳은
  틀렸다는 것을 끝내 모릅니다.
- **줄이 없는 것은 지금과 같습니다.** `false` 를 안 띄우면 그 가게는 값이 없는 다섯 곳과 같은
  모양이 되고, 사람은 오늘 하듯 「구글 지도」 로 나가 봅니다. 앱이 새로 틀린 말을 하지는 않습니다.
- **「~라고 나와요」 로 흐려 적는 것**도 생각했지만, 판의 사실 상자는 「이 곳에 대해 적혀 있는 것」
  이라(`place-detail-sheet.tsx` 의 사실 상자 머리말) 거기서 한 줄만 말투가 다르면 그 줄만 믿을 수
  없는 줄로 읽힙니다.

서버는 `true` / `false` / `null` 을 그대로 내보냅니다(§6). 거르는 것은 화면 한 곳입니다 — 나중에
`false` 를 띄우기로 하면 프런트 한 줄만 고치면 됩니다.

### 10.3 줄의 모양

라벨은 「입구」, 값은 「휠체어로 들어갈 수 있어요」 입니다. 라벨을 「휠체어」 로 두면 값에서 같은
말을 되풀이하게 됩니다. 라벨 칸은 다른 줄(「주소」 · 「영업」)과 같은 48 폭입니다.

## 11. 계획과 달라진 것

| 계획 | 실제 | 왜 |
|---|---|---|
| §4 — `false` 일 때 「입구에 휠체어 길이 없다고 나와요」 | 줄 없음 | §10.2 |
| §4 — 라벨 「휠체어」 · 값 「입구로 들어갈 수 있어요」 | 라벨 「입구」 · 값 「휠체어로 들어갈 수 있어요」 | §10.3 — 같은 말을 되풀이하지 않게 |
| §5 — 상자 조건에 「휠체어 값이 있음」 | 「`true` 이고 아주 닫지 않았음」 | `false` 를 안 띄우므로 `true` 만 셉니다. 아주 닫은 곳은 영업시간처럼 입구도 말하지 않습니다 — 갈 수 없는 곳입니다 |
| §7 — `group-access.test.mjs` 의 둘은 먼저 들어가는 쪽이 | 이 계획에서 더함(`[5-0]`) | 이 계획이 먼저 들어갔습니다 |
