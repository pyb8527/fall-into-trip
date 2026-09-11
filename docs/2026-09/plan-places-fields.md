# 필드마스크에 무엇을 더할지 — 네 가지를 한 번에 재고 정한다

> `verdict.md` 의 6·7·8·9 번을 한 계획으로 묶은 것입니다.
>
> **9.1 이 들어갔습니다** — §10. 나머지 셋(6·7·8)은 §8 의 3번(재 보기)에서
> 멈췄습니다. 구글 키가 있어야 합니다.

## 0. 왜 넷을 한 문서에 넣었나

계획은 하나씩 따로 쓰는 것이 규칙입니다. 여기서 어긴 이유를 적습니다.

넷이 **같은 두 상수를 고치는 일**입니다 —
`PlaceSearchService.FIELDS`(`:40-48`)와 `PlaceInfoService.FIELDS`(`:77-86`).
그리고 넷 중 셋이 **같은 선행 조건**을 갖습니다: 실제 응답을 한 번 찍어
보기. 따로 쓰면 그 재 보기 절차를 네 번 적게 되고, 그러면 네 번 중 한 번만
고쳐지는 날이 옵니다.

4단계가 어디부터 손대야 할지는 §8 이 정확히 말합니다 — **9.1 부터입니다.**
그것 하나만 기능이 아니라 이미 진 빚이고, 나머지 셋은 재 본 뒤에 정합니다.

## 1. 하려는 것

### 1.1 `FUTURE_OPENING` — 아직 안 연 가게를 "영업 중" 이라고 말하고 있습니다

**이것이 이 문서에서 유일하게 확실한 일입니다.**

`PlaceInfoService.java:266`:

```java
"CLOSED_PERMANENTLY".equals(r.path("businessStatus").asText("")),
```

`businessStatus` 를 **`CLOSED_PERMANENTLY` 인지 아닌지**로만 읽습니다. 그
결과가 `Info.permanentlyClosed()` 이고, `RecommendService:149-153` 이 그것을
이렇게 씁니다:

```java
open = !got.closedOnDay() && !got.permanentlyClosed();
```

2026-03-17 에 구글이 `FUTURE_OPENING` 이라는 상태값을 새로 만들었습니다.
그 값이 오면 `permanentlyClosed` 가 **false** 이므로, 영업시간만 있으면
`open = true` 입니다. **아직 문도 안 연 가게가 추천 카드에 "그날 영업" 으로
뜹니다.**

`RecommendService` 주석이 이 앱의 판단을 적어 두었습니다 — "추천받아서 갔더니
휴무 는 추천을 안 하느니만 못합니다." 안 연 곳은 휴무보다 나쁩니다. 휴무는
다음에 가면 되고, 안 연 곳은 갈 수가 없습니다.

### 1.2 나머지 셋 — 값이 안 오르는 필드를 받을지

최근 1년에 열린 Places 필드 대부분은 가장 비싼 등급(Enterprise + Atmosphere)
에 있어서 `verdict.md` 가 반대했습니다. 셋은 그렇지 않습니다.

| | 필드 | 등급 | 지금 대비 |
|---|---|---|---|
| 8번 | `places.googleMapsTypeLabel` | Pro | 안 오름 |
| 6번 | `places.addressDescriptor` | Pro (인도 밖 실험) | 안 오름 |
| 7번 | `places.transitStation` | Enterprise | 안 오름 (같은 등급) |

지금 우리는 `rating`·`userRatingCount` 때문에 이미 **Enterprise** 입니다.

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 |
|---|---|
| 검색 필드마스크 | `PlaceSearchService.FIELDS:40-48` |
| 상세 필드마스크 | `PlaceInfoService.FIELDS:77-86` |
| `businessStatus` 읽기 | `PlaceInfoService:266` |
| 그날 영업 판단 | `RecommendService:149-153` |
| 갈래 짐작 | `PlaceKind.guess:72-130+` — 이름 먼저, 그다음 타입. 좁은 뜻이 이깁니다 |
| 갈래 검증 | `PlaceKind.clean` (`RecommendService:191` 이 씁니다) |
| 아는 갈래 열여섯 | `frontend/src/constants/place-icons.ts:21-36` |
| 메모리 캐시 규칙 | `PlaceInfoService` — 한 시간 |
| 대중교통 요금 | `RouteService:321` `routes.travelAdvisory.transitFare`, `TaxiFare.java` |

## 3. 버리는 것

### 3.1 `includeFutureOpeningBusinesses` 를 켜는 것 — 버립니다

기본값이 꺼져 있습니다. 켜지 않습니다. 1.1 은 **들어온 값을 올바로 읽는
일**이고, 안 연 가게를 결과에 **섞는 일**과 반대 방향입니다.

### 3.2 `openingDate` 를 받는 것 — 버립니다

"2026년 11월 개업 예정" 을 화면에 쓰지 않습니다. 3.1 대로 안 연 곳을 섞지
않으므로 그 값을 보여 줄 자리가 없습니다. 필드를 더하면 등급은 안 오르지만
쓰지도 않는 것을 받는 셈입니다.

### 3.3 `PlaceKind.guess` 를 `googleMapsTypeLabel` 로 대체하는 것 — 버립니다

솔깃하지만 안 됩니다. `guess` 의 결과가 **아이콘을 정합니다**. 아이콘은
`place-icons.ts` 의 열여섯 중 하나여야 하고, 구글의 현지화 라벨은 수백 가지
글자입니다.

그리고 `guess` 는 구글이 못 하는 일을 합니다 — 주석(`:83-84`)이 적어
두었습니다: "구글은 라멘집도 그냥 restaurant 로 줍니다." 그래서 `:85-99` 가
**이름**에서 먼저 찾습니다(라멘·스시·야키니쿠·온천·이자카야). 라벨로 바꾸면
그 열다섯 줄이 하는 일이 사라집니다.

**모르는 타입일 때만 라벨을 씁니다.** `guess` 가 기본 갈래로 떨어지는 경우에
"구글은 이것을 무엇이라 부르는가" 를 한 줄로 대는 용도입니다.

### 3.4 새 타입 180개를 `guess` 에 넣는 것 — 버립니다

2024-11 에 104개, 2026-02 에 180개가 늘었습니다. 전부 열여섯 갈래에 매핑하고
싶어지는데, 하지 않습니다. `guess` 가 길어지는 만큼 읽기 어려워지고, 대개는
기본 갈래로 떨어져도 사람이 아이콘을 한 번 바꾸면 끝입니다 — 주석이 그
설계를 적어 두었습니다("먼저 찍어 두고 마음에 안 들 때만 바꾸게 합니다").

**재 본 뒤에 실제로 자주 나오는 것만** 몇 개 넣습니다.

### 3.5 구글 응답을 디스크에 남기기 — 버립니다

`addressDescriptor`·`transitStation` 은 장소마다 거의 안 바뀌는 값이라
DB 에 넣고 싶어집니다. 안 넣습니다. `RouteService` 주석의 규칙이고 약관
문제입니다. `PlaceInfoService` 의 한 시간 메모리 캐시를 그대로 씁니다.

## 4. 갈 곳

```
0. 재 보기 (코드 안 고침)
      |
      |  오사카·도쿄·서울 장소 각 열 곳으로 상세 조회를 한 번씩 날려,
      |  네 필드가 실제로 채워져 오는지 응답을 그대로 찍어 봅니다.
      |  스크립트는 임시입니다. 저장소에 남기지 않습니다.
      v
1. 9.1 — FUTURE_OPENING (재 보기와 무관하게 합니다)
      |
      |  PlaceInfoService:266 을 고쳐, 아는 값이 아니면
      |  "영업 중" 이라고 말하지 않게 합니다
      v
2. 재 본 결과로 나머지 셋을 각각 받거나 버립니다
      |
      +-- 8번 googleMapsTypeLabel — 채워져 오면 받습니다
      +-- 7번 transitStation      — 역 이름만이면 버립니다
      +-- 6번 addressDescriptor   — 한국·일본에서 비면 버립니다
```

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `backend/.../trip/application/PlaceInfoService.java` | `:266` 의 `businessStatus` 읽기를 고칩니다. `FIELDS`(`:77-86`)에 재 보기 결과에 따라 필드 추가 |
| `backend/.../trip/application/RecommendService.java` | `:149-153` 의 `open` 판단. `FUTURE_OPENING` 이면 `null`(모름)입니다 — false 가 아닙니다 |
| `backend/.../trip/application/PlaceSearchService.java` | `FIELDS`(`:40-48`)에 `googleMapsTypeLabel` (8번을 받으면) |
| `backend/.../trip/domain/PlaceKind.java` | 모르는 타입일 때 라벨을 쓸 자리 (3.3) |
| `backend/.../trip/api/dto/TripDtos.java` | 새 값이 화면까지 가야 하면 |
| `frontend/src/api/types.ts` · 해당 화면 | 8번을 받으면 |

**안 고치는 것** — `RouteService`, `TaxiFare`, 스키마, `GoogleQuotaFilter`.

## 6. API

**새 엔드포인트가 없습니다.** 기존 경로의 응답에 값이 붙거나, 판단이
달라집니다.

| | |
|---|---|
| 닿는 경로 | `GET /api/days/{dayId}/places-info`(`DayExtrasController:58`), `POST /api/trips/{id}/recommend`(`TripController:99`), `GET /api/places/search` |
| 권한 | 지금 그대로. `PlaceInfoService` 가 `TripAccessPolicy` 를 지나고, 없는 것에는 404 |
| 요청 | 안 바뀝니다 |
| 응답 | 8번을 받으면 필드 하나가 붙습니다. **`Found`·`Info` 레코드의 기존 칸은 안 바꿉니다** |
| 실패 | 지금 그대로 |

### 구글 호출

**`callsOf` 를 안 고칩니다.** 호출 수가 안 늘어납니다 — 같은 요청의
필드마스크가 넓어질 뿐입니다.

**그래서 위험합니다.** `verdict.md` 0.2 에 적은 대로, 필드마스크로 등급이
올라가면 `callsOf` 는 그것을 못 봅니다. 이 계획이 Pro·Enterprise 필드만
다루는 이유가 그것입니다.

**지킬 것 — 이 계획에서 Enterprise + Atmosphere 필드를 하나도 안 더합니다.**
재 보기 스크립트에서도 안 더합니다. 재 보려고 한 번 켰다가 그대로 두는 것이
가장 흔한 사고입니다.

### 캐시

`PlaceInfoService` 의 한 시간 메모리 캐시 그대로. 디스크에 안 남깁니다 (3.5).

### 스키마

**없습니다.**

## 7. 테스트

| 어디에 | 무엇을 |
|---|---|
| `backend/src/test/http/place.test.mjs` | `FUTURE_OPENING` 이 왔을 때 "영업 중" 으로 답하지 않는 것. **이것이 이 계획의 핵심 테스트입니다** |
| `backend/src/test/http/recommend.test.mjs` | 같은 상태의 장소가 추천 카드에서 `openOnDay` 를 `true` 로 받지 않는 것 |
| `backend/src/test/http/icon.test.mjs` | 8번을 받으면 — 아는 타입의 아이콘이 **안 바뀌는** 것. `guess` 를 건드리므로 기존 짐작이 그대로인지가 중요합니다 |

**권한 테스트** — `places-info` 는 동행자만 부를 수 있어야 합니다. 기존
테스트에 그것이 있는지 먼저 보고, 없으면 더합니다.

**구글이 실제로 `FUTURE_OPENING` 을 주는 장소를 찾기 어렵습니다.** 그래서
테스트는 응답을 가짜로 물려서 봅니다. 진짜 응답으로 못 봤으면 그렇게
적습니다.

**확인**

```bash
cd backend && ./gradlew build
```

HTTP 테스트는 스택이 떠 있어야 합니다.

```bash
docker compose up -d --build
node backend/src/test/http/place.test.mjs
node backend/src/test/http/recommend.test.mjs
```

돌려 보지 않았으면 "됩니다" 라고 적지 않습니다.

## 8. 순서와 의존

**9.1 부터 합니다.** 재 보기를 기다리지 않습니다 — 이건 이미 있는 결함이고,
나머지 셋과 달리 받을지 말지를 정할 것이 없습니다.

1. **`PlaceInfoService:266` 을 고칩니다.** 아는 값(`OPERATIONAL`,
   `CLOSED_TEMPORARILY`, `CLOSED_PERMANENTLY`)이 아니면 "영업 중" 이라고
   말하지 않습니다. `RecommendService:149-153` 의 `open` 을 `null`(모름)로
   둡니다 — **false(안 엶)가 아닙니다.** "아는 것만 말합니다" 규칙입니다.
2. 테스트 둘 (§7).
3. **재 보기** — 임시 스크립트로 네 필드의 응답을 찍어 봅니다.
4. 재 본 결과로 6·7·8 을 각각 받거나 버립니다. **버린 것은 `verdict.md` 에
   왜 버렸는지 적습니다.**
5. 받기로 한 것만 구현. 하나씩 끝냅니다.

1·2번은 3번 없이 됩니다. 3번 없이 4·5번은 못 합니다.

## 9. 아직 모르는 것

- **`businessStatus` 가 가질 수 있는 값 전부.** 지금 아는 것은
  `OPERATIONAL`·`CLOSED_TEMPORARILY`·`CLOSED_PERMANENTLY`·`FUTURE_OPENING`
  입니다. 문서를 다시 보고 목록을 확정합니다. 1번을 "아는 값이 아니면
  모름" 으로 짜는 이유가 이것입니다 — 목록이 또 늘어도 같은 사고가 안 납니다.
- **`transitStation` 이 무엇을 담는지.** 역 이름만인지, 거리·노선까지인지.
  역 이름만이면 7번을 버립니다 — `formattedAddress` 로 대개 압니다.
- **`addressDescriptor` 가 일본·한국에서 채워지는지.** 인도 밖 실험 단계라는
  것만 압니다. 일본은 주소가 블록 기반이라 가장 쓸모 있을 곳인데, 실험
  단계 필드는 예고 없이 모양이 바뀌거나 사라질 수 있습니다.
- **`googleMapsTypeLabel` 이 한국어로 오는지.** `languageCode` 를 우리가 이미
  보내고 있는지 `PlaceInfoService` 의 요청을 봐야 합니다. 영어로 오면 화면에
  쓸 수 없습니다.
- **늘어난 타입 중 무엇이 자주 나오는지.** 3.4 대로 전부 넣지 않으므로,
  재 보기에서 실제로 기본 갈래로 떨어지는 것을 세어 보고 정합니다.
- **요금 등급별 실제 단가.** 이 계획은 등급을 안 올리므로 여기서는 필요
  없습니다. 다만 `verdict.md` 가 4·5·10 번을 반대한 근거가 "한 칸 올라간다"
  이고 금액은 안 봤습니다. 그것을 재는 것은 별개의 일입니다.

## 10. 무엇을 했나 (2026-09-11)

§8 의 1·2 입니다. 3번(재 보기)부터는 구글 키가 있어야 해서 못 갔습니다.

### 9.1 — 아는 것만 말합니다

`businessStatus` 를 **`CLOSED_PERMANENTLY` 인지 아닌지**로만 읽던 자리를,
아는 값 셋을 세워 두고 나머지는 모르는 것으로 두게 바꿨습니다.

| 구글이 준 것 | 전 | 후 |
|---|---|---|
| `OPERATIONAL` | 영업 중 | 그날 영업시간대로 |
| `CLOSED_PERMANENTLY` | 안 엶 | 안 엶 |
| `CLOSED_TEMPORARILY` | **영업 중** | **안 엶** |
| `FUTURE_OPENING` | **영업 중** | 모름 |
| 안 보냄 · 모르는 새 값 | **영업 중** | 모름 |

**계획서가 짚은 것보다 한 줄이 더 있었습니다.** `CLOSED_TEMPORARILY` 도
"아닌 것" 에 묶여 영업 중으로 흐르고 있었습니다. 잠시 닫은 가게도 지금
가면 못 들어가므로 안 엶으로 답합니다.

판단을 `PlaceInfoService.opensOn` 한 자리에 모았습니다. 구글이 또 새 값을
내도 같은 일이 되풀이되지 않습니다 — 모르는 것은 모른다고 합니다.

### 화면이 안 깨지게

`Info` 에 `status` 를 더하면서 `permanentlyClosed` 를 지우려다 되돌렸습니다.
레코드는 **칸만 JSON 으로 나갑니다** — 메서드로 만들었으면 조용히 빠지고,
화면 네 곳(`trip/[id].tsx`·`travel/[id].tsx`·`place-detail-sheet` 둘)의
"문을 닫은 곳입니다" 가 사라졌을 것입니다. 칸으로 남기고 `status` 를 나란히
두었습니다. 그것을 지키는 시험도 함께 넣었습니다.

### 잰 것

구글이 `FUTURE_OPENING` 을 주는 장소를 찾아 HTTP 로 재기는 어렵습니다
(§7 이 예상한 그대로입니다). 그래서 판단하는 자리만 따로 봅니다 —
`PlaceStatusTest` **여섯**.

| 무엇 | |
|---|---|
| 아직 안 연 가게를 영업 중이라고 안 한다 | 이 묶음의 핵심 |
| 모르는 값이 와도 영업 중이라고 안 한다 | 빈 값·null 포함 |
| 닫은 곳은 안 연다고 말한다 | 아주·잠시 둘 다 |
| 도는 가게는 그 날짜 영업시간으로 | 쉬는 날이면 안 엶 |
| 못 물어본 장소는 모름 | 번호가 없거나 키가 꺼졌을 때 |
| 아주 닫은 곳은 화면에도 그렇게 | 위의 레코드 함정 |

`./gradlew test` 27개 통과(`PlaceStatusTest` 6 · `GoogleQuotaTest` 8 ·
`RecommendQueryTest` 8 · `WebPushTest` 5). HTTP 는 `place` 9 ·
`recommend` 21 · `icon` 42 · `trip` 60, 전부 0 실패.

**진짜 `FUTURE_OPENING` 응답으로는 못 봤습니다.** §7 이 그렇게 적으라고
해서 적어 둡니다.

### 여기서 멈춘 이유

§8 의 3번은 "임시 스크립트로 네 필드의 응답을 찍어 본다" 입니다. 그러려면
구글 키가 있어야 하는데 이 PC 의 `.env` 에 `GOOGLE_MAPS_KEY` 가 비어
있습니다. 재 보지 않고 6·7·8 을 받거나 버리면, 이 문서가 §0 에서 넷을 한
데 묶은 이유(**한 번에 재고 한 번에 정한다**)가 없어집니다.

키가 있는 자리에서 3번을 돌리면 4·5 로 이어집니다.

### 곁에 남겨 둔 것

일정 화면의 장소 상세는 아직 `permanentlyClosed` 만 봅니다. 그래서 내
일정에 넣어 둔 곳이 `FUTURE_OPENING` 이거나 잠시 닫았어도 아무 말이
없습니다. 추천 카드와 같은 종류의 구멍인데, 이 계획이 닿는 파일 둘
(`PlaceInfoService`·`RecommendService`) 밖이라 손대지 않았습니다.
`status` 가 이미 화면까지 내려가므로 붙이는 것은 어렵지 않습니다.
