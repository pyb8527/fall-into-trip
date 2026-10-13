# 값대 · 쉬는 시간 · 주문 마감 — 이미 받는 상세 한 번에서 세 줄을 더 읽는다

> 주인이 2026-10-13 에 운영 키로 응답을 찍어 보고 짓기로 한 것의 실행 계획입니다.
> survey · verdict 를 거치지 않았습니다 — 새 외부 의존도 새 호출도 없이 이미 받는 상세
> 응답에서 읽는 칸만 늘리는 일이라, 관문(§10) 하나로 갈음했습니다.
>
> **지었음 — 2026-10-13.** 백엔드(`FIELDS` 에 `priceRange` · `regularSecondaryOpeningHours` 의
> 갈래 · 구간, `rawOf` 의 `priceOf` · `breaksOf` · `kitchenOf` · `lastOrdersOf`, `Raw` 의 요일별
> 두 표, `Info` 의 `price` · `breaks` · `lastOrder`), 프런트(`PlaceInfo` 세 칸, 장소 판의 「가격」 줄과
> 「브레이크타임 …」 · 「라스트오더 …」, 일정 줄의 「쉬는 시간이에요 (…)」 · 「주문 마감 뒤예요 (…)」),
> 시험(`PlaceInfoReadTest` 15 더함)까지 들어갔습니다. 계획과 달라진 것은 §11 에 있습니다.
> **남은 것:** 키가 있는 서버에서 판과 일정 줄을 사람이 한 번 봐야 합니다 — 특히 필드마스크를
> `regularSecondaryOpeningHours` 통째가 아니라 갈래 · 구간 두 칸으로 줄였는데, 그 모양을 운영 키로
> 아직 안 불러 봤습니다(§11). 화면은 타입 검사와 eslint 까지만 봤고 기기에서 돌려 보지 않았습니다.

## 1. 하려는 것

지금 장소 판과 일정 줄은 세 가지를 말하지 않습니다.

| 모르는 것 | 사람이 지금 하는 우회 |
|---|---|
| **얼마쯤 드는 곳인지** | 「구글 지도」 로 나가 값대 칸을 봅니다 |
| **언제 쉬는지** | 판에 「브레이크 타임 있음」 배지만 뜹니다(`components/place-detail-sheet.tsx:748`). 몇 시부터 몇 시인지는 요일별 일곱 줄을 펼쳐 한 줄 안에서 읽어야 합니다. 게다가 이 배지는 **구간이 둘이기만 하면** 뜹니다 — 로쿠린샤처럼 9:45~10:00 의 15분 틈도 「브레이크 타임」 이 됩니다 |
| **주문을 언제까지 받는지** | 아무 데도 없습니다. 이치란은 22:45 까지 열지만 주방은 22:30 에 닫습니다. 일정에 22:40 을 적어도 「영업 중」 으로 보입니다 |

일정 줄은 적어 둔 시각이 영업 밖이면 「적어 둔 시각에 안 열어요」 라고 합니다
(`app/trip/[id].tsx:4451-4462`, `outsideHours()` `:4483-4495`). 쉬는 시간에 들어간 것도 같은 말로
뭉뚱그려지고, 주문 마감 뒤는 잡히지 않습니다.

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 | 새로 / 고쳐 씀 |
|---|---|---|
| 상세를 구글에 묻기 | `trip/application/PlaceInfoService.java:383-412` `ask()` — 한 번에 할당량 1(`:386`) | 그대로 |
| 무엇을 달라고 할지 | `:137-195` `FIELDS` | 고쳐 씀 (필드 둘 더함) |
| 응답 읽기 | `:421-445` `rawOf()` — 단위 시험이 고정 JSON 을 먹이는 자리 | 고쳐 씀 |
| 요일별 여는 구간 | `:585-598` `spansOf()` — 일요일 0, 닫는 시각 없으면 24시간 | 그대로 — 쉬는 시간 · 주방 시간이 같이 씀 |
| 그날 것 고르기 | `:313-344` `viewOf()` — 넣어 둔 날의 요일, 날짜가 없으면 그곳의 오늘 | 고쳐 씀 (그날 쉬는 시간 · 마감을 고름) |
| 메모리에 1시간 · 1000개 | `:56`, `:74`, `:216-222` | 그대로 |
| 판의 영업 줄 | `place-detail-sheet.tsx:724-772` `Hours` — `onIso` 로 「그날」 · 「오늘」 을 가림 | 고쳐 씀 |
| 판의 사실 상자 | `place-detail-sheet.tsx:529-560` 주소 · 영업 · 입구 | 고쳐 씀 (값대 줄) |
| 금액 적기 | `lib/money.ts:13` `money()`, `:89` `decimalsOf()` | 그대로 씀 |
| 일정 줄의 영업 한 줄 | `app/trip/[id].tsx:4423-4476` `PlaceHours`, `:4483` `outsideHours()` | 고쳐 씀 |

## 3. 버리는 것

### 3.1 `priceLevel`(₩ · ₩₩ 등급) — 버립니다
값대가 있으면 등급은 같은 말을 더 흐리게 합니다. 관문에서 값대가 없던 두 곳(동네 이름, 커피집
한 곳)은 등급도 판단에 쓸 만큼 오지 않았습니다.

### 3.2 KITCHEN 밖의 보조 시간(아침 · 해피아워 · 포장 · 배달 …) — 버립니다
관문에서 넷 중 둘이 아침 · 해피아워였고, 한 곳(타카하시야)은 열두 갈래가 전부 본 영업시간과
같았습니다. 띄우면 상자가 보조 시간으로 채워지고 대부분 소음입니다. **「언제까지 먹을 수 있나」
하나만** 읽습니다.

### 3.3 점심 라스트오더 — 이번에는 안 합니다
주방 시간이 점심 · 저녁 둘로 오면 둘 다 마감이 있습니다. 하루의 **마지막** 마감만 봅니다.
점심 쪽은 표본(관문 4곳)에 없었습니다.

### 3.4 BREAK 갈래를 따로 읽기 — 안 합니다
보조 시간에 쉬는 시간 갈래가 따로 있을 수 있다고 봤지만 관문에서 한 번도 안 왔습니다. 본 영업의
구간 사이 틈만 봅니다.

### 3.5 일정 줄 경고를 푸시로 — 버립니다
열었을 때 보이면 됩니다. 사람이 안 볼 때 구글을 부를 길을 만들지 않습니다.

## 4. 갈 곳

```
[판을 연다 / 일정을 펼친다] ── 같은 상세 1회(캐시 1시간) ── FIELDS + priceRange + regularSecondaryOpeningHours
                                       │
                                       ▼ rawOf (요일별로 미리 셈 — Raw 는 날짜에 안 매임)
                         price {currency, start, end}
                         breaksByDay   : 같은 요일 구간 사이 틈 ≥ 30분
                         lastOrderByDay: KITCHEN 이 본 영업보다 먼저 닫는 날의 주방 마감
                                       │
                                       ▼ viewOf (넣어 둔 날 · 그곳의 오늘)
                         Info.price · Info.breaks(그날) · Info.lastOrder(그날)
      │
      ├─ 장소 판:  가격  1,000~2,000 JPY
      │            영업  월요일: 11:00~14:30, 17:00~20:30
      │                  브레이크타임 14:30~17:00 · 라스트오더 20:00
      │
      └─ 일정 줄:  적어 둔 시각이 쉬는 시간 안 → 「쉬는 시간이에요 (14:30~17:00)」
                   주문 마감 뒤 · 닫기 전     → 「주문 마감 뒤예요 (22:30)」
```

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `backend/…/trip/application/PlaceInfoService.java` | `FIELDS` 에 `priceRange`, `regularSecondaryOpeningHours.secondaryHoursType`, `regularSecondaryOpeningHours.periods`. `rawOf()` 가 값대 · 요일별 쉬는 시간 · 요일별 주문 마감을 읽음. `Raw` · `Info` 에 칸, `viewOf()` 가 그날 것을 고름 |
| `backend/src/test/java/…/PlaceInfoReadTest.java` | 시험을 더함(§7) |
| `backend/src/test/java/…/PlaceStatusTest.java` | `Info` 칸이 늘어 생성자 인자만 맞춤 |
| `frontend/src/api/types.ts` | `PlaceInfo` 에 `price` · `breaks` · `lastOrder`(모두 있어도 되고 없어도 됨) |
| `frontend/src/components/place-detail-sheet.tsx` | 사실 상자에 「가격」 줄, `Hours` 의 배지를 「브레이크타임 …」 · 「라스트오더 …」 로 |
| `frontend/src/app/trip/[id].tsx` | `PlaceHours` 의 경고 둘, 「(브레이크 타임 있음)」 을 30분 틈 기준으로 |

## 6. API

새 엔드포인트가 없습니다. `GET /api/days/{dayId}/places-info` 와 `GET /api/places/{placeId}/info`
의 `info` 에 칸이 늡니다. 권한 · 실패 모양은 그대로입니다.

| 칸 | 모양 | 비는 때 |
|---|---|---|
| `price` | `{ currency: "JPY", start: 1000, end: 2000 }` — 금액은 그 통화의 큰 단위(엔 · 루피아) | 구글이 안 줬을 때 `null` |
| `price.start` | 「1 이하」 는 `null` 로 — 구글이 「¥1,000 까지」 를 `1 ~ 1000` 으로 보냅니다(관문, 마츠야 · 요시노야) | 「~까지」 |
| `price.end` | | 「~부터」(관문, Cretya) |
| `breaks` | `[{ start: "14:30", end: "17:00" }]` — 그날 것만 | 없으면 `[]` |
| `lastOrder` | `"22:30"` — 그날 것만 | KITCHEN 이 없거나, 본 영업과 같이 닫거나, 늦게 닫으면 `null` |

### 6.1 구글 호출

| | |
|---|---|
| 호출 수 | **0 증가.** 같은 요청에 필드만 늘어남 |
| `touchesGoogle` · 할당량 | 그대로 |
| 요금 등급 | **안 오름.** `priceRange` · `regularSecondaryOpeningHours` 둘 다 Enterprise 이고 이 요청은 이미 Enterprise 입니다(§10.2) |
| 캐시 | 그대로 — 메모리 1시간, 1000개 |

### 6.2 스키마
없습니다.

## 7. 테스트

키가 없는 확인용 서버에서는 `info` 가 늘 비어 오므로 **읽기는 단위 시험이** 봅니다. 응답 모양이
바뀌는 HTTP 시험은 없습니다(`info: null` · `[]` 그대로).

**`PlaceInfoReadTest.java` 에 더함**

| 무엇을 | 관문의 어느 곳 |
|---|---|
| 값대 `start ~ end` | 수프 카레 카무이류 JPY 1000–2000 |
| 시작이 「1」 이면 「까지」 | 마츠야 · 요시노야 |
| 시작만 오면 「부터」 | Cretya IDR 250000 |
| 값대 없음 → `null` | 이케부쿠로 · AKASA |
| 30분 넘는 틈 → 쉬는 시간 | 카무이 14:30–17:00 |
| 15분 틈은 쉬는 시간 아님 | 로쿠린샤 9:45–10:00 |
| 자정 넘는 구간 · 전날에서 이어진 00:00 구간은 틈을 만들지 않음 | 지어낸 모양 |
| KITCHEN 이 먼저 닫음 → 마감 | 이치란 22:30 / 22:45 |
| KITCHEN 이 자정 넘겨 닫는 곳도 셈 | 지어낸 모양 |
| KITCHEN 이 본 영업과 같음 → `null` | 타카하시야(열두 갈래 전부 같음) |
| KITCHEN 없음 · 아침 · 해피아워만 → `null` | 관문의 나머지 |

## 8. 순서와 의존

1. 요금 등급을 구글 문서로 확인(§10.2). Atmosphere 면 그 필드는 멈춤.
2. 백엔드 — `FIELDS` · `rawOf` · `Raw` · `Info` · `viewOf`, 단위 시험. `./gradlew test`.
3. 프런트 — 타입, 판, 일정 줄. `tsc`, 바꾼 파일 `eslint`.

## 9. 아직 모르는 것

- **점심 라스트오더가 오는 모양.** 표본에 없었습니다(§3.3).
- **KITCHEN 이 본 영업보다 늦게 닫는 곳**이 있는지. 있으면 띄우지 않습니다 — 「주방은 열었는데
  가게는 닫음」 은 뜻을 모릅니다.
- **값대의 통화가 그 나라 통화가 아닐 때가 있는지.** 15곳은 전부 그 나라 통화였습니다.
- **자정을 넘겨 쉬는 시간이 생기는 곳**(예: 01:00 닫고 05:00 다시 엶)은 쉬는 시간으로 안 봅니다.
  그 틈은 「밤에 닫음」 에 가깝습니다.

## 10. 관문 결과

### 10.1 응답을 찍어 본 것

2026-10-13, 주인이 운영 키로 Place Details (New) 를 필드마스크
`displayName,primaryType,priceLevel,priceRange,currentOpeningHours.weekdayDescriptions,regularSecondaryOpeningHours`
로 우리 장소 15곳(도쿄 · 발리)에 물었습니다.

| | |
|---|---|
| `priceRange` | **13 / 15** — 식당 · 카페 전부. 없던 곳: 이케부쿠로(동네 이름), AKASA(커피집) |
| 값대 모양 | `start ~ end`(JPY 1000–2000, IDR 75000–200000) · 시작이 `"1"` 이고 끝이 1000(마츠야, 요시노야 — 「¥1,000 까지」) · 시작만(Cretya IDR 250000 — 「부터」). `units` 는 글자, `currencyCode` 가 옴 |
| `regularSecondaryOpeningHours` | **4 / 15.** KITCHEN 둘 — 이치란(본 09:30–22:45, 주방 22:30 까지) · 로쿠린샤(본 23:00 닫음, 주방 22:30). 나머지는 BREAKFAST · HAPPY_HOUR. 타카하시야는 열두 갈래가 전부 본 영업과 같았음(소음) |
| BREAK 갈래 | 한 번도 안 옴 |
| 쉬는 시간 | 본 영업 구간 사이 틈으로만 보임 — 수프 카레 카무이 11:00–14:30, 17:00–20:30(14:30–17:00). 로쿠린샤 7:30–9:45, 10:00–23:00 은 15분 틈 — 쉬는 시간이 아님 |

### 10.2 요금 등급

구글 문서(<https://developers.google.com/maps/documentation/places/web-service/place-details>,
2026-10-13 확인)의 「Place Details Enterprise SKU 를 부르는 필드」 목록에 `priceRange` 와
`regularSecondaryOpeningHours` 가 둘 다 있습니다. `regularOpeningHours` · `rating` ·
`userRatingCount` · `nationalPhoneNumber` · `websiteUri` 와 같은 줄입니다 — 이 요청은 이미
Enterprise 라 **값이 오르지 않습니다.** Atmosphere 가 아니므로 둘 다 받습니다.

응답 모양은 레퍼런스(<https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places>)
에서 `PriceRange { startPrice, endPrice }`, `Money { currencyCode, units(글자), nanos }`,
`SecondaryHoursType` 의 `KITCHEN` 을 확인했습니다.

## 11. 계획과 달라진 것

| 계획 | 실제 | 왜 |
|---|---|---|
| 주인의 지시 — 쉬는 시간을 `[{day, start, end}]` 로 | 응답에는 **그날 것만** `breaks: [{start, end}]` 로. 요일별 표는 `Raw.breaksByDay` 에 둠 | `spans` 가 이미 「그날 것만」 을 내보냅니다(`viewOf`). 같은 자리에서 같은 요일로 고르면 판 · 일정 줄 · 추천이 요일 셈을 따로 하지 않습니다. 주문 마감도 같은 모양(`lastOrderByDay` → `lastOrder`) |
| 주인의 예 — 「¥1,000~2,000」, 「Rp250,000 이상」 | 「1,000~2,000 JPY」, 「1,000 JPY 이하」, 「250,000 IDR 이상」 | 지시대로 `money()` 를 씁니다. 그 함수가 통화 부호가 아니라 코드를 뒤에 붙입니다 — 가계부와 같은 모양입니다. 기호 표(`fareText`)는 일정 화면 안의 지역 함수이고 루피아가 없습니다 |
| `regularSecondaryOpeningHours` 통째 | `.secondaryHoursType` · `.periods` 두 칸만 | 요일 설명 글 · 다음 여는 시각은 안 씁니다. 반복 칸의 하위 경로는 `photos.name` 이 이미 같은 모양으로 돕니다. **이 두 칸 모양을 운영 키로 불러 보지는 않았습니다** |
| §3.4 — 본 영업 구간 사이 틈 | 그날 **00:00 에 여는 구간** 뒤의 틈도 안 셈 | 전날 밤에서 이어진 구간(00:00–02:00) 뒤의 02:00–11:00 은 쉬는 시간이 아니라 밤에 닫은 것입니다 |
| 장소 판의 「브레이크 타임 있음」 배지 | 지움 — 시각이 든 줄로 바꿈 | 같은 말을 두 번 하지 않게. 일정 줄의 「(브레이크 타임 있음)」 은 남기되 기준을 「구간 둘」 에서 「30분 넘는 틈」 으로 |
| 일정 줄의 경고 둘 | 「쉬는 시간이에요」 는 빨강, 「주문 마감 뒤예요」 는 주황(`warning`) | 쉬는 시간에는 문이 닫혀 있고, 주문 마감 뒤에는 문이 열려 있습니다. 쉬는 시간이면 「적어 둔 시각에 안 열어요」 대신 이 줄만 섭니다 |
| §7 — HTTP 시험 | 더하지 않았고 돌리지 않았음 | 키가 없는 서버에서는 `info` 가 `null` · `[]` 로 오고 그 모양은 그대로입니다. 바뀐 칸이 HTTP 시험에 닿지 않습니다 |
