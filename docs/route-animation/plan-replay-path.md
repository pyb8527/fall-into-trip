# 계획 — 요약의 동선 다시 보기도 찾은 길 · 노선대로

> `verdict.md` 1번(조건부 찬성). 3차 — 서버를 조금 고칩니다.
> 아직 코드는 한 줄도 바뀌지 않았습니다.

## 1. 하려는 것

**지금 안 되는 것**
- 여행 상세 3D 는 찾아 둔 길대로 갑니다(`app/trip/[id].tsx:1053`).
- 요약의 동선 다시 보기는 **곧게** 갑니다. `card/[id].tsx:415-430` 이 재생 점에 `path` 를 안 넣습니다. `replay-stage` 는 `JourneyPoint` 를 받으므로 넣기만 하면 따라갑니다(`replay-stage.web.tsx:37` `StagePlace = JourneyPoint & …`).

**왜 그냥 넣지 않나**
- 요약은 대개 **끝난 여행을 한참 뒤에** 봅니다. 구글 길은 서버 **메모리에만** 있고(도보·차 6시간, 대중교통 20분 — `RouteService.java:98-99`), 지금 `/route/compare` 는 캐시에 없으면 **구글을 부릅니다**.
- 재생 한 번에 날짜마다 구간 수 × 수단 수만큼 부르게 됩니다. 볼 때마다 사 오는 셈입니다.

## 2. 이미 있는 것

| | 어디 |
|---|---|
| 구간 비교 | `GET /api/days/{dayId}/route/compare` — `trip/api/DayExtrasController.java:46` → `RouteService.compare()`(`:228`) |
| 캐시 | `RouteService.leg()` `:551-579` — `cache.get(id)` 가 맞으면 그것, 아니면 `ask()` |
| 할당량 | `GoogleQuotaFilter.touchesGoogle` `:62` — `/route/compare` 는 구글 길로 셈 |
| 선 풀기 | `lib/polyline.ts` |
| 화면이 고른 수단 | `trip/[id].tsx` `chosenOf(gap)` |
| 일본 전철 선 | `plan-rail-jp.md` 의 `railPath()` |

## 3. 버리는 것

- **재생 때 새로 부르기** — 위 이유.
- **경로선을 DB 에 남기기** — Routes 정책상 대부분 캐시 불가(`survey.md` 13). 메모리에만.
- **여행 상세에서 고른 수단을 요약에 기억시키기** — 사람이 고른 수단은 지금도 `Move.mode` 로 남습니다. 그것을 씁니다.

## 4. 갈 곳

```
요약 → 동선 탭 → 재생 준비
  → 날짜마다 GET /api/days/{id}/route/compare?cachedOnly=true
       서버: 캐시에 있는 구간만 담아 돌려줌. 구글을 안 부름
  → 구간마다 path 고르기
       1) 적어 둔 수단(Move.mode)과 같은 수단의 선이 캐시에 있으면 그것
       2) 없고 일본 전철 구간이면 railPath()      (plan-rail-jp §6 조건)
       3) 아니면 곧게
  → 곧게 가는 구간은 지나온 선을 점선으로 ("찾은 길이 아님")
  → ReplayStage places[i].path
```

## 5. 닿는 파일

| 파일 | 바뀌는 것 |
|---|---|
| `backend/.../trip/api/DayExtrasController.java:46` | `@RequestParam(defaultValue = "false") boolean cachedOnly` |
| `backend/.../trip/application/RouteService.java` | `compare(me, dayId, cachedOnly)`. `cachedOnly` 면 `leg()` 대신 `peek()` — 캐시에 맞으면 그 다리, 아니면 **비어 있음**(unreachable 이 아니라 "모름"). `noteFor` 는 안 붙임 |
| `backend/.../support/quota/GoogleQuotaFilter.java:62` | `cachedOnly=true` 면 구글 길로 세지 않음 — 질의 문자열을 봐야 하므로 `touchesGoogle(method, path)` 에 `query` 를 넘김 |
| `frontend/src/lib/route-path.ts` | **새로** — `pathFor(place, next, cachedGaps)` 위 1)~3). 여행 상세 3D(`trip/[id].tsx:1040-1058`)도 이것을 쓰게 바꿔 두 화면이 같은 규칙 |
| `frontend/src/app/card/[id].tsx:415-430` | 날짜마다 `cachedOnly` 로 받아 `path` 를 채움 |
| `frontend/src/components/replay-stage.web.tsx` | 길이 없는 구간의 지나온 선을 점선으로 |

## 6. API 계약

```
GET /api/days/{dayId}/route/compare?cachedOnly=true
권한   TripAccessPolicy.requireCanRead (지금과 같음)
응답   { gaps: Gap[], note: null, trimmed: boolean }
       Gap 의 options 에는 캐시에 있던 수단만. 하나도 없으면 options: []
실패   날짜 없음 · 볼 수 없음 → 404 (지금과 같음)
       경로 안내 꺼짐 → 400 (지금과 같음)
```

`cachedOnly` 를 안 주면 지금과 똑같습니다.

## 7. 구글을 부르나

- `cachedOnly=true` 는 **0** 입니다. 할당량에서도 빼야 합니다 — 안 빼면 요약을 여는 것만으로 구글 한도가 줄어듭니다.
- 할당량 필터는 요청 단위로 "구글 길인가"를 가르므로, **질의 문자열을 보는 한 줄**이 들어갑니다.

## 8. 스키마

없습니다.

## 9. 테스트

`backend/src/test/http/leg.test.mjs` 에 더합니다(이미 구간 시험이 있는 곳).

| 시험 | 기대 |
|---|---|
| 동행자가 아닌 사람이 `cachedOnly` 로 부름 | 404 |
| 캐시가 빈 날 `cachedOnly` | 200, 모든 gap 의 `options` 가 비어 있음 |
| 보통 부름 뒤 `cachedOnly` | 같은 수단 선이 그대로 옴 |
| `cachedOnly` 를 여러 번 불러도 할당량이 안 줄어드는가 | `quota.test.mjs` 방식으로 남은 수 비교 |

`./gradlew build`, `npm run typecheck`.

## 10. 순서와 의존

1. `plan-tilt-fallback.md`
2. `plan-rail-jp.md` — 일본 구간의 2) 가 여기서 섭니다. **없어도 이 계획은 섭니다**(그 구간만 곧게).
3. 서버 `cachedOnly` + 시험
4. `lib/route-path.ts` 로 규칙을 하나로 모으고 여행 상세 3D 를 먼저 옮김(같은 결과인지 확인)
5. 요약 재생에 연결

## 11. 아직 모르는 것

- **실제로 캐시가 맞는 비율.** 대중교통 20분, 도보·차 6시간이라 여행을 짠 그날이 아니면 대개 비어 있을 것입니다. 그러면 요약 재생은 일본 전철 구간 말고는 여전히 곧게 갑니다. 이것이 판정의 조건이었고, 실제로 얼마나 곧게 남는지 보고 다음을 정합니다.
- 캐시 열쇠에 출발 시각이 들어 있습니다(`fix-transit-time.md` §3.4). 요약에서 같은 열쇠를 만들 수 있는지(같은 `departureFor` 를 거치는지) 코드에서 확인합니다.
- 점선으로 그린 "찾은 길이 아님" 구간이 사람에게 어떻게 읽히는지.
