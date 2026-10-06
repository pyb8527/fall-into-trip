# 계획 — 벡터 지도가 래스터로 내려가면 3D 를 접는다

> `verdict.md` 14번(찬성). 1차 — 재빌드도 서버 변경도 없습니다.
> 아직 코드는 한 줄도 바뀌지 않았습니다.

## 1. 하려는 것

**지금 안 되는 것**
- `hasTiltMaps()`(`lib/tilt-map.web.ts:28`)는 **지도 ID 가 있는지만** 봅니다.
- 그런데 구글 문서가 **모바일 웹의 벡터 지도는 아직 실험적**이고, 하드웨어 가속이 꺼진 기기에서는 **래스터로 내려간다**고 적습니다(`survey.md` 14).
- 래스터로 내려가면 기울기 · 회전이 안 되고, three.js 탈것(WebGL Overlay View)도 안 섭니다. 사람에게는 **납작한 지도 위에 탈것 없이 카메라만 움직이는 고장 난 화면**으로 보입니다.

**지금 사람이 어떻게 우회하나** — 못 합니다. 3D 단추가 보이니 누르게 됩니다.

## 2. 이미 있는 것

| | 어디 |
|---|---|
| 기울인 지도 세우기(첫 idle 까지 기다림) | `lib/tilt-map.web.ts:47-70` `createTiltMap` |
| 지도 ID 없으면 평평한 지도로 | `hasTiltMaps()` — `trip/[id]` 3D 단추, `card/[id].tsx:597` |
| `getRenderingType` 검사 | **없음** (검색 0) |

## 3. 버리는 것

- WebGL 지원 여부를 따로 재는 검사(`canvas.getContext('webgl2')`) — 지도가 이미 판단한 결과(`getRenderingType`)를 믿는 편이 맞습니다. 둘이 엇갈리면 지도 쪽이 실제로 그리는 것입니다.

## 4. 갈 곳

```
3D 를 켬 / 동선 다시 보기를 엶
   → createTiltMap()
   → 첫 idle 뒤 map.getRenderingType()
        VECTOR  → 지금처럼
        RASTER  → throw NotVector
   → 부르는 쪽이 받아서
        여행 상세: 3D 를 접고 평평한 TripMap 으로, 짧은 안내
        요약:     평평한 TripMap 재생(지도 ID 없을 때와 같은 길)
   → 이 기기에서 한 번 내려갔으면 다음부터 3D 단추를 숨김
```

## 5. 닿는 파일

| 파일 | 바뀌는 것 |
|---|---|
| `frontend/src/lib/tilt-map.web.ts` | `createTiltMap` 끝에서 렌더링 종류 확인. 래스터면 `NotVectorError` 를 던짐. `tiltWorks()` — 이 기기에서 내려간 적이 있는지(아래) |
| `frontend/src/components/trip-map-3d.web.tsx` | `createTiltMap` 실패를 받아 `onUnavailable()` 을 부름 |
| `frontend/src/app/trip/[id].tsx` | `onUnavailable` 이면 3D 를 끄고 평평한 지도로. 3D 단추를 `hasTiltMaps() && tiltWorks()` 일 때만 |
| `frontend/src/components/replay-stage.web.tsx` | 같은 실패를 받아 평평한 재생으로 |
| `frontend/src/app/card/[id].tsx:597` | 기울인 무대를 고를 때 `tiltWorks()` 도 봄 |

**"이 기기에서 내려간 적이 있다"** 는 `localStorage` 한 칸(`fit.tilt.raster`)에 둡니다. 서버에 안 보냅니다. 열지 못하면(사생활 보호 모드) 매번 시도합니다.

## 6. API 계약

없습니다. 화면만 바뀝니다.

## 7. 구글을 부르나

새로 부르지 않습니다. 지도는 이미 띄우는 그 지도입니다.

## 8. 스키마

없습니다.

## 9. 테스트

서버가 안 바뀌므로 HTTP 시험은 없습니다.
- `npm run typecheck`
- 크롬 개발자 도구에서 하드웨어 가속을 끈 프로필(또는 `--disable-gpu`)로 3D 단추와 동선 다시 보기를 엽니다. 평평한 지도로 돌아가고, 다시 열 때 3D 단추가 안 보이는지 봅니다.
- 하드웨어 가속을 켠 프로필에서는 지금과 같은지 봅니다.

## 10. 순서와 의존

이 계획이 맨 먼저입니다. `plan-rail-jp.md`, `plan-replay-path.md` 가 모두 기울인 지도 위에서 움직입니다.

## 11. 아직 모르는 것

- **실제로 래스터로 내려가는 폰이 얼마나 되는지.** 실측 전입니다.
- 웹뷰(안드로이드 · iOS)에서 `getRenderingType()` 이 첫 idle 에 이미 확정돼 있는지, 조금 뒤에 바뀌는지. 바뀐다면 `renderingtype_changed` 이벤트를 같이 들어야 합니다.
- 한 번 내려간 기기가 업데이트 뒤에는 될 수도 있습니다. 숨긴 3D 단추를 언제 다시 보일지(앱 판이 바뀌면 지우기 등)는 정하지 않았습니다.
