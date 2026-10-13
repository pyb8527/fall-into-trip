# 국내 걷기 · 대중교통을 카카오로 — 먼저 재고, 문턱을 함께, 결과는 메모리에만

> **2026-10-13 구글 길찾기 셈을 걷어내고 구글 지도 링크로 바꿈 — 이 계획은 접음.**
> 장소 사이 이동을 서버가 셈하지 않게 되어(`RouteService` 삭제, `/route` · `/route/compare` ·
> `/places/{id}/route` 없음) 카카오로 그 셈을 메울 자리도 없어졌습니다. 장소 사이에는 「구글
> 지도로 길찾기」 링크가 서고, 국내 길찾기가 필요하면 그 링크를 카카오맵으로 바꾸는 쪽을 따로
> 봅니다(`frontend/src/lib/directions.ts`).

> `verdict.md` 6번에서 **조건부 찬성 · 3차 맨 뒤**로 받은 것의 실행 계획입니다(2026-10-12).
> 아직 코드는 한 줄도 바뀌지 않았습니다.
>
> **이 계획은 두 덩이로 나뉩니다.** 1단계(재기)는 작고 무해해서 바로 할 수 있습니다.
> 2단계 이후(카카오를 붙이기)는 **1단계의 숫자가 나온 뒤에만** 갑니다. 숫자가 작으면
> 1단계에서 멈추고 verdict 에 그렇게 적습니다 — 그것도 이 계획의 정상적인 끝입니다.

## 1. 하려는 것

국내 일정에서 장소 사이 이동이 **걷기 · 차가 비어 나오는 일**이 있다고 짐작합니다. 구글
지도가 한국에서 도보 · 자동차 길찾기를 안 내준다는 것은 널리 알려져 있지만, **우리 서버의
Routes API 응답으로 잰 적은 없습니다**(verdict 6번 (ㄱ)). 비면 화면에는 그 수단이 빠진
구간이 남고(`RouteService.java:256` — 안 되는 수단은 목록에서 뺌), 사람은 카카오맵 · 네이버
지도를 따로 엽니다.

카카오가 2026-07-21 에 길찾기 REST 를 열었습니다(survey 6번) — 대중교통 · 도보 · 자전거.
국내 구간만 그쪽으로 물으면 빈 칸이 채워지고, 그만큼 구글 호출이 줄어듭니다.

조건은 넷입니다(verdict 6번).

| | 조건 | 이 계획의 자리 |
|---|---|---|
| (ㄱ) | 먼저 잰다 | §8 1단계 — 숫자가 2단계의 문 |
| (ㄴ) | 문턱을 함께 만든다 | §6.2 — 앱 전체 하루 한도 + 사람마다 기존 셈 |
| (ㄷ) | 결과는 메모리에만 | §6.3 — `RouteService` 의 같은 캐시 |
| (ㄹ) | 정적 지도는 안 받는다 | §3.1 |

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 | 새로 / 고쳐 씀 |
|---|---|---|
| 구간 하나 묻기 — 캐시 · 실패 1분 | `trip/application/RouteService.java:551-581` `leg()` | 고쳐 씀 — 구글 앞에 갈림길 하나 |
| 구글에 실제로 묻는 자리 | `RouteService.java:595-723` `ask()`, 셈은 `:599` | 그대로 — 카카오가 실패하면 여기로 |
| 「길이 없다」 와 「못 물어봤다」 를 가르기 | `ask()` 가 빈 답은 `Leg.unreachable`, 오류는 `null`(`:691`, `:721`), `leg()` 가 실패를 1분만 들고 있음(`:572-576`) | 같은 약속을 카카오도 지킴 |
| 빈 구간을 로그로 남김 | `:682-690` — 「경로가 비었어요」 + 물은 것 · 받은 것 | 그대로. 1단계가 그 옆에 한 줄 |
| 나라를 좌표로 가리는 상자 | `TaxiFare.java:54` 한국 상자 `33.0–38.7, 124.5–132.0` | **그대로 못 씀** — 아래 |
| 사람마다 시간 150 · 하루 700 | `support/quota/GoogleQuota.java:62, :65`, `spend()`(`:95-111`) | 그대로 — 구간 하나는 어느 문이든 1 |
| 구글에 닿는 경로 문턱 | `GoogleQuotaFilter.java:54-80` — `/route/compare` · `/route` 가 이미 들어 있음(`:62-63`) | 그대로 — 경로가 안 늚 |
| 카카오 REST 키 | `application.yml:99-102` `fit.social.kakao.rest-key`(`KAKAO_REST_KEY`) — 지금은 로그인용 | 같은 앱 키를 쓸 수 있는지가 관문(§9) |
| 화면이 그리는 길 | `frontend/src/lib/polyline.ts` 가 구글 encoded polyline 을 풂 | 그대로 — 서버가 카카오 좌표를 같은 모양으로 접어 보냄 |

`TaxiFare` 의 한국 상자는 **후쿠오카(33.59, 130.40) · 기타큐슈 · 쓰시마를 안에 품습니다.**
요금 어림에서는 일본 상자보다 먼저 걸려 「후쿠오카 택시가 원화」 가 되는 정도지만, 여기서는
후쿠오카 구간이 카카오로 나갑니다. 그래서 국내 판정은 따로 둡니다(§5 `Domestic`).

## 3. 버리는 것

### 3.1 카카오 정적 지도 — 버립니다

지도 그림 문은 `StaticMapService` 하나로 둡니다(verdict 6번 (ㄹ)). 같은 일을 하는 그림 문이
둘이면 문턱도 둘, 출처 표시도 둘입니다.

### 3.2 자전거 — 버립니다

`RouteService.Mode` 는 걷기 · 대중교통 · 차 셋입니다(`:765-769`). 자전거는 화면 어디에도 수단으로
없습니다. 카카오에 있다고 수단을 늘리지 않습니다.

### 3.3 차 — 이번에는 구글 그대로

카카오맵 REST 길찾기에 **자동차가 없습니다**(대중교통 · 도보 · 자전거). 자동차 길찾기는 카카오
모빌리티의 다른 상품이고 다른 계약입니다. 1단계에서 국내 차 구간이 많이 빈다고 나와도 이
계획으로는 못 채웁니다 — 그 숫자는 따로 적어 두고 다음 판단에 넘깁니다.

### 3.4 날 단위로 갈라 보내기 — 버립니다

부산 → 후쿠오카처럼 한 날에 국내 · 해외가 섞입니다. **구간마다** 양 끝이 둘 다 국내일 때만
카카오로 보냅니다(verdict 6번 「지켜야 할 것」).

### 3.5 카카오가 「길 없음」 이라고 하면 구글에 한 번 더 묻기 — 버립니다

「못 물어봤다」(오류 · 시간 초과 · 한도)면 구글로 내려앉습니다. 그러나 카카오가 **답을 했는데
길이 없다**면 그것이 답입니다. 몇백 미터에 대중교통이 없는 것은 카카오에서도 맞는 답이고,
그때마다 구글에 또 물으면 국내 구간 호출이 두 배가 됩니다.

### 3.6 `GoogleQuota` 이름 바꾸기 — 버립니다

카카오 구간도 사람마다의 셈은 `GoogleQuota.spend` 로 합니다. 이름이 맞지 않게 되지만, 이름을
바꾸면 이 계획과 상관없는 네 자리(`PlaceSearchService` · `PlaceInfoService` · `RouteService` ·
`StaticMapService`)를 같이 건드립니다. 클래스 머리말에 한 줄만 더합니다.

## 4. 갈 곳

```
[날 하나를 펼친다] GET /api/days/{dayId}/route/compare        (그대로)
      │ requireCanRead → 못 보면 404
      ▼
 구간마다, 수단마다  leg(from, to, mode, when)
      │ 캐시에 있으면 그것                                   (그대로)
      ▼
 viaOf(mode, from, to)                               ── 순수 함수, 단위 시험
      │  mode ∈ 켜 둔 수단(설정, 기본 WALK)
      │  && Domestic.has(from) && Domestic.has(to)
      │  && KakaoRouteQuota.take()   ← 앱 전체 하루 한도
      ├── 아니면 ──────────────────────────────▶ 구글 ask()   (그대로, 1 셈)
      ▼
 KakaoRouteClient.ask()      quota.spend(사람, 1)  ← 구간 하나는 어느 문이든 1
      │  시간 제한 3초 / 5초
      ├── 오류 · 시간 초과 · 모르는 상태값 (null) ──▶ 구글 ask()
      ├── 「길 없음」 ───────────▶ Leg.unreachable   (구글에 안 물음)
      ▼
 Leg { seconds, meters, polyline(카카오 좌표 → 구글 모양으로 접음), fare, source:"kakao" }
      │ 같은 캐시 — 걷기 6시간, 대중교통 20분, 실패 1분
      ▼
 화면: GapBlock 의 그 수단 옆에 「카카오맵」 한 마디
```

## 5. 닿는 파일

**1단계 — 재기**

| 파일 | 무엇을 |
|---|---|
| `backend/src/main/java/net/weeniebeenie/fit/trip/application/Domestic.java` | 새로. `static boolean has(double lat, double lng)` — 한국 상자 안이면서 **(위도 34.8 아래 && 경도 128.9 위)는 뺌**. 그 모서리에 쓰시마 · 규슈가 있고, 부산(35.1)은 그 위, 제주 · 여수 · 거제는 경도 128.9 왼쪽입니다 |
| `backend/src/main/java/net/weeniebeenie/fit/trip/application/RouteService.java` | `ask()` 끝의 세 갈래(답 · 빈 답 · 오류)에서 양 끝이 국내면 `log.info("국내 구간 | mode={} | 결과={}", mode, 있음/빔/실패)` 한 줄. **좌표는 안 남깁니다** — 셀 것은 비율이지 자리가 아닙니다 |
| `backend/src/test/java/net/weeniebeenie/fit/trip/application/DomesticTest.java` | 새로(§7) |

**2단계 이후 — 카카오를 붙이기** (1단계 숫자가 문을 연 뒤에만)

| 파일 | 무엇을 |
|---|---|
| `backend/src/main/java/net/weeniebeenie/fit/trip/application/KakaoRouteClient.java` | 새로. `dapi.kakao.com` 의 `GET /v2/routing/walk` · `/v2/routing/publictraffic`, 머리 `Authorization: KakaoAK {키}`, 연결 3초 · 읽기 5초. 응답의 `status` 로 셋을 가름 — 답 / 길 없음 / 못 물어봄(`null`). 몸통 이름(`start_x` · `totalTime` · `path.points` …)은 문서 요약으로 본 것이라 2단계 첫 줄에서 실제 응답으로 맞춥니다(§9) |
| `backend/src/main/java/net/weeniebeenie/fit/trip/application/PolylineCodec.java` | 새로. 좌표 목록 → 구글 encoded polyline. 카카오 점은 `[x, y]` = `[경도, 위도]` 순서 |
| `backend/src/main/java/net/weeniebeenie/fit/support/quota/KakaoRouteQuota.java` | 새로. **앱 전체** 하루 셈 하나. 넘으면 `take()` 가 false → 구글로. 메모리(`GoogleQuota` 와 같은 이유 — 서버가 다시 뜨면 0 부터, 그래서 한도를 무료 1,000 보다 낮게 둠) |
| `backend/src/main/java/net/weeniebeenie/fit/trip/application/RouteService.java` | `leg()`(`:551-581`)의 `ask()` 앞에 갈림길. `static Via viaOf(…)` 와 `static boolean fallBack(KakaoAnswer)` 를 순수 함수로. `Leg`(`:777-787`) · `Option`(`:419-421`)에 `source` |
| `backend/src/main/java/net/weeniebeenie/fit/support/quota/GoogleQuota.java` | 머리말에 「카카오 구간도 사람마다의 셈은 여기서」 한 줄(§3.6) |
| `backend/src/main/resources/application.yml` | `fit.kakao-routes.enabled`(`KAKAO_ROUTES_ENABLED`, 기본 **false**), `modes`(`KAKAO_ROUTES_MODES`, 기본 `WALK`), `daily-cap`(`KAKAO_ROUTES_DAILY_CAP`, 기본 900), `key`(`KAKAO_MAP_KEY`, 비우면 `KAKAO_REST_KEY`) |
| `frontend/src/api/types.ts` | `GapOption` 에 `source?: 'google' \| 'kakao'` |
| `frontend/src/app/trip/[id].tsx` | `GapBlock`(`:4087-`)에서 고른 수단의 `source` 가 `kakao` 면 「카카오맵」 한 마디. 시간이 구글과 다른 까닭을 사람이 읽을 수 있게 — 「아는 것만 말합니다」 의 짝 |

## 6. API

새 엔드포인트가 없습니다.

| | |
|---|---|
| 메서드 · 경로 | `GET /api/days/{dayId}/route/compare` — 그대로. `POST /api/places/{placeId}/route`(지금 여기서)도 `ask()` 를 직접 부르므로(`:458`) 2단계에서 같은 갈림길을 지나게 할지 정함 — 기본은 **안 지남**(위치가 들어가는 길이라 새 바깥문에 보내지 않음) |
| 권한 | `TripAccessPolicy.requireCanRead`(`RouteService.java:231`) — 그대로. 남의 · 없는 날짜 **404** |
| 요청 | 그대로 |
| 응답 | `gaps[].options[].source` (`"google"` / `"kakao"`)가 늚 |
| 실패 | 그대로 — 401, 404, 400(구글 키 없음), 429(사람 문턱). **카카오 한도가 차도 오류가 아닙니다** — 구글로 내려앉습니다 |

### 6.1 구글 호출

| | |
|---|---|
| `touchesGoogle` | 변화 없음 — 경로가 안 늚 |
| 호출 수 | 국내 구간 · 켜 둔 수단만큼 **줄어듦.** 카카오가 실패하면 그 구간은 전처럼 구글 1 |
| 요금 등급 | 안 바뀜 — 구글에 보내는 몸통 · 필드마스크 그대로(`:635-638`) |

### 6.2 카카오 문턱 (조건 ㄴ)

| 셈 | 어디서 | 왜 |
|---|---|---|
| 사람마다 시간 150 · 하루 700 | `GoogleQuota.spend(사람, 1)` — 카카오에 보내기 직전 | 고리를 도는 화면 하나를 끊는 일은 문이 어디든 같습니다 |
| **앱 전체 하루 900** | `KakaoRouteQuota.take()` | 카카오의 무료 한도는 사람이 아니라 **앱(또는 계정)** 기준입니다(survey 6번, devtalk 공지). 넘으면 건당 10원. 구글처럼 사람마다만 세면 사람이 많아질수록 무료 한도를 넘습니다 |

하루 900 은 무료 1,000 에서 서버가 다시 뜰 때 세던 것이 사라지는 몫을 빼 둔 값이고, 잰
값이 아닙니다. 하루의 경계(자정이 한국 시각인지)는 카카오 쪽을 확인해 맞춥니다(§9).

### 6.3 캐시 (조건 ㄷ)

`RouteService` 의 캐시 하나를 그대로 씁니다(`:149-155`). 열쇠가 수단 · 좌표 · 시각이라
어느 문에서 왔든 같은 칸입니다. 디스크에 안 남깁니다. 카카오 약관이 결과를 얼마나 두게
하는지 모르므로 구글과 같은 줄(걷기 6시간, 대중교통 20분)을 따릅니다 — 모를 때는 짧은 쪽입니다.

### 6.4 스키마

없습니다. 마이그레이션 번호를 쓰지 않습니다.

### 6.5 다시 읽기 열쇠

새 열쇠가 없습니다. `/route/compare` 는 일부러 열쇠 밖입니다(`invalidate.ts:61-63`).

## 7. 테스트

확인용 서버에는 구글 · 카카오 키가 다 없습니다. 바깥으로 나가는 일은 HTTP 시험으로 못
봅니다. **어디로 보낼지 · 무엇을 읽을지** 를 순수 함수로 떼어 단위 시험이 봅니다.

**1단계 — `DomesticTest.java`(새로) 10**

| 국내 | 국내 아님 |
|---|---|
| 서울, 부산, 제주, 울릉도, 독도 | 후쿠오카, 기타큐슈, 쓰시마, 오사카, 상하이 |

**2단계 — 새로 넷, 모두 단위 시험**

| 파일 | 수 | 무엇을 |
|---|---|---|
| `PolylineCodecTest.java` | 2 | 구글 Encoded Polyline 문서의 본보기 세 점(38.5,−120.2 · 40.7,−120.95 · 43.252,−126.453)을 문서와 같은 글자로 접는가, `lib/polyline.ts` 와 같은 규칙으로 되풀리는가 |
| `KakaoRouteQuotaTest.java` | 3 | 한도까지 받음, 넘으면 false 이고 **도로 뺌**(`GoogleQuota.take` 와 같은 버릇), 날이 바뀌면 0 부터 |
| `KakaoRouteReadTest.java` | 4 | 고정 응답 셋 — 답(초 · 미터 · 요금 · 점), 「길 없음」 상태들 → 길 없음, 모르는 상태값 → `null`(못 물어봄) |
| `KakaoViaTest.java` | 6 | `viaOf` · `fallBack` — 국내 걷기 → 카카오, 해외 끝 하나 → 구글, 차 → 구글, 꺼 둔 수단 → 구글, 한도 참 → 구글, 카카오 오류 → 구글로 내려앉음 · 카카오 「길 없음」 → 안 내려앉음 |

**HTTP** — 권한이 바뀌지 않습니다. `icon.test.mjs` [8](`:98-106`)이 이미 「남은 못 봄 · 없는
날은 404」 를 봅니다. 「동행자만 부를 수 있는가」 는 `plan-stay-legs.md` §7 이
`group-access.test.mjs` 에 더하는 셋이 같은 길을 봅니다. 이 계획이 먼저 들어가면 그중 둘
(동행 → 404 아님, 남 → 404)을 이쪽에서 더합니다. `quota.test.mjs` 는 손대지 않습니다.

## 8. 순서와 의존

1. **재기.** `Domestic` 과 그 시험, `ask()` 의 로그 한 줄. 운영에 올리고 **두 주** 둡니다.
   ```bash
   docker compose logs api --since 336h | grep "국내 구간" \
     | awk -F'|' '{print $2,$3}' | sort | uniq -c
   ```
2. **판단.** 수단마다 따로 봅니다. 기준은 이렇게 미리 정해 둡니다 — 잰 값이 아니라 문을
   열지 말지의 약속입니다.

   | 국내 그 수단의 「빔」 비율 | |
   |---|---|
   | 절반을 넘음 | 그 수단을 `modes` 에 넣고 3번으로 |
   | 10% 아래 | 그 수단은 안 함 |
   | 그 사이 | 숫자를 verdict 에 적고 사람이 정함 |

   **둘 다 안 하게 되면 여기서 멈추고** `verdict.md` 6번에 숫자와 함께 「재 보니 안 해도
   됨」 을 적습니다. 1단계의 로그 한 줄은 남겨 둘지 걷을지 그때 정합니다.
3. **카카오 쪽 확인**(§9의 앞 셋). 키 · 한도 기준 · 약관. 하나라도 막히면 멈춥니다.
4. 백엔드 — `PolylineCodec` → `KakaoRouteQuota` → `KakaoRouteClient`(실제 응답 한 번 찍고
   읽기 시험 고정) → `RouteService` 갈림길. 설정은 **꺼진 채로** 올립니다.
5. 프런트 — `source` 와 「카카오맵」 한 마디.
6. 운영에서 `KAKAO_ROUTES_ENABLED=true`. 한 주 뒤 로그로 카카오 성공 · 내려앉음 · 한도 참을
   셉니다.

`plan-stay-legs.md` 와는 서로 기다리지 않습니다. 숙소 구간도 같은 `leg()` 를 지나므로, 어느
쪽이 먼저 들어가도 다른 쪽에 할 일이 생기지 않습니다. verdict 순서대로 이것이 **3차 맨 뒤**
입니다.

## 9. 아직 모르는 것

- **국내 구간에서 구글이 걷기 · 차 · 대중교통을 얼마나 비우는지.** 이 계획 전체의 문입니다.
  실측 전입니다(1단계).
- **지금 로그인용 REST 키로 길찾기를 부를 수 있는지.** 카카오 콘솔에서 그 앱에 카카오맵
  API 를 켜야 할 수 있고, 공지는 「계정에서 처음 켠 앱만 무료 한도로 바로 쓸 수 있다」 고
  적었습니다(devtalk 150764). 로그인 앱과 같은 앱이어야 하는지, 따로 만든 앱이면 비즈 지갑이
  필요한지 확인해야 합니다.
- **무료 한도의 기준과 하루 경계.** 계정 기준인지 앱 기준인지(survey 6번도 확인 못 함), 하루가
  한국 시각 자정에 끊기는지.
- **카카오 약관이 결과 저장 · 표시에 거는 조건.** 특히 **카카오 경로를 카카오 지도가 아닌
  지도 위에 그려도 되는지**, 출처 표시를 어떤 모양으로 해야 하는지. 구글 지도 위에 못 그린다면
  카카오 구간은 시간 · 거리만 내고 선(`polyline`)은 비웁니다 — 화면은 선이 없는 구간을 이미
  견딥니다(`app/trip/[id].tsx:1010` 이 `option?.polyline` 이 있을 때만 그림).
- **카카오 대중교통이 출발 시각을 받는지.** 문서 요약에는 시각 칸이 안 보였습니다. 안 받는다면
  「지금」 으로 계산할 것이고, 그건 `docs/fix-transit-time.md` §2 에서 고친 결함(11월 일정을
  새벽에 짜면 노선이 없음)을 카카오 쪽에서 되살립니다. 그래서 대중교통은 기본으로 안 켭니다
  (`modes` 기본 `WALK`). 확인 전에는 켜지 않습니다.
- **카카오 응답의 정확한 칸 이름.** `start_x` · `totalTime` · `totalDistance` · `fare` ·
  `path.points` · `ROUTE_RESULT_NOT_FOUND` 같은 이름은 문서 페이지를 요약해 본 것입니다. 4번의
  첫 줄이 실제 응답을 한 번 찍어 고정 JSON 으로 삼는 이유입니다.
- **두 주가 충분한지.** 그 사이 국내 일정을 펼친 사람이 적으면 비율이 흔들립니다. 국내 구간
  줄이 몇 개 모였는지를 비율과 함께 적고, 너무 적으면 더 둡니다.
