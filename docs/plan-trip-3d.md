# 여행 상세의 「3D」 보기 — 붙일 자리

> 2026-10-06. 아직 안 지었습니다. 동선 다시 보기(여행 요약 · 동선)의 3D 가 잘
> 되면 여행 상세에 붙입니다. 그때 바로 시작할 수 있게 부품을 떼어 두고, 붙일
> 자리를 여기 적어 둡니다.

## 하려는 것

1. 여행 상세 지도에 「3D」 단추. 누르면 평평한 지도가 기울인 지도로 바뀝니다.
2. 3D 에서 장소(일정 줄이나 지도 핀)를 누르면, 지금 있는 곳에서 그 장소까지
   탈것이 갑니다 — 동선 다시 보기와 같은 탈것 · 빠르기 · 카메라.
3. 「이동 시간」으로 길을 찾아 둔 구간이면 **찾은 길대로** 갑니다(일자로 달리지 않고).

## 이미 있는 부품

| 부품 | 하는 일 |
|---|---|
| `lib/tilt-map.web.ts` | `hasTiltMaps()` · `createTiltMap(div, center)` — 지도 ID 로 벡터 지도를 세우고 처음 그려질 때 돌려줌 |
| `lib/journey.web.ts` | `createJourney(map)` — 카메라와 3D 탈것. `travel(from, to)` 가 장소를 눌렀을 때 쓸 것 |
| `lib/vehicle-scene.web.ts` | three.js + 모델(public/models). journey 가 알아서 받음 |
| `lib/vehicles.ts` | 무엇을 타는지(적어 둔 이동 → 거리) · 시간 · 곡선 · 카메라 배율 |
| `lib/polyline.ts` | 구글 경로 선 풀기 |

### `journey.travel` 쓰는 법

```ts
const map = await createTiltMap(box, { lat, lng });
const j = createJourney(map);
await j.ready;                      // 3D 탈것을 받을 때까지(첫 이동부터 제 탈것)
j.park(here);                       // 지금 고른 장소에 서 있기

// 장소를 누르면
const ok = await j.travel(
  { lat: here.lat, lng: here.lng, color, mode: here.move?.mode,
    path: decodePolyline(chosenOf(gap)?.polyline) },   // 찾은 길(있으면)
  { lat: there.lat, lng: there.lng, color },
);
// ok === false 면 가는 도중에 다른 장소를 눌러 끊긴 것 — 지금 자리에서 새 곳으로 꺾는다
```

- `path` 는 **이 장소에서 다음 장소까지** 의 선입니다. 끝이 두 곳에서 200m 넘게
  떨어져 있으면 다른 구간 선으로 보고 안 쓰고 곧게 갑니다(`routeOf`).
- 붙어 있지 않은 두 곳(1번 → 5번)을 누르면 길이 없으니 곧게 갑니다. 사이 곳들을
  거쳐 가게 하려면 `travel` 을 곳마다 이어 부르면 됩니다(await 로 차례대로).

## 붙일 때 정할 것 · 걸릴 것

- **같은 그림판에 둘을 두지 않습니다.** 평평한 `TripMap`(styles · 마커 · 동선)과
  기울인 지도는 지도 ID 때문에 한 지도로 못 합칩니다(`mapId` 를 쓰면 `styles`
  가 무시됨). 「3D」 단추는 **지도 상자 안의 지도를 갈아 끼우는 것**으로 하고,
  핀 · 선은 3D 쪽에서 다시 그립니다(replay-stage 의 점 · 선 그리기를 떼어 쓰면 됨).
- **핀 누르기:** 기울인 지도에서도 `google.maps.Marker` 클릭이 됩니다. 일정 줄을
  누르는 것은 지금처럼 `activeId` 로 받으면 됩니다.
- **값:** 벡터 지도는 평평한 지도와 같은 셈(지도 불러오기)이고, 길 찾기는 이미
  찾아 둔 것(gaps)만 씁니다 — 3D 때문에 구글 호출이 늘지 않습니다.
- **폰 웹뷰:** three.js 조각(약 900KB)과 모델(약 1.4MB)은 3D 를 처음 켤 때만
  받습니다. 중급 폰에서 버벅이면 3D 단추를 넓은 화면 · 좋은 기기에만 내는 것도
  방법입니다.
- **지도 ID 가 없는 빌드**에서는 `hasTiltMaps()` 가 거짓 — 「3D」 단추를 안 냅니다.
