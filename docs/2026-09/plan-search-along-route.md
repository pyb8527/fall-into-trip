# 가는 길에 있는 곳을 찾는다 — 점이 아니라 선으로 묻는다

> `verdict.md` 3번에서 **찬성**으로 받은 것의 실행 계획입니다.
> 아직 코드는 한 줄도 바뀌지 않았습니다.

## 1. 하려는 것

추천은 **점** 기준입니다. `RecommendService:115-122` 가 `around` 를 하나
잡습니다 — 지금 서 있는 자리, 없으면 여행에 꽂힌 핀들의 한가운데, 그것도
없으면 보석함의 한가운데.

그래서 이런 것을 못 묻습니다.

> "오사카성에서 도톤보리로 가는 길에 점심 먹을 데"

지금은 두 곳의 **한가운데**를 잡고 반경으로 찾습니다. 그 한가운데는 길이
아닙니다 — 두 점 사이가 강이거나 철로면 한가운데에는 아무것도 없고, 길은
빙 돌아갑니다. 사람이 실제로 지나가는 자리와 한가운데는 다릅니다.

지금 사람이 하는 우회: 두 곳 사이를 지도에서 눈으로 보고, 중간쯤의 지명을
알아내서 그 이름으로 다시 검색합니다.

## 2. 이미 있는 것

**폴리라인을 새로 받을 필요가 없습니다.** 이것이 이 계획이 싼 이유입니다.

| 필요한 일 | 지금 어디에 있나 |
|---|---|
| 인코딩된 폴리라인 | `RouteService.Leg`(`:402-403`)의 `String polyline`. `Option`(`:236`)에도 있습니다 |
| 폴리라인을 달라고 함 | `RouteService:321-322` — 필드마스크에 `routes.polyline.encodedPolyline` |
| 하루치 경로 | `RouteService.of(me, dayId, mode)`(`:101`) → `DayRoute(mode, legs, …)`(`:438`) |
| 구간별 세 수단 | `RouteService.compare(me, dayId)`(`:158`) → `List<Gap>` |
| 경로 화면 | `GET /api/days/{dayId}/route`(`DayExtrasController:32`) |
| 문장 검색 | `PlaceSearchService.search(query, lat, lng, radiusM)`(`:93`) |
| 맥락 덧대기 | `RecommendService.recommend(…)`(`:89`) |
| 추천 엔드포인트 | `POST /api/trips/{id}/recommend`(`TripController:99`) |
| 이미 담은 곳 표시 | `RecommendService.alreadyHave` |
| 폴리라인 다루기 | `frontend/src/lib/polyline.ts` |

구글이 요구하는 것이 정확히 `RouteService` 가 이미 받아 두는 그
`encodedPolyline` 입니다.

## 3. 버리는 것

### 3.1 새 엔드포인트 — 버립니다

`POST /api/trips/{id}/recommend` 를 늘립니다. 새 경로를 내지 않습니다.

이유가 둘입니다. 하나는 `GoogleQuotaFilter.callsOf`(`:57-59`)가
`path.endsWith("/recommend")` 로 세고 있어서, 새 경로를 내면 그 셈에 자리를
하나 더 만들어야 합니다. 둘은 하는 일이 같습니다 — 맥락을 덧대어 문장으로
찾는 것이고, 맥락이 점에서 선으로 바뀌는 것뿐입니다.

### 3.2 폴리라인을 화면에서 보내기 — 버립니다

요청 본문에 `polyline` 을 담아 보내지 않습니다. **`fromDayId`·`fromPlaceId`·
`toPlaceId` 처럼 무엇과 무엇 사이인지만 보내고, 폴리라인은 서버가 구합니다.**

화면에서 보내면 (ㄱ) 아무 폴리라인이나 실어 보낼 수 있게 되고 — 그러면 우리
사용량으로 남의 질의를 태웁니다. `RecommendService` 주석이 `intent` 에 대해
같은 경계를 이미 적어 두었습니다 ("기기에서 온 값은 사람이 고칠 수 있는
값입니다"). (ㄴ) 웹과 앱이 다른 것을 보낼 여지가 생깁니다.

### 3.3 경로를 새로 부르기 — 되도록 버립니다

**이미 받아 둔 경로가 있으면 그것을 씁니다.** 화면이 날짜를 펼칠 때
`/route` 를 이미 부르므로(`DayExtrasController:32`), 그 답에 폴리라인이 들어
있습니다.

없을 때만 Routes 를 부르고, **그때는 `callsOf` 에 그만큼 더합니다.** 안
더하면 문턱이 실제 호출보다 적게 셉니다.

### 3.4 25개 경유지 최적화 — 버립니다

Routes API 가 경유지 25개 최적화를 합니다. 안 씁니다. 동선 정리는
`RouteTidy` 가 이미 하고 있고, 그 규칙은 "사람이 수락해야 바뀝니다" 입니다.
이 계획은 **찾는 일**이고 순서를 고치는 일이 아닙니다.

### 3.5 `routingSummaries` — 버립니다

결과마다 "도보 12분" 을 붙이고 싶어지는데, `verdict.md` 4번이 반대했습니다.
**Enterprise + Atmosphere** 등급이고, `callsOf` 는 그 증가를 못 봅니다.

거리는 지금처럼 `RecommendService:155-157` 이 직선으로 계산합니다.

## 4. 갈 곳

```
[사람]  일정의 두 곳 사이를 눌러 "이 사이에서 찾기"
          |
          v
  POST /api/trips/{id}/recommend
  {
    "query": "점심 먹을 데",
    "dayId": "…",
    "between": { "fromPlaceId": "…", "toPlaceId": "…" }   ← 더합니다
  }
          |
          v
  RecommendService
          |
          +-- between 이 있으면
          |     |
          |     v
          |   그 두 곳이 이 여행의 것인지 확인 (아니면 400)
          |     |
          |     v
          |   RouteService 에서 그 구간의 encodedPolyline
          |     |  (이미 있으면 그대로. 없으면 Routes 1 회 — callsOf 에 반영)
          |     v
          |   PlaceSearchService.search(query, …, polyline)
          |     searchAlongRouteParameters.polyline.encodedPolyline
          |     |
          |     +-- 결과가 비면 → 지금의 점 기준 검색으로 내려앉습니다
          |
          +-- 없으면 지금 그대로 (around 로 점 기준)
          |
          v
  Card[] — 모양이 안 바뀝니다. already·openOnDay·distanceM 그대로
```

**결과가 비었을 때 내려앉는 것이 중요합니다.** 구글 문서가 밝혀 두었습니다 —
출발점과 도착점이 같거나 아주 가까우면 결과가 안 올 수 있습니다. 같은 날
연달아 있는 두 곳은 대개 가깝습니다. "없습니다" 로 끝내면 이 기능이 있는
것이 없는 것보다 나쁩니다.

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `backend/.../trip/application/PlaceSearchService.java` | `search()` 에 폴리라인을 받는 갈래 하나. 본문에 `searchAlongRouteParameters` 를 담습니다. **`Found` 레코드(`:193`)는 안 바꿉니다** |
| `backend/.../trip/application/RecommendService.java` | `recommend(…)`(`:89`)에 `between` 을 받고, `around` 를 잡는 자리(`:115-122`) 옆에 선 갈래를 둡니다 |
| `backend/.../trip/application/RouteService.java` | 구간 하나의 폴리라인을 꺼내는 길. `of`·`compare` 가 이미 구하는 것을 재사용합니다 |
| `backend/.../trip/api/TripController.java` | `:99` 의 요청 레코드에 `between` |
| `backend/.../support/quota/GoogleQuotaFilter.java` | 3.3 대로 경로를 새로 부를 수 있으면 `/recommend` 의 7 을 올립니다 |
| `frontend/src/components/recommend-sheet.tsx` | `between` 을 실어 보냅니다 |
| `frontend/src/app/trip/[id].tsx` | 두 곳 사이에서 여는 자리 |
| `frontend/src/api/types.ts` | 요청 타입 |

**안 고치는 것** — 스키마, `Found`·`Card` 의 기존 칸, `PlaceInfoService`,
`RouteTidy`.

## 6. API

| | |
|---|---|
| 메서드·경로 | `POST /api/trips/{id}/recommend` — **지금 그대로** |
| 권한 | `RecommendService` 가 이미 `TripAccessPolicy` 를 지납니다. 없는 여행에는 404 |
| 요청 | 지금 것에 `between: { fromPlaceId, toPlaceId }` 하나. `dayId` 와 함께 옵니다 |
| 응답 | **안 바뀝니다.** `Card` 그대로 |
| 실패 | 두 곳이 이 여행의 것이 아니면 400 (`RecommendService:129-133` 이 `dayId` 에 대해 같은 검사를 이미 합니다). 경로를 못 구하면 400 이 아니라 **점 기준으로 내려앉습니다** |

`here` 를 본문으로 받는 이유(`docs/done/recommend.md` §6.1 — "사람이 지금 어디
있는지는 nginx 접근 기록과 브라우저 방문 기록에 남길 값이 아닙니다")가
`between` 에도 적용됩니다. 쿼리스트링에 두지 않습니다.

### 구글 호출

`GoogleQuotaFilter.callsOf`(`:57-59`)가 지금 `/recommend` 에 **7** 을 셉니다 —
검색 1 + 그날 문 여는지 6.

`searchAlongRouteParameters` 는 **요청 파라미터이고 필드마스크가 아닙니다.**
요금 등급을 올리지 않습니다.

- **이미 받아 둔 폴리라인을 쓰면** — 7 그대로.
- **경로를 새로 부르면** — Routes 가 1 붙으므로 **8** 로 올립니다.

3.3 을 어느 쪽으로 짜느냐에 따라 정합니다. 애매하면 8 로 둡니다 — 주석이
"실제보다 넉넉히 잡습니다. 덜 잡으면 문턱이 뜻대로 서지 않습니다" 라고
적어 두었습니다.

### 캐시

추천 결과를 DB 에 안 남깁니다. `PlaceInfoService` 의 한 시간 메모리 규칙
그대로.

### 스키마

**없습니다.**

## 7. 테스트

`backend/src/test/http/recommend.test.mjs` 에 **다섯**을 더합니다.
그중 **둘**이 "동행자만 부를 수 있는가" 를 봅니다.

| | 무엇을 |
|---|---|
| 1 | `between` 을 주면 결과가 오는가 |
| 2 | `between` 없이 부르면 지금과 같은 답인가 — **기존 동작이 안 바뀌는 것** |
| 3 | 두 곳이 **다른 여행**의 것이면 400 |
| 4 | **동행자가 아닌 사람**이 `between` 으로 부르면 404 |
| 5 | **남의 여행의 placeId** 를 `between` 에 넣으면 400 또는 404 — 있는지 없는지 새지 않는 것 |

4·5 번이 권한 자리입니다. 5번이 특히 중요합니다 — `between` 이 `placeId` 를
받으므로 그것으로 남의 여행에 그 장소가 있는지 물어볼 수 있게 됩니다.
`TripAccessPolicy` 가 403 이 아니라 404 로 답하는 이유와 같은 문제입니다.

**확인**

```bash
cd backend && ./gradlew build
```

```bash
docker compose up -d --build
node backend/src/test/http/recommend.test.mjs
node backend/src/test/http/place.test.mjs
```

그리고 웹에서 실제 질의를 넣어, **한가운데로 찾던 것과 답이 실제로 다른지**
봅니다. 같으면 이 계획은 값이 없습니다.

돌려 보지 않았으면 "됩니다" 라고 적지 않습니다.

## 8. 순서와 의존

1. **`PlaceSearchService`** 에 폴리라인을 받는 갈래. 먼저 섭니다.
   여기서 구글이 실제로 다르게 답하는지부터 확인합니다 — **다르지 않으면
   여기서 멈춥니다.**
2. **`RouteService`** 에서 구간 하나의 폴리라인을 꺼내는 길. 3.3 의 판단
   (있으면 재사용, 없으면 부름)을 여기서 정합니다.
3. **`RecommendService`** 에 `between`. 권한 검사를 여기서 짭니다.
4. **`GoogleQuotaFilter`** 를 2번의 결정에 맞춰 고칩니다. **3번 다음에 곧바로
   합니다** — 미루면 잊습니다.
5. 테스트 다섯 (§7).
6. 화면.

1번이 실패하면 나머지가 전부 없습니다. 그래서 1번을 가장 먼저, 가장 작게
해 봅니다.

## 9. 아직 모르는 것

- **구글이 실제로 다르게 답하는지.** `searchAlongRouteParameters` 가
  `locationBias` 와 얼마나 다른 결과를 내는지 재 보지 않았습니다.
  **이것이 이 계획의 전부입니다.** 별 차이가 없으면 안 합니다.
- **요금 등급을 정말 안 올리는지.** 필드마스크가 아니라 요청 파라미터라서
  안 올린다고 읽었지만, 구글 문서의 search-along-route 페이지는 SKU 를
  말하지 않습니다. 콘솔의 청구 내역으로 확인해야 합니다.
- **어느 구간을 기본으로 삼을지.** 같은 날 연달아 있는 두 곳 사이가 가장
  자연스럽지만, 그 둘은 대개 가까워서 결과가 빌 수 있습니다(§4). 첫 곳과
  마지막 곳 사이가 나을 수도 있습니다. 실제로 재 보고 정합니다.
- **화면에서 어떻게 열지.** 두 곳 사이를 누르는 자리가 지금 없습니다.
  `trip/[id].tsx` 의 구간 표시 옆에 붙일지, 추천 시트 안에서 고르게 할지.
  그려 보고 정합니다.
- **폴리라인이 이미 있는지 서버가 아는 방법.** `RouteService` 가 답을
  메모리에 들고 있는지, 매번 구글에 묻는지 코드를 더 읽어야 합니다. 이것이
  3.3 과 `callsOf` 값을 정합니다.
