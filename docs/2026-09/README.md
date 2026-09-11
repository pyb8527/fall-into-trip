# 2026년 9월 조사 — 어디까지 왔나

> 조사 → 판단 → 계획까지 끝났고, **구현이 절반쯤 갔습니다** (2026-09-11).
>
> | 상태 | 계획 |
> |---|---|
> | **끝남** — [`docs/done/`](../done/) 으로 옮겼습니다 | 홈의 D-day, 장소 비용, 영수증의 쓴 돈, 구글 문턱 |
> | **끝남** — 계획 문서가 없던 것 | `verdict.md` §11.1 (커밋 `5e2126b`) |
> | **끝남** — `V21` | [`plan-news.md`](plan-news.md) (커밋 `39e2f14`, 접기는 `a8fe6bd`) |
> | **반쯤** | [`plan-places-fields.md`](plan-places-fields.md) · [`plan-booking-paste.md`](plan-booking-paste.md) |
> | **아직 안 함** | [`plan-tip-used.md`](plan-tip-used.md) · [`plan-search-along-route.md`](plan-search-along-route.md) · [`plan-app-offline.md`](plan-app-offline.md) · [`plan-widget.md`](plan-widget.md) |
>
> **마이그레이션 번호가 당겨졌습니다.** `V20` 을 장소 비용이,
> `V21` 을 소식함이 썼습니다. `plan-tip-used.md` 는 **`V22`** 로 갑니다 —
> 그 문서는 아직 옛 번호로 적혀 있습니다.
>
> **계획에 없던 일이 둘 나왔습니다.** `plan-quota.md` 는 조사에서 나온 것이
> 아니라 실제로 막혀서 재 본 것이고, 장소 비용 작업 중에 원래 있던 결함
> 둘(`Expense.placeId` 미검증, `Versioned.check` 인자 뒤집힘)이 나왔습니다.
> 계획서가 예고한 일보다 **코드를 만지다 나온 일**이 적지 않습니다.

## 문서

이 폴더에는 **두 갈래**가 있습니다. 슬러그가 같아서 한 폴더에 있지만 근거가
다릅니다 — 한쪽은 밖에서 본 것이고, 다른 쪽은 이미 안에 있는 것입니다.

### 갈래 A — 밖에서 본 것 (`survey.md` → `verdict.md`)

| 문서 | 무엇 |
|---|---|
| [`survey.md`](survey.md) | 경쟁 앱·플랫폼·불평에서 모은 열다섯 개. 판단 없음 |
| [`verdict.md`](verdict.md) | 그 열다섯을 코드와 규칙에 비춘 판정 |
| [`plan-booking-paste.md`](plan-booking-paste.md) | 붙여 넣은 예약 확인서를 기기 안에서 칸으로 (2번) |
| [`../done/plan-receipt-spend.md`](../done/plan-receipt-spend.md) | 영수증에 쓴 돈 한 줄. 통화는 나란히 (13.1) |
| [`plan-app-offline.md`](plan-app-offline.md) | 앱에서도 안 터질 때 일정이 보이게 (1번) |
| [`plan-widget.md`](plan-widget.md) | 잠금화면에 남은 날 (14번) |
| [`plan-places-fields.md`](plan-places-fields.md) | Places 필드 넷을 한 번에 재고 정한다 (6·7·8·9) |
| [`plan-search-along-route.md`](plan-search-along-route.md) | 가는 길 위에서 찾기 (3번) |

### 갈래 B — 이미 안에 있는 것 (`docs/ideas.md` → `verdict-ideas.md`)

| 문서 | 무엇 |
|---|---|
| [`verdict-ideas.md`](verdict-ideas.md) | `docs/ideas.md` 의 셋 + 장소 비용 이야기의 판정 |
| [`plan-dday.md`](../done/plan-dday.md) | 홈에서도 며칠 남았는지 (`ideas.md` 2번) — **끝나서 `docs/done/` 으로 옮겼습니다** |
| [`plan-news.md`](plan-news.md) | 소식함 — 내가 없는 동안 무엇이 바뀌었나 (`ideas.md` 1번) |
| [`plan-tip-used.md`](plan-tip-used.md) | 내가 남긴 한 줄이 쓰였다는 것 (`ideas.md` 3번) |
| [`../done/plan-place-cost.md`](../done/plan-place-cost.md) | 장소의 비용과 가계부를 잇는다 |

### 두 갈래가 만나는 곳

**`verdict.md` §11.1 과 `plan-news.md` 가 같은 것을 다룹니다.** 순서가 정해져
있습니다 — `plan-news.md` 머리가 적어 두었습니다:

> `verdict.md` §11.1 이 이보다 한 단계 앞입니다. 새 엔드포인트 없이 일정
> 화면에서 `updatedBy`·`updatedAt` 을 바로 쓰는 쪽이고 서버를 안 건드립니다.
> 그것을 먼저 하고, 소식이 여러 여행에 걸쳐 모여야 할 때 이 문서로 넘어옵니다.

**`verdict.md` 5번(입구 좌표)과 `plan-tip-used.md` 도 이어집니다.** 5번을
반대한 근거가 "구글에서 입구를 사 오면 `PlaceTip` 을 적을 이유가 줄어든다"
였고, `plan-tip-used.md` 가 바로 그 `PlaceTip` 을 세우는 계획입니다.

계획을 파일 하나씩 따로 쓰는 것이 규칙입니다. `plan-places-fields.md` 만
넷을 묶었고, 그 이유를 문서 §0 에 적었습니다.

## 이번 조사에서 가장 쓸모 있었던 것

### 조사한 열다섯 중 다섯이 이미 있었습니다

| 후보 | 어디에 |
|---|---|
| 오프라인 일정 (웹) | `lib/keep.ts` — 커밋 `5a89dad`·`c5ae757` |
| D-day (목록) | 커밋 `5a89dad`. 홈 쪽은 이번에 `3653a1d` 로 끝났고 셈이 `lib/countdown.ts` 로 모였습니다 |
| 챙길 것 / 내일 알림 | `TripItem`, `TripReminder` |
| 자연어 추천 + 온디바이스 | `RecommendService`, `lib/intent.ts`, `lib/intent.web.ts` |
| 다녀온 여행 요약 | `app/card/[id].tsx` — 영수증과 다시 보기 |

**"이미 있는지" 부터 확인하라는 1번 규칙이 이번 조사의 3분의 1을 걸러
냈습니다.** 이 확인을 건너뛰었으면 계획 다섯 개가 있는 것을 또 만드는
문서였을 것입니다.

### `GoogleQuotaFilter` 가 못 보는 값이 있습니다

`callsOf`(`support/quota/GoogleQuotaFilter.java:52-70`)는 **구글 호출 횟수**만
셉니다. 그런데 Places API (New) 는 **필드마스크에 무엇을 적었는지로** 요금
등급이 넷으로 갈립니다.

즉 **호출을 한 번도 더 안 하면서 청구액을 올리는 길**이 있고, 문턱은 그것을
통과시킵니다.

지금 우리는 `rating`·`userRatingCount` 때문에 이미 **Enterprise** 입니다.
최근 1년에 열린 필드 대부분은 그 위의 **Enterprise + Atmosphere** 에 있습니다.
`verdict.md` 가 4·5·10 번을 반대한 근거가 이것입니다.

**앞으로 필드를 더할 때는 등급을 함께 적습니다.** `verdict.md` 0.2 에
표로 두었습니다.

## 문서가 실제와 갈려 있던 곳

계획을 쓰다 세 군데를 찾았습니다. 코드가 아니라 **문서가** 틀린 자리입니다.

| 어디 | 무엇이 틀렸나 | 어떻게 했나 |
|---|---|---|
| `recommend.md` 머리 | "아직 코드는 한 줄도 바뀌지 않았습니다" — 0·1·3단계가 들어가 있습니다 | **고쳤습니다.** `docs/done/recommend.md` 로 옮기고 머리에 상태 상자를 얹었습니다 |
| `recommend.md` §10 | "웹용 WASM 모델 — 하지 않기로 한 것" — `@mlc-ai/web-llm` 으로 했습니다 | **고쳤습니다.** 그 줄에 취소선과 사유를 달았습니다 |
| `app/card/[id].tsx:32` | "들른 곳과 **거리**" — 코드에 거리가 없습니다 | **아직 안 고쳤습니다.** `../done/plan-receipt-spend.md` §3.4 에서 주석을 고치기로 |

`recommend.md` 를 고치는 것이 **0차**였고, 끝났습니다. 문서는
[`docs/done/recommend.md`](../done/recommend.md) 에 있습니다.

## 커밋할 때 빼야 하는 것

이 폴더에 `.omc/state/sessions/…/pre-tool-advisory-throttle.json` 이
들어와 있습니다. 작업 도구가 남긴 것이고 문서가 아닙니다.

같은 것이 저장소 안에 여러 군데 있습니다 — `backend/src/main/java/**` 안
(`docs/done/recommend.md` §13 이 적어 둔 것), `frontend/src/app/**` 안
(`frontend/src/app/.omc/`, `frontend/src/app/(app)/.omc/`). **자바 소스
트리와 화면 트리에 있을 것이 아닙니다.** 이 조사와 무관하지만 같이
지우는 것이 맞습니다.

## 무엇부터 하나

### 0차 — 문서 (코드 변경 없음) — **끝났습니다**
`recommend.md` 를 [`docs/done/`](../done/) 으로 옮기고 머리와 §10 을 고쳤습니다.

### 0차 — 지금 사람을 막고 있는 것 — **끝났습니다**

> 커밋들은 [`../done/plan-quota.md`](../done/plan-quota.md) §10 에.
> 아래는 고치기 전에 재 본 기록입니다.

**이 표에 없던 것이 하나 있습니다.** 기능이 아니라 고장이라 계획 문서가
없었는데, 재 보니 실제로 쓰는 사람을 막고 있습니다.

| | 무엇 | 왜 먼저인가 |
|---|---|---|
| **0** | **구글 쿼터가 엉뚱하게 닳는 것** | 오늘 처음 검색해도 429 가 납니다 |

2026-09-11 에 잰 것입니다. 구글 키가 없어 **구글을 한 번도 안 부르는**
서버에서, 갓 가입한 계정이 **없는 날짜**에 13번 요청하자 한도에 걸렸습니다.
그 뒤 첫 장소 검색이 429 였습니다.

원인이 넷입니다.

| | 무엇 | 어디 |
|---|---|---|
| 1 | 경로만 보고 **부를 것 같은 횟수**를 미리 뺍니다. 404 든 캐시 적중이든 키가 꺼져 있든 똑같이 뺍니다 | `GoogleQuotaFilter.callsOf` |
| 2 | 추정치가 양쪽으로 틀립니다. `/places-info` 는 12로 빼지만 1시간 캐시라 대개 0, `/route/compare` 는 3으로 빼지만 실제로는 최대 36 | `PlaceInfoService:54`, `RouteService:172,180` |
| 3 | **막힌 요청도 계속 쌓습니다.** 한도를 넘은 뒤에도 `addAndGet` 을 합니다 | `GoogleQuota.take` |
| 4 | "하루" 가 달력이 아니라 **첫 사용부터 구르는 24시간**입니다 | `GoogleQuota:79` |

고치는 방향은 규칙(`부름 단위로 셉니다`)을 지킵니다. 세는 곳은 한 군데로
두되 **진짜 나갈 때** 셉니다 — 필터는 바닥난 사람을 먼저 돌려보내기만 하고,
구글을 실제로 부르는 네 자리가 캐시를 지나 요청을 보낼 때 1씩 씁니다.

**계획 문서가 아직 없습니다.** 시작할 때 `../done/plan-quota.md` 를 씁니다.

### 1차 — 재빌드도 서버 변경도 없음 — **거의 끝났습니다**

| | 계획 | 갈래 | 상태 |
|---|---|---|---|
| ~~0~~ | ~~홈의 D-day~~ | B | **끝남** `3653a1d` · [`done/`](../done/plan-dday.md) |
| ~~1~~ | ~~장소 비용 ↔ 가계부~~ | B | **끝남** `70b0d8f`·`654b4c1` · [`done/`](../done/plan-place-cost.md) |
| ~~2~~ | ~~`verdict.md` §11.1 — 누가 손댔는지~~ | A | **끝남** `5e2126b`. 계획 문서가 없던 것입니다 |
| ~~3~~ | ~~영수증에 쓴 돈~~ | A | **끝남** `758aac3` · [`done/`](../done/plan-receipt-spend.md) |
| 4 | [`plan-booking-paste.md`](plan-booking-paste.md) | A | **반쯤** — 웹은 `dda7e7e`. 아래 |

**4번만 남았고, 그것도 반쯤 갔습니다.** 웹 쪽이 들어갔지만 그 문서 §9 가
걸어 둔 관문 — "1.5B 가 이 일을 해내는지" — 를 **못 넘었습니다.** 재려던
PC 의 디스크가 모자라 모델을 못 받았습니다. 앱 쪽은 EAS 빌드가 필요해
2차로 미뤘습니다.

**쓰는 사람이 직접 재야 합니다.** 못 해내면 접기로 한 계획이고, 되돌리는
법까지 §10 에 적혀 있습니다.

### 2차 — EAS 재빌드 한 번에 묶어서
| | 계획 |
|---|---|
| 3 | [`plan-app-offline.md`](plan-app-offline.md) |
| 4 | [`plan-widget.md`](plan-widget.md) |

**2026-09-11 에 정했습니다 — 지금은 시작하지 않습니다.** EAS 재빌드를 따로
굽지 않고, 앱 쪽 개발을 할 때 한 번에 묶어 올리기로 했습니다. 그때까지 이
둘은 대기입니다.

그래서 순서가 이렇게 됩니다 — **0차 → 1차 → 3차 → (앱 작업 때) 2차.**
아래 "3차" 는 이름만 3차이고 실제로는 2차보다 먼저 갑니다.

굳이 묶는 이유가 있습니다. 두 계획 다 네이티브 모듈이 붙어
`expo-updates` 로는 안 들어갑니다. 한 번 구울 때 같이 넣는 편이,
재빌드를 두 번 하고 그 사이에 옛 빌드를 들고 있는 사람을 만드는 것보다
낫습니다.

### 3차 — 서버 작업
| | 계획 | 갈래 | 상태 |
|---|---|---|---|
| 5 | [`plan-places-fields.md`](plan-places-fields.md) | A | **반쯤** — 9.1 은 `7a01fbd`. 나머지 셋은 **구글 키가 있어야** 재 볼 수 있어 멈췄습니다 |
| ~~6~~ | [`plan-news.md`](plan-news.md) | B | **끝남** — 앞단(§11.1)은 `5e2126b`, 본체는 `39e2f14`(`V21`). 올린 당일 추천·댓글·표를 한 줄로 접었습니다(`a8fe6bd`) — §11 |
| 7 | [`plan-tip-used.md`](plan-tip-used.md) | B | 아직. `plan-news.md` 와 같은 화면의 아래층. 마이그레이션은 **`V22`** |
| 8 | [`plan-search-along-route.md`](plan-search-along-route.md) | A | 아직 |

5번에서 **계획서가 짚은 것보다 한 줄이 더 나왔습니다.** `FUTURE_OPENING` 만
문제인 줄 알았는데 `CLOSED_TEMPORARILY` 도 "영업 중" 으로 흐르고 있었습니다.
잠시 닫은 가게도 지금 가면 못 들어갑니다.

`../done/plan-place-cost.md` 가 여기 있었는데 1차로 올라갔다가 끝났습니다.

갈래 B 의 순서는 `verdict-ideas.md` 가 정한 것이고, 여기서는 갈래 A 와
섞어 놓기만 했습니다. 둘의 상대 순서는 `plan-news.md` 가 적어 둔 의존
(1차 2번 → `plan-news.md` → `plan-tip-used.md`) 만 지켰습니다.

## 하지 않기로 한 것

근거는 `verdict.md` 의 "하지 않기로 한 것" 에 하나씩 적어 두었습니다.
요약만 옮깁니다.

| 안 하는 것 | 한 줄 이유 |
|---|---|
| `routingSummaries` (결과마다 소요시간) | 가장 비싼 등급으로 올라가는데 `callsOf` 는 못 봅니다 |
| `entrances`·`navigationPoints` (입구 좌표) | 같은 등급 상승 + `PlaceTip` 이 값을 치릅니다 |
| 구글 생성 요약 | 같은 등급 상승 + 모든 요약에 신고 통로를 둘 의무 |
| 개업 예정 가게 섞기 | "갔더니 휴무" 보다 "아직 안 열었음" 이 나쁩니다 |
| 위치 정밀도 선택 (Polarsteps 식) | 자취가 쌓여 있어야 성립합니다. `LiveService` 에 정면으로 걸립니다 |
| 여행 영상·사진책 | 서버에 파일을 안 쌓습니다 |
| MCP · 대화형 도우미 연동 | 들어오는 문이 하나라는 것이 값을 치릅니다 |
| Gmail 메일함 연동 | 계정 연동과 토큰 보관이 새로 생깁니다 |
| 사진·PDF OCR | 새 네이티브 의존 + iOS 전용 |

## 아직 모르는 것 — 계획을 시작하기 전에 답해야 하는 것

각 계획의 §9 에 다 있습니다. 그중 **여러 계획을 동시에 막는 것** 셋만 여기
모읍니다.

1. ~~**앱이 실제로 쓰이는 비중.**~~ — **답이 났습니다(2026-09-11).** 값어치를
   재는 대신 **시점**을 정했습니다. 앱 쪽 개발을 할 때 2차 둘을 한 번에
   굽습니다. 그때까지 EAS 재빌드는 안 합니다.
2. **요금 등급별 실제 단가.** 4·5·10 번 반대의 근거가 "한 칸 올라간다" 이고
   금액은 안 봤습니다. 생각보다 싸면 뒤집힐 판정입니다.
3. **프런트 테스트 틀.** `readIntent`·`readBooking` 같은 순수 함수가 늘고
   있는데 `frontend/package.json` 에는 `typecheck` 뿐이고 테스트 파일이
   하나도 없습니다. 어느 계획에도 넣지 않았습니다 — 기능보다 큰 결정입니다.

## 조사에서 못 채운 자리

- **레딧을 못 봤습니다.** 크롤러가 `reddit.com` 에서 막혀, 레딧을 인용한
  리뷰 매체를 거쳐 봤습니다. `survey.md` 11번의 근거가 특히 약했고,
  `verdict.md` 는 그 근거를 버리고 코드에서 확인한 것으로 바꿨습니다.
- **경쟁 앱을 직접 써 보지 않았습니다.** 리뷰 글의 말을 옮긴 대목이 있고,
  `survey.md` 에 어디가 그런지 적어 두었습니다.
- **숫자를 적지 않았습니다.** 평점·다운로드·MAU 는 신뢰할 출처를 못 찾아
  아예 뺐습니다.
