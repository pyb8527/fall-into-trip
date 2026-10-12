# 숙소를 그날 동선 앞뒤에 — 아침은 어젯밤 숙소에서, 저녁은 오늘 숙소까지

> `verdict.md` 5번에서 **재설계 권장**(후보마다가 아니라 그날 동선의 앞뒤에 숙소를)으로
> 받은 것의 실행 계획입니다(2026-10-12).
>
> **지었음 — 2026-10-12.** 백엔드(`RouteService.compare` · `gapOf` · `stayEnds` · `legsOf`,
> `DayExtrasController` 의 `morning` · `evening`), 프런트(`ComparedGaps` 타입, `staySeq`,
> 날 카드의 두 구간 블록, `MovingNote`), 시험(`StayLegsTest` 7, `group-access.test.mjs` [5-1] 4,
> `icon.test.mjs` [8] 1 고침)까지 들어갔습니다. 계획과 달라진 것은 §10 에 적었습니다.
> **남은 것:** §8 의 4 — 구글 키가 있는 서버에서 숙소를 적은 날을 펼쳐, 아침 구간이 전날
> 호텔에서 나오는지 · 숙소를 고치면 구간이 다시 나오는지 · 화면에서 두 블록이 어떻게
> 읽히는지(§9 첫 줄)를 사람이 봐야 합니다. 확인용 서버에는 키가 없어 `/route/compare` 가
> 400 으로 끊기므로, 실제 구글 응답이 실린 `morning` · `evening` 은 아직 한 번도 못 봤습니다.

## 1. 하려는 것

하루를 펼치면 장소와 장소 사이에 세 수단의 이동 시간이 붙습니다
(`trip/application/RouteService.java:228-272` `compare()`). 그런데 **숙소는 그 줄에 없습니다.**
`compare()` 는 그날 장소 목록(`:237`)만 두 개씩 짝지어 묻고, 숙소는 `Day` 의 다른 칸
(`trip/domain/Day.java:58-81`)이라 끼지 않습니다.

그래서 하루를 짤 때 가장 먼저 묻는 두 구간이 안 나옵니다.

- **「호텔에서 첫 곳까지 몇 분」** — 아침에 몇 시에 나가야 하나
- **「마지막 곳에서 호텔까지 몇 분」** — 밤에 몇 시에 끊어야 하나

사람은 지금 「길찾기」 로 구글 지도를 따로 열거나, 숙소를 장소로 한 번 더 넣습니다. 뒤의
우회는 `Day.java:59-66` 머리말이 막으려던 바로 그것입니다 — 숙소가 「3번 장소」 가 되고,
다녀온 곳 수에 들어갑니다.

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 | 새로 / 고쳐 씀 |
|---|---|---|
| 그날 밤 숙소와 좌표 | `Day.java:68-81` — `stayName` · `stayLat` · `stayLng` · `stayPlaceId` · `stayNote`. 머리말(`:59-66`)이 「하루 동선을 펼 때 어디서 시작하는지」 를 위해 좌표를 받는다고 이미 적어 둠 | 그대로 |
| 여행의 날을 차례대로 | `DayRepository.findAllByTripIdOrderBySortAsc` | 그대로 |
| 구간 하나 묻기 · 캐시 · 실패 1분 | `RouteService.java:551-581` `leg()`, 열쇠는 좌표 · 수단 · 시각(`:587-593`) | 그대로 — 숙소 구간도 이 길 |
| 좌표만 있는 임시 장소 | `fromHere()`(`:454-462`)가 `Place.builder()` 로 「여기」 를 만들고 `withEnds("me", …)` 로 끝 이름을 바꿈 | 같은 수법 |
| 그 날 그 시각 | `departureFor()`(`:521-545`) — 시각이 없으면 09:00 | 그대로 |
| 세 수단 · 빠른 것 · 싼 것 · 말 안 되는 걷기 빼기 | `compare()` 안(`:253-269`), `dropSillyWalk`(`:350-365`), `pick`(`:386-411`) | 떼어서 함께 씀 |
| 한도 | `MAX_COMPARE_LEGS = MAX_LEGS = 24`(`:68`, `:87`) | 숙소 구간도 이 안에서 셈 |
| 화면의 구간 블록 | `app/trip/[id].tsx` `GapBlock`(`:3953-3960` 에서 그림, 본체 `:4087-`) | 그대로 — 숙소 구간도 같은 블록 |
| 구간을 다시 묻는 열쇠 | `daySeq`(`app/trip/[id].tsx:825-833`) — 장소 번호 · 좌표 · 구글 번호 | 고쳐 씀 (숙소 좌표를 넣음) |
| 「오늘 이동에 ○분」 | `MovingNote`(`app/trip/[id].tsx:2571-2594`) | 고쳐 씀 (숙소 구간을 더함) |
| 숙소를 고치면 다시 읽기 | `PATCH /api/days/{id}`(`DayController.java:33-44`) → `invalidate.ts` 가 `trip` 을 알림 → 일정이 다시 읽힘 | 그대로 |
| 숙소 카드 | `app/trip/[id].tsx:3047-3097` — 날 머리, 장소 목록 위 | 그대로 |

## 3. 버리는 것

### 3.1 후보 카드마다 「숙소에서 ○분」 — 버립니다

Airbnb 의 모양입니다. 추천 카드 한 장마다 Routes 1 이고, `docs/2026-09/verdict.md` 4번이
`routingSummaries` 를 반대한 것과 같은 자리입니다. 추천 판은 이미 숙소 기준 직선거리를 냅니다
(`RecommendService.java:213-214`, `components/recommend-sheet.tsx:127-132`).

### 3.2 그날 숙소를 아침 출발점으로 — 버립니다

`Day.stay` 는 「그날 **밤** 자는 곳」 입니다. 그날 숙소에서 출발시키면 체크아웃하고 옮기는
날 아직 들어가지도 않은 호텔에서 출발합니다. **아침은 전날 밤 숙소**입니다.

### 3.3 `GET /api/days/{dayId}/route` 에 붙이기 — 버립니다

verdict 의 값 표는 `RouteService.of` 도 고친다고 적었습니다. 화면은 그 길을 안 씁니다 —
프런트에서 `/route` 를 부르는 자리가 없고(`/route/compare` 만, `app/trip/[id].tsx:849`),
서버 안에서도 `DayExtrasController.java:36` 하나뿐입니다. 안 쓰는 길에 같은 것을 붙이면
두 곳을 같이 고쳐야 할 일만 늡니다.

### 3.4 숙소 구간을 지도에 선으로 — 버립니다

지도에는 숙소 핀이 없습니다(프런트에서 `stay` 를 쓰는 곳은 날 카드와 추천 판뿐). 끝이
안 보이는 선이 하나 그려지면 「이 선은 어디로 가는 것인가」 를 묻게 됩니다. 숫자만 목록에
둡니다. 숙소 핀을 지도에 올리는 것은 이 계획 밖입니다.

### 3.5 동선 정리가 숙소를 고려하기 — 이번에는 안 합니다

`RouteTidy` 는 숙소를 옮기지 않습니다(verdict 5번). 다만 「숙소에서 가까운 곳을 맨 앞에」
처럼 **끝점으로 쓰는 것**은 따로 따질 일이고, 이 계획은 보여 주기까지만 합니다.

### 3.6 숙소 구간의 「방금 바뀜」 표시 — 버립니다

장소 사이 구간은 수단이 바뀌면 잠깐 표시됩니다(`changedGaps`, `app/trip/[id].tsx:952-979`).
숙소 구간은 숙소를 고칠 때만 바뀌고, 그때는 사람이 방금 숙소 판을 닫은 참이라 무엇이
바뀌었는지 압니다.

## 4. 갈 곳

```
[날 하나를 펼친다]
      │ GET /api/days/{dayId}/route/compare            (이미 부르는 길)
      ▼
 RouteService.compare
      │ requireCanRead → 못 보면 404
      │ days = findAllByTripIdOrderBySortAsc(tripId)
      │ ends = stayEnds(days, day)
      │    morning: 바로 앞 날(sort 하나 앞)의 숙소 — 좌표가 있을 때만
      │    evening: 이 날의 숙소 — 좌표가 있을 때만
      │    숙소와 첫(마지막) 곳이 100m 안이면 그 구간은 없음
      │
      │ 한도 24 안에서:  morning 1 → 장소 사이 (남은 만큼) → evening 1 (안 잘렸고 남았으면)
      │ 구간마다 세 수단 → leg() → 캐시 · 없으면 구글(1씩 셈)
      ▼
 { gaps: [...그대로],
   morning: Gap{fromId:"stay", toId:첫곳}   | null,
   evening: Gap{fromId:마지막곳, toId:"stay"} | null,
   note, trimmed }
      │
      ▼
 화면:  [숙소 카드]
        어젯밤 숙소(○○호텔)에서  ── GapBlock ──
        [1. 첫 곳]
         ── GapBlock ──
        …
        [마지막 곳]
        오늘 숙소(△△료칸)까지    ── GapBlock ──
        「오늘 이동에 ○시간 ○분」  ← 숙소 구간 포함
```

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `backend/src/main/java/net/weeniebeenie/fit/trip/application/RouteService.java` | `compare()`(`:228-272`)를 고칩니다. ① 장소가 하나뿐이어도 숙소 구간은 나올 수 있으니 `list.size() < 2` 조기 반환(`:238-240`)을 「장소 0이면」 으로 바꿉니다. ② 구간 하나를 세 수단으로 묻는 몸통(`:253-269`)을 `gapOf(from, to, day, counters)` 로 떼어 셋이 함께 씁니다. ③ `static StayEnds stayEnds(List<Day> ordered, Day day)` 를 새로 — 숙소 좌표로 임시 `Place` 를 만들어 돌려줍니다. ④ `Compared`(`:328`)에 `morning` · `evening` 을 더합니다. ⑤ 숙소 구간도 `noteFor` 의 셈(`longEnough` · `transitFound`)에 넣습니다 |
| `backend/src/main/java/net/weeniebeenie/fit/trip/api/DayExtrasController.java` | `compare()`(`:46-58`)가 `morning` · `evening` 을 응답에 싣습니다(`null` 이어도 실음 — 칸이 있는지가 모양으로 안 갈리게) |
| `backend/src/test/java/net/weeniebeenie/fit/trip/application/StayLegsTest.java` | 새로 만듭니다(§7) |
| `frontend/src/api/types.ts` | 비교 응답 타입을 따로 둡니다 — 지금은 `app/trip/[id].tsx:845-849` 안에 적혀 있음. `morning?: Gap \| null`, `evening?: Gap \| null` |
| `frontend/src/app/trip/[id].tsx` | `daySeq`(`:825-833`)에 **앞 날 숙소 좌표와 이 날 숙소 좌표**를 붙입니다 — 안 붙이면 숙소를 바꿔도 구간을 다시 안 묻습니다. 날 카드(`DayCard`, `:2719-`)의 장소 목록 앞뒤에 `GapBlock` 둘과 「어젯밤 숙소(…)에서」 · 「오늘 숙소(…)까지」 머리 한 줄. `MovingNote`(`:2571-2594`)에 둘을 더함 |

`chosenOf`(`:893-897`)는 고치지 않습니다. 고른 수단을 `gap.fromId` 로 기억하는데, 아침
구간의 `"stay"` 는 장소 번호와 안 겹치고, 저녁 구간의 `fromId`(마지막 곳)는 장소 사이
구간의 출발점으로 쓰이지 않는 번호입니다 — 마지막 곳에서 나가는 장소 사이 구간은 없습니다.
지도 선(`:1000-1018`)과 `gapAfter`(`:1023-1030`)도 `gaps` 만 보므로 손대지 않습니다.

## 6. API

| | |
|---|---|
| 메서드 · 경로 | `GET /api/days/{dayId}/route/compare` — **이미 있는 길**, 응답 칸만 늚 |
| 권한 | `TripAccessPolicy.requireCanRead`(`RouteService.java:231`) — 동행만. 남의 날짜 · 없는 날짜 모두 **404**. 앞 날의 숙소는 같은 여행 안이라 따로 묻지 않음 |
| 요청 | 그대로 |
| 응답 | `{ gaps, note, trimmed, morning, evening }`. `morning` · `evening` 은 `Gap`(`:429-431`)과 같은 모양 — `fromId`/`toId` 중 숙소 쪽이 `"stay"` |
| 실패 | 401, 404, 400(경로 안내 꺼짐 — 키 없음, `:233-235`), 429(문턱) — 모두 그대로 |

### 6.1 구글 호출

| | |
|---|---|
| `touchesGoogle` | 변화 없음 — `/route/compare` 이미 있음(`GoogleQuotaFilter.java:62`) |
| 날 하나를 펼칠 때 | **구간 최대 둘 더**, 세 수단이라 **최대 6** 더. 셈은 `ask()` 의 `quota.spend(…, 1)`(`:599`) 그대로 |
| 한도 | 숙소 구간도 24 안. 장소가 25곳인 날은 아침 구간이 장소 사이 하나를 밀어내고 `trimmed` 가 켜짐 |
| 캐시 | 같은 캐시 — 걷기 · 차 6시간, 대중교통 20분, 실패 1분(`:98-108`). 열쇠가 좌표라 같은 호텔 · 같은 첫 곳이면 다시 안 나감 |
| 요금 등급 | 안 오름 — 필드마스크 그대로(`:635-638`) |

숙소를 날마다 같게 두는 여행(`stayForward`, `DayController.java:40`)은 아침 · 저녁 구간이
날마다 끝 하나를 공유하지만, 다른 끝(첫 곳 · 마지막 곳)이 날마다 달라 캐시를 나눠 쓰지는
못합니다. 하루를 처음 펼칠 때 6이 더 나간다고 보고 셉니다 — 시간 한도 150(`GoogleQuota.java:62`)
의 4%.

### 6.2 스키마

없습니다. 숙소 칸은 이미 있고(`Day.java:68-81`), 구간은 메모리에만 둡니다.

### 6.3 다시 읽기 열쇠

새 열쇠가 없습니다. `/route/compare` 는 구글에 묻는 길이라 열쇠 밖입니다(`invalidate.ts:61-63`).
숙소를 고치면 `PATCH /api/days/{id}` 가 `trip` 을 알리고(`invalidate.ts` `case 'days'`),
일정이 다시 읽히면 **고친 `daySeq`** 가 바뀌어 구간을 다시 묻습니다. `daySeq` 에 숙소를 안
넣으면 이 사슬이 끊깁니다 — §5 에서 가장 빠뜨리기 쉬운 줄입니다.

## 7. 테스트

확인용 서버에는 구글 키가 없어 `/route/compare` 가 400 으로 끊깁니다(`icon.test.mjs` [8]이
그렇게 봅니다). 그래서 **어느 구간을 묻는가** 는 단위 시험이, **누가 부를 수 있는가** 는
HTTP 시험이 봅니다. `DepartureTimeTest` 가 같은 이유로 그렇게 섰습니다(`docs/fix-transit-time.md` §5).

**`StayLegsTest.java`(새로) — 7** (`stayEnds` 와 한도 나누기)

| 무엇을 | |
|---|---|
| 둘째 날 아침 = 첫째 날 숙소 | 그날 숙소가 아님 |
| 첫째 날은 아침 구간 없음 | |
| 앞 날에 숙소 이름만 있고 좌표가 없으면 없음 | |
| 그날 숙소가 없으면 저녁 구간 없음 | 마지막 날(집에 가는 날) |
| 숙소가 첫 곳과 100m 안이면 그 구간 없음 | 숙소를 장소로도 넣은 사람 |
| 장소 하나뿐인 날도 아침 · 저녁이 나옴 | 조기 반환을 고친 것 |
| 장소 25곳 → 아침 1 + 사이 23, 저녁 없음, `trimmed` | 한도 24 |

**`backend/src/test/http/group-access.test.mjs` — 3** (「동행자만 부를 수 있는가」)

- 같은 모임 동행이 숙소를 적은 날의 `/route/compare` → 404 가 아님(키 없으면 400)
- 모임 밖 사람 → **404** (403 이 아님)
- 앞 날이 **다른 여행**의 날일 수 없음 — 내 여행 둘을 만들고 각각 숙소를 적은 뒤, 둘째
  여행의 첫 날 응답이 404 · 400 · `morning: null` 중 하나(남의 숙소가 안 새어 나옴)

**`backend/src/test/http/icon.test.mjs`** — [8]의 「키가 없으면 꺼져 있다고 알림」 조건에
`200` 일 때 `"morning" in r.data` 도 봅니다(1 고침).

## 8. 순서와 의존

1. 백엔드 — `gapOf` 떼어 내기(동작 그대로), 그다음 `stayEnds` 와 단위 시험, 그다음 `compare()`
   와 응답 칸. `./gradlew build`.
2. 프런트 — 타입, `daySeq`, 날 카드의 두 블록, `MovingNote`. `npm run typecheck`.
3. HTTP 시험.
4. 키가 있는 서버에서 숙소를 적은 날 하나를 펼쳐 봅니다. 아침 구간이 **전날** 호텔에서
   나오는지, 숙소를 고치면 구간이 다시 나오는지.

먼저 서야 하는 다른 계획은 없습니다. `plan-kakao-routes.md` 가 나중에 들어오면 숙소 구간도
같은 `leg()` 를 지나므로 따로 할 일이 없습니다.

## 9. 아직 모르는 것

- **아침 구간이 빈 날을 사람이 어떻게 읽을지.** 첫째 날 · 숙소를 안 적은 날은 아침 블록이
  아예 없습니다. 그 빈자리가 「숙소를 적어 주세요」 로 읽힐지, 그냥 없는 것으로 읽힐지는
  화면을 그려 봐야 압니다(verdict 「아직 모르는 것」). 지금 계획은 아무 말도 안 하는 쪽입니다.
- **아침 구간의 출발 시각.** 숙소에는 시각이 없어 `departureFor` 가 09:00 으로 묻습니다.
  첫 곳에 「07:30」 이 적혀 있으면 그보다 늦은 시각표로 묻게 됩니다. 「첫 곳 시각에 도착」
  으로 물으려면 대중교통의 `arrivalTime` 을 써야 하고, 그건 `ask()` 를 고치는 일이라 이번에
  안 합니다. 얼마나 자주 어긋나는지는 실측 전입니다.
- **날의 차례와 날짜가 다를 때.** 「앞 날」 을 `sort` 로 잡습니다. 사람이 날을 끌어 차례를
  바꿔 날짜와 어긋나게 둔 여행이 있다면, 날짜로 앞 날을 잡는 것이 맞을 수 있습니다. 그런
  여행이 실제로 있는지는 모릅니다.
- **100m 라는 문턱.** 숙소를 장소로도 넣은 사람을 가리려는 숫자이고, 잰 값이 아닙니다.

## 10. 지으면서 계획과 달라진 것

구현에 들어가기 전에 적습니다(2026-10-12).

| 계획 | 실제 | 왜 |
|---|---|---|
| `morning` · `evening` 은 `null` 이어도 응답에 실음(§5) | **없으면 안 실립니다** — `note` 와 같습니다 | `application.yml:25` 의 `default-property-inclusion: non_null` 이 맵 값의 `null` 도 뺍니다. `note` 가 이미 그렇게 내려가고(`DayExtrasController` 「없으면 안 실립니다」), 이 하나 때문에 전역 설정을 틀 수는 없습니다. 프런트 타입은 `morning?: Gap \| null` 이라 둘 다 받습니다. 그래서 `icon.test.mjs` [8]도 「`"morning" in r.data`」 가 아니라 「있으면 `Gap` 모양」 으로 봅니다 |
| `daySeq` 에 숙소 좌표를 넣음(§5, §6.3) | **`staySeq` 를 따로 두고 `/route/compare` 의 열쇠에만 더합니다** | `daySeq` 는 구간만이 아니라 영업시간(`/places-info`)을 다시 묻는 열쇠이고, 사람이 고른 수단(`picked`)을 비우는 열쇠이기도 합니다. 숙소를 고칠 때마다 영업시간을 다시 사 오고 장소 사이에서 고른 수단까지 잃을 까닭이 없습니다. 「숙소를 고치면 구간을 다시 묻는다」 는 사슬은 그대로 이어집니다 |
| `gapOf(from, to, day, counters)`(§5 ②) | `gapOf(from, to, day)` 가 `Gap` 만 돌려주고, 셈(`longEnough` · `transitFound`)은 부르는 쪽이 돌려받은 `Gap` 을 보고 합니다 | 셈 칸을 넘겨 안에서 고치게 하면 세 자리가 같은 변수를 손댑니다. 대중교통이 나왔는지는 `Gap.options` 에 이미 있습니다 |
| `stayEnds(List<Day>, Day)` 하나(§5 ③) | `stayEnds` 에 더해 **`legsOf(places, ends, max)`** — 100m 거르기와 한도 24 나누기를 구글 없이 잴 수 있게 떼어 냄 | §7 의 「100m」 · 「25곳」 시험이 구글 키 없이 서려면 어느 구간을 묻는지가 순수한 셈이어야 합니다 |
| (없음) | 프런트가 `morning.toId` · `evening.fromId` 가 **지금 보는 날의** 첫 곳 · 마지막 곳일 때만 그립니다 | `routeLines` · `gapAfter` 가 이미 그렇게 거릅니다 — 날을 바꾸는 동안 어제의 아침 구간이 오늘 위에 붙지 않게 |
