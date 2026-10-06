# route-animation — 지도 위 이동 애니메이션

> 2026-10-06. 일정의 이동을 기울인 지도 위에서 따라가며 보여 주는 일입니다.
> 특히 구글이 경로를 안 주는 **일본 대중교통 구간**을 노선 모양대로 움직이게 합니다.

## 읽는 순서

```
survey.md     밖에서는 어떻게 하나 (14개)
    v
verdict.md    무엇을 받고 무엇을 버리나        ← 맨 위 표가 최신 기준선
    v
plan-*.md     받은 것마다 하나씩
```

## 이미 있는 것 (계획의 바닥)

| 부품 | 하는 일 |
|---|---|
| `lib/tilt-map.web.ts` | 지도 ID 로 기울인 벡터 지도 세우기 |
| `lib/journey.web.ts` | 카메라 · 탈것. `travel(from, to)` 는 `from.path` 가 있으면 그 길로, 선 끝이 200m 넘게 벗어나면 곧게(`routeOf`) |
| `lib/vehicle-scene.web.ts` · `public/models` | three.js 3D 탈것 |
| `lib/vehicles.ts` | 수단 → 탈것(`transit` → 기차) · 빠르기 · 곡선 |
| `lib/polyline.ts` | 구글 경로선 풀기 |
| `components/trip-map-3d.web.tsx` | 여행 상세 「3D」 — 찾아 둔 길대로 |
| `components/replay-stage.web.tsx` | 요약의 동선 다시 보기 — **아직 곧게** |
| `api/types.ts` `Move` | 사람이 적는 수단 · 분 · 경유(via) · 비용 |

## 계획 다섯 — 이 순서로

| # | 문서 | 무엇 | 서버 | 크기 |
|---|---|---|---|---|
| 1 | [`plan-tilt-fallback.md`](plan-tilt-fallback.md) | 벡터 지도가 래스터로 내려가면 3D 접기 | 없음 | 작음 |
| 2 | [`plan-rail-jp.md`](plan-rail-jp.md) | 일본 노선 모양을 따라가기 (N02) | 없음 | **큼** |
| 3 | [`plan-replay-ending.md`](plan-replay-ending.md) | 재생 끝의 통계 카드 · 이 여행의 사진 | 없음 | 작음 |
| 4 | [`plan-replay-path.md`](plan-replay-path.md) | 요약 재생도 찾은 길 · 노선대로 | 작은 수정 | 중간 |
| 5 | [`plan-video-spike.md`](plan-video-spike.md) | 영상 내보내기 — 실측 먼저 | 없음 | 실측 |

**의존**
- 1 은 맨 먼저입니다. 뒤의 것이 모두 기울인 지도에 기댑니다.
- 2 의 `railPath()` 를 4 가 그대로 씁니다. 그래서 2 → 4.
- 3 · 5 는 따로 섭니다.

## 하지 않기로 한 것

`verdict.md` 끝 절. 실사 3D 지도, deck.gl, ODPT, NAVITIME, 駅すぱあと, 찍은 자리에 사진 띄우기, 경로선 DB 저장.
