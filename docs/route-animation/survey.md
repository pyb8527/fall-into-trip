# 밖에서는 무엇을 하고 있나 — 지도 위 이동 애니메이션

> 2026-10-06 에 소비자 앱 · 플랫폼 기술 · 일본 노선 데이터 세 갈래를 본 기록입니다.
> 판단은 다음 문서(`verdict.md`)에서 합니다.
> 아직 코드는 한 줄도 바뀌지 않았습니다.

## 0. 이번 조사가 어디서 시작하나

### 하려는 것

일정의 이동(전철 · 비행기 · 차 · 걷기)을 **지도 위에서 기울인 카메라로 따라가며** 보여 주는 것입니다.
특히 일본 대중교통은 "긴자 → 긴자선 → 시부야"처럼 **노선 모양을 따라** 움직이게 하고 싶습니다.

### 이미 있는 것

| | 지금 | 어디 |
|---|---|---|
| 동선 다시 보기 | 여행 요약의 "동선" 탭. 기울인 벡터 지도 위에서 카메라가 탈것(비행기 등)을 따라감 | `frontend/src/components/replay-stage.web.tsx`, `app/card/[id].tsx:597-600` |
| 장소 사이 모양 | **직선** — 장소 좌표를 그대로 이음 | `replay-stage.web.tsx:182-195` |
| 비행 구간 | 직선 위에서 줌을 들었다 내리는 곡선(`arc`)만 | `replay-stage.web.tsx:311-314` |
| 지도 | 앱도 웹을 웹뷰로 띄우므로 앱·웹 모두 Google Maps JS. 기울기는 지도 ID 가 있을 때만 | `src/shell/shell.tsx:278`, `replay-stage.web.tsx` 머리 주석 |
| 실사 3D · Mapbox | **쓰지 않기로** 적혀 있음 — 따로 과금, 웹뷰에서 무거움, 구글 장소를 구글 아닌 지도에 올리면 약관 | `replay-stage.web.tsx` 머리 주석 |
| 일본 대중교통 | 구글 Routes API 가 주지 않음. 비면 "이 지역은 구글이 대중교통 길찾기를 내주지 않아요" | `trip/application/RouteService.java:279-305` |
| 도보·차 길 모양 | Routes 응답에서 `routes.polyline.encodedPolyline` 을 이미 받음(메모리 캐시만) | `RouteService.java:635-637` |

**진행 중인 작업 — 다른 세션, 2026-10-06 기준 커밋 전**
`frontend/src/components/trip-map-3d.tsx`, `trip-map-3d.web.tsx`: 여행 상세의 "3D" 보기입니다.
장소를 고르면 앞 장소에서 그곳까지 탈것이 갑니다. "이동 시간"으로 길을 찾아 둔 구간은 **그 길대로**(`places[].path`) 가고, 나머지는 곧게 갑니다.
도보·차 구간의 "실제 길 따라가기"는 이 작업이 먼저 풀고 있습니다. 이 조사는 그 다음, 즉 **일본 노선 · 비행 · 내보내기**를 주로 봅니다.

## 어디를 봤나

| 갈래 | 본 것 | 조사일 |
|---|---|---|
| 소비자 앱 | Polarsteps, Relive, Mult.dev, TravelAnimator, TravelBoast, FindPenguins, Strava Flyover, Komoot, Flighty, Google Earth, Apple Maps Flyover, Google Maps Timeline, Wanderlog, TripIt, Airbnb Travel Map, Journi | 2026-10-06 |
| 플랫폼 · 기술 | Maps JS 카메라(`moveCamera`), WebGL Overlay View, Advanced Markers, 3D Maps(`Map3DElement`), Map Tiles API, deck.gl TripsLayer, Routes API 경로선 · 약관, `geodesic` · turf `greatCircle`, 캔버스 녹화, CesiumJS, Mapbox/MapLibre | 2026-10-06 |
| 일본 노선 | Mini Tokyo 3D, 国土数値情報 鉄道(N02), ODPT, 駅すぱあと API, NAVITIME API | 2026-10-06 |

**못 본 것**
- Google Maps Platform Service Specific Terms 원문 — 연결이 막혀 2차 요약만 봤습니다.
- Polarsteps · Komoot · FindPenguins · Strava 지원 문서 원문 — 403 으로 막혔습니다.
- 일본 노선 갈래는 처음 맡긴 조사가 1시간 넘게 멈춰 끊었고, 범위를 좁혀 다시 봤습니다. 그래서 GTFS-JP, OSM 철도, 열차 위치 앱은 보지 못했습니다.

## 눈에 띈 것 먼저

- **실제 길을 따라 움직이는 곳은 영상을 만드는 앱뿐입니다.** Mult.dev, TravelAnimator 가 그렇습니다. 사람이 경로를 넣고, 구글 길찾기 결과의 선 모양을 씁니다.
- **3D 지형 위로 날아가는 앱은 모두 GPS 기록이 있어야 합니다.** Relive, Strava, Komoot, FindPenguins, Polarsteps Plus 가 그렇습니다. **일정만으로** 이것을 하는 앱은 찾지 못했습니다.
- **일본 노선 모양은 열린 데이터로 구할 수 있습니다.** 국토교통성 N02(GeoJSON), ODPT. **시각과 노선 모양을 한 번에** 주는 곳은 NAVITIME API(`/shape_transit`)였습니다.
- **구글 3D JS 에는 정해진 길을 따라가는 카메라가 없습니다.** "어디로 날아가기"와 "한 점 주위 돌기"뿐입니다. 길을 따라가려면 매 프레임 직접 계산해야 하고, FIT 는 이미 그렇게 하고 있습니다.

---

## 1. 실제 길 모양을 따라가는 재생

**한 줄** — 장소 사이를 직선이 아니라 구글 길찾기가 준 도로 모양대로 움직입니다.

**어떻게 동작하나**
- Mult.dev: 도시와 수단을 차례로 넣으면 영상이 나옵니다. **땅길(철도 포함)은 구글 지도 실제 길찾기**를 따르고 PRO 전용입니다. 하늘길은 공식 문서에 "직선"이라고 적혀 있습니다.
- TravelAnimator: 구글 지도 URL 이나 GPX 를 넣으면 실제 도로를 따라갑니다. 무료로 됩니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | 구글 Routes (이미 부름) |
| 서버 저장 | 경로선 — Routes 는 대부분 캐시 불가(아래 13) |

**출처**
- mult.dev/articles/which-types-of-routes-you-can-create-in-multdev (공식, 열람)
- travelanimator.com/hub/compare-travel-animator-and-mult-dev (공식, 열람)

**확인 못 한 것** — 일본에서 Mult.dev 의 "철도"가 실제 노선 모양인지(구글이 일본 대중교통을 API 로 안 주므로 도로일 수 있음).

> 진행 중인 `trip-map-3d` 가 도보·차 구간에서 이미 하고 있는 일입니다.

## 2. 비행 구간을 대권 호로

**한 줄** — 비행은 지구 위 최단 경로(대권)의 곡선으로 그리고 탈것이 그 위를 갑니다.

**어떻게 동작하나**
- Polarsteps: 비행·페리를 대권 호로 그린다고 합니다. **2차 출처만 있고 확인 못 함.**
- Maps JS `Polyline` 의 `geodesic: true` 로 구글이 곡선으로 그립니다. 탈것의 중간 좌표는 `google.maps.geometry.spherical.interpolate` 로 얻습니다.
- turf.js `greatCircle` 도 있지만, 7.3.2 이상에서 날짜변경선을 넘는 경로가 깨진다는 버그가 보고돼 있습니다(이슈 #3030).

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | 불필요 (Maps JS 안의 계산) |
| 서버 저장 | 없음 |

**출처**
- Maps JS Polyline 레퍼런스(공식, 이번에 직접 열지는 않음)
- npmjs.com/package/@turf/great-circle, github.com/Turfjs/turf/issues/3030

**확인 못 한 것** — Polarsteps 의 실제 그리는 방식.

## 3. 구간마다 탈것 바꾸기 · 3D 탈것

**한 줄** — 구간마다 비행기 · 기차 · 버스 · 배를 고르고, 그 모양이 길을 따라 움직입니다.

**어떻게 동작하나**
- TravelAnimator: 300개 넘는 3D 탈것 모델 중 구간마다 다르게 고릅니다. 랜드마크 3D 모델을 길가에 놓을 수도 있습니다.
- Polarsteps: 장소 사이 선을 누르면 이동 수단을 바꾸고, 수단에 따라 선을 그리는 방식이 달라집니다.
- 기술로는 Maps JS **WebGL Overlay View + three.js** 로 지도와 같은 화면에 3D 모델을 그립니다. 웹뷰에서 WebGL 화면을 잃는 경우(context lost)를 처리해야 합니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 3D 모델 파일(glTF) — 앱에 실음 |
| 푸시 | 불필요 |
| 외부 API | 불필요 |
| 서버 저장 | 없음 |

**출처**
- travelanimator.com/hub/compare-travel-animator-and-mult-dev (공식)
- polarsteps.com/stories/introducing-polarsteps-plus (공식)
- developers.google.com/maps/documentation/javascript/webgl/webgl-overlay-view (공식)

**확인 못 한 것** — 저사양 안드로이드 웹뷰에서 three.js 모델이 몇 프레임 나오는지.

> FIT 는 이미 수단별 탈것 그림(SVG 기호)을 씁니다(`replay-stage.web.tsx:497`). 바뀌는 것은 3D 모델이냐 아니냐입니다.

## 4. 영상으로 내보내기

**한 줄** — 애니메이션을 짧은 영상으로 만들어 SNS 에 올립니다.

**어떻게 동작하나**
- Mult.dev, TravelAnimator, TravelBoast, Relive, FindPenguins, Strava, Komoot 모두 결과물이 **영상**입니다. TikTok·인스타의 "여행 지도 애니메이션" 유행이 대부분 이 앱들에서 나옵니다(Mult.dev 블로그, 이해당사자 글).
- 브라우저에서 하려면 지도 캔버스를 `captureStream()` 으로 받아 `MediaRecorder` 로 녹화합니다.
  - iOS MediaRecorder 는 14.5 부터 MP4, Safari 18.4 부터 WebM 을 지원합니다(webkit.org).
  - WebGL 화면에 `preserveDrawingBuffer: true` 가 필요한데, Maps JS 를 불러오기 전에 `getContext` 를 바꿔치기하는 방법뿐입니다(2차, 공식 지원 아님).
  - DOM 마커는 캔버스에 안 찍힙니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 영상 파일 — **기기에서 만들어 기기에 저장**하면 서버 저장 없음 |
| 푸시 | 불필요 |
| 외부 API | 불필요 |
| 서버 저장 | 기기 저장이면 없음 |

**지도 영상 약관** — 구글 지오 가이드라인: 교육·오락용 온라인 영상은 허가가 필요 없지만, 출처 표시가 영상 안에서 내용 바로 곁에 있어야 합니다. Map Tiles(실사 3D)로 만든 홍보 영상은 30초 이하에 "for promotional purposes only" 표기가 필요합니다. **사용자가 만든 공유 영상이 "오락용"에 드는지는 확인 못 함.**

**출처**
- webkit.org/blog/11353 (공식)
- about.google/brand-resource-center/products-and-services/geo-guidelines (공식)
- developers.google.com/maps/documentation/tile/policies (공식)

**확인 못 한 것** — iOS WKWebView 에서 지도 캔버스 녹화가 되는지(출처끼리 엇갈림). Android WebView 도 직접 확인은 안 했습니다.

## 5. 실사 3D 지도 위 플라이오버

**한 줄** — 실제 건물·지형 사진 질감의 3D 지도 위로 날아갑니다.

**어떻게 동작하나**
- Relive(Esri 위성 + 3D 지형), Strava Flyover(Fatmap 지형), Komoot(3D 위성 지형), FindPenguins, Polarsteps Plus — 모두 **GPS 기록**을 경로로 씁니다.
- 구글 **3D Maps(`Map3DElement`)** 는 웹에서 정식 출시됐습니다. `flyCameraTo`(포물선 비행), `flyCameraAround`(한 점 주위 비행), `Polyline3DElement`, `Model3DElement`(glTF)가 있고, 2026-04 에 `Route3DElement` 가 weekly 채널에 붙었습니다. **정해진 길을 따라가는 카메라는 없습니다.**

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요(FIT 는 일정 좌표로) |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | 3D Maps — **Immersive Maps SKU**: 월 5,000건 무료, 그 뒤 1,000건당 $7 (공식 가격표) |
| 서버 저장 | 없음 |

**출처**
- mapsplatform.google.com/maps-products/3d-maps (공식)
- developers.google.com/maps/documentation/javascript/3d/animate-camera (공식, 열람)
- developers.google.com/maps/billing-and-pricing/pricing (공식)

**확인 못 한 것** — 일본 도시별 커버리지("50개국 2,500개 도시"만 확인), 웹뷰 공식 지원 여부, 약한 폰에서 2D 로 자동 전환되는지(2차).

> 지금 코드는 이것을 "따로 과금, 웹뷰에서 무거움"으로 일부러 안 쓰고 있습니다(`replay-stage.web.tsx` 머리 주석).

## 6. 장소마다 날아가는 투어

**한 줄** — 경로를 그리는 대신 장소에서 장소로 카메라가 날아가며 하나씩 보여 줍니다.

**어떻게 동작하나**
- Google Earth Projects: 장소를 슬라이드처럼 쌓고 Present 를 누르면 장소마다 날아갑니다. 장소마다 3D 시점을 저장해 둘 수 있습니다.
- Earth Studio: 키프레임으로 카메라를 짜고 KML 경로를 불러옵니다.
- Apple Maps 의 정해진 경로 자동 비행(City Tour)은 2025년에 없어졌다고 합니다(위키, 2차).

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | 2D 벡터 지도면 지금과 같음 / 3D Maps 면 5번 비용 |
| 서버 저장 | 없음 |

**출처**
- google.com/earth/outreach/learn/create-a-map-or-story-in-google-earth-web/ (공식 요약)
- google.com/earth/studio/ (공식 요약)
- en.wikipedia.org/wiki/Flyover_(Apple_Maps) (2차)

**확인 못 한 것** — Earth Studio 접근 신청 조건.

> 진행 중인 `trip-map-3d` 의 "장소를 고르면 그리로 간다"가 이 결입니다.

## 7. 재생 중 사진 · 마지막에 통계 카드

**한 줄** — 지나는 자리에 그때 찍은 사진이 뜨고, 끝에 거리·시간 같은 통계 카드가 나옵니다.

**어떻게 동작하나**
- Relive: 지나는 길에 사진이 뜨고 통계가 붙습니다(사진 100장은 Plus).
- Komoot: 3D 지형 위로 날며 사진을 보여 주고 마지막에 통계 카드.
- FindPenguins: 위치가 붙은 사진이 함께 나옵니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 사진의 위치 정보 |
| 사진·파일 | 사진 |
| 푸시 | 불필요 |
| 외부 API | 불필요 |
| 서버 저장 | 이미 있는 사진 |

**출처**
- esri.com/about/newsroom/arcwatch/relive-outdoor-adventures-with-a-new-app-and-esri-maps (2차)
- tour-magazin.de/en/tours/route-planning-3d-maps-in-komoot-premium/ (2차)
- findpenguins.com/flyover (공식, 열람)

**확인 못 한 것** — 없음.

> house-rules: FIT 는 올라온 사진의 EXIF(특히 GPS)를 지웁니다(`photo/application/PhotoService.java`). 사진을 **자리**로 붙일 수 없고, **날짜나 피드 글의 여행**으로만 붙일 수 있습니다.

## 8. 꼬리가 따라 그려지는 경로 — deck.gl TripsLayer

**한 줄** — 시간이 흐르며 지나온 길이 빛나는 꼬리처럼 그려집니다.

**어떻게 동작하나**
`getTimestamps`, `currentTime`, `trailLength` 로 꼬리 길이를 정합니다. `GoogleMapsOverlay` 의 `interleaved: true` 로 구글 벡터 지도와 같은 WebGL 화면을 써서 건물에 가려지는 효과가 납니다. 구글 공식 예제(deckgl-tripslayer)가 있습니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | 불필요 (deck.gl 라이브러리 — 새 의존) |
| 서버 저장 | 없음 |

**출처**
- deck.gl/docs/api-reference/geo-layers/trips-layer (공식)
- deck.gl/docs/api-reference/google-maps/google-maps-overlay (공식)

**확인 못 한 것** — 라이브러리 라이선스(MIT 로 알지만 이번에 확인 안 함). 열린 이슈: 벡터→래스터 전환을 못 따라감(#10789), 레이어 어긋남(#10056). interleaved 에서는 안티앨리어싱이 꺼집니다(공식).

> FIT 는 이미 "넓고 옅은 빛 위에 가는 선 한 겹"으로 지나온 길을 늘려 그립니다(`replay-stage.web.tsx` 머리 주석). 같은 효과를 의존 없이 하고 있습니다.

## 9. 일본 노선 모양 — 国土数値情報 鉄道(N02)

**한 줄** — 국토교통성이 내는 전국 철도 노선(선)과 역 데이터입니다.

**어떻게 동작하나**
- 노선 구간이 **선**으로, 역도 선(역 구간)으로 들어 있습니다. 철도 구분 · 사업자 구분 · **노선명 · 운영 회사** 속성이 붙습니다.
- 좌표계 JGD2011(위경도). 형식 GML · Shapefile · **GeoJSON**(2016년판부터).
- 최신판은 2022년도(2022-12-31 기준).
- 쓰는 방법(조사가 아니라 짐작): 출발·도착 장소에서 가까운 역을 찾고, 노선 선을 그래프로 이어 두 역 사이 경로를 구해 그 선을 따라 움직입니다. **시각표는 없습니다.**

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 데이터 파일 — 미리 가공해 앱이나 서버에 실음 |
| 푸시 | 불필요 |
| 외부 API | 없음 |
| 서버 저장 | 가공한 노선 데이터(크기 실측 전) |

**라이선스** — 2020년판 이후는 "適用する利用規約に基づく(オープンデータ)", 그 전 판은 "商用可". 商用可 데이터는 출처와 가공 사실을 밝히면 판매 소프트웨어에 넣을 수 있다고 FAQ 가 적습니다. **2020년판 이후의 "적용 규약"이 정확히 무엇인지(공공데이터 이용규약 / CC BY 호환 여부)는 확인 못 함.**

**출처**
- nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2022.html (공식, 열람)
- nlftp.mlit.go.jp/ksj/other/faq.html (공식, 검색 요약)
- geospatial.jp/ckan/dataset/060401 (G공간정보센터)

**확인 못 한 것** — 가공 뒤 도쿄·오사카만 잘랐을 때의 파일 크기. 역과 노선이 그래프로 바로 이어지는지(역이 선으로 들어 있어 이어 붙이는 작업이 필요할 수 있음).

## 10. 일본 노선 — ODPT · Mini Tokyo 3D

**한 줄** — 공공교통 오픈데이터 센터(ODPT)가 사업자의 노선 · 역 · 시각표 · 실시간 위치를 한곳에서 내주고, Mini Tokyo 3D 가 그것으로 도쿄 전철을 실시간 3D 로 움직입니다.

**어떻게 동작하나**
- **Mini Tokyo 3D** (minitokyo3d.com): 도쿄권 전철이 지도 위에서 실시간으로 움직이는 3D 지도. 코드는 **MIT** 공개(github.com/nagix/mini-tokyo-3d). 지도 타일은 **Mapbox**, 데이터는 **ODPT**(역 정보, 열차 시각표, 실시간 열차 위치·운행 상태). 빌드에 ODPT 토큰 둘(ODPT Center, Challenge 2026)이 필요합니다. 노선 모양을 어디서 얻는지는 README 에 적혀 있지 않습니다.
- **ODPT**: 노선 정보(`odpt:Railway`)와 역 정보(`odpt:Station`)를 꺼내 그래프로 이어 경로 찾기에 쓸 수 있다고 적혀 있습니다. 상업적 이용도 됩니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | ODPT API (가입 · 토큰) |
| 서버 저장 | 받은 데이터 — 라이선스에 따라 재배포 제한 |

**라이선스** — ODPT 는 데이터마다 사업자가 라이선스를 고릅니다.
- CC BY 4.0: 출처 표시하면 상업적 재배포까지 자유
- ODPT 기본 라이선스: 상업 이용은 되지만 **재배포에 제한**이 있고 바뀐 데이터를 갱신할 의무가 있음

어느 노선이 어느 라이선스인지는 데이터셋마다 봐야 합니다.

**출처**
- github.com/nagix/mini-tokyo-3d (공식, 열람)
- odpt.org/2021/06/01/news20210601_1/ (공식, 검색 요약)
- ckan.odpt.org/dataset (공식)

**확인 못 한 것** — ODPT `odpt:Railway` 가 **지리 좌표 선(모양)**을 주는지, 역 순서만 주는지. Mini Tokyo 3D 가 노선 모양을 어디서 얻는지.

> house-rules: Mini Tokyo 3D 처럼 **Mapbox 바탕**은 FIT 에 못 씁니다 — 구글 장소를 구글 아닌 지도에 올리면 약관에 걸립니다. 데이터와 연출만 참고가 됩니다.

## 11. 일본 노선 — NAVITIME API (시각과 모양을 한 번에)

**한 줄** — 일본 안의 대중교통 + 도보 최적 경로와 운임을 주고, **지도에 그릴 경로 모양**도 따로 줍니다.

**어떻게 동작하나**
NAVITIME Route(totalnavi) 에 `/route_transit`(경로 · 운임 · 환승 · 갈아타기 좋은 칸)과 `/shape_transit`(지도에 그릴 경로 모양)이 있습니다.
"긴자 14:32 → 긴자선 → 시부야 14:48"과 그 노선 모양을 둘 다 받을 수 있는 길입니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | NAVITIME — RapidAPI 요금 BASIC $0 / PRO $200·월 / ULTRA $300·월 (RapidAPI 표시 기준), 직접 계약도 가능 |
| 서버 저장 | 약관 확인 전 |

**출처**
- rapidapi.com/navitimejapan-navitimejapan/api/navitime-route-totalnavi/details (공식 마켓 페이지, 검색 요약)

**확인 못 한 것** — BASIC 무료 등급의 호출 한도, 응답을 저장·캐시해도 되는지, 구글 지도 위에 그려도 되는지(표시 조건).

## 12. 일본 노선 — 駅すぱあと API

**한 줄** — 일본 경로 검색 · 운임 엔진. 무료 플랜이 있습니다.

**어떻게 동작하나**
- **무료 플랜**: 등록 없이 쓰고, 철도 · 항공 · 배가 대상(노선버스 제외). 단, 얻는 것은 "확인용 URL" 뿐이고 운임 숫자는 안 옵니다.
- 유료: 요청 수 묶음 구매(5,000건 ¥5,500 등).
- **"路線図"(노선도) 기능의 모양(shape)은 X·Y 좌표 · 반지름** 으로 옵니다. 이건 駅すぱあと 자체 **노선도 그림 위의 좌표**로 보입니다. 지리 좌표(위경도)인지는 확인 못 했습니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | 駅すぱあと API |
| 서버 저장 | 약관 확인 전 |

**출처**
- api-info.ekispert.com/plan/ (공식)
- docs.ekispert.com/v1/api/railmap/detail.html (공식 문서)

**확인 못 한 것** — 경로 검색 결과에 **지도용 위경도 선**이 오는지.

## 13. 경로선을 얼마나 붙들어 둘 수 있나 — Routes API 약관

**한 줄** — 실제 길 모양을 재생에 쓰려면 그 선을 언제 받아 어디에 두느냐가 문제입니다.

**어떻게 동작하나**
- 공식 정책: "Most Routes API content cannot be cached." **place ID 만** 무기한 저장 가능. 그릴 때는 구글 지도 위에.
- Service Specific Terms(2차 요약): Routes 의 위경도 값은 최대 **30일** 임시 캐시를 허용한다는 요약이 있습니다. 경로선(encodedPolyline)이 여기 드는지는 확인 못 함.
- 그래서 지난 여행을 몇 달 뒤 다시 볼 때 실제 길 모양을 보이려면 **다시 불러야** 합니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | Routes — Essentials 월 10,000건 무료, 그 뒤 1,000건당 $5 (공식 가격표) |
| 서버 저장 | 메모리만(지금 방식) |

**출처**
- developers.google.com/maps/documentation/routes/policies (공식)
- developers.google.com/maps/billing-and-pricing/pricing (공식)

**확인 못 한 것** — Service Specific Terms 원문.

> house-rules: 「구글 결과는 메모리에만」(`RouteService.java` 주석). 재생할 때마다 구간 수만큼 Routes 를 부르게 되니 `GoogleQuotaFilter.callsOf` 에 적을 몫이 생깁니다.

## 14. 카메라를 직접 모는 법 — Maps JS `moveCamera`

**한 줄** — 지금 쓰는 2D 벡터 지도에서 매 프레임 center · zoom · heading · tilt 를 한 번에 바꿉니다.

**어떻게 동작하나**
공식 문서가 `requestAnimationFrame` 안에서 `moveCamera` 를 부르는 방식을 권합니다. tilt 는 대부분 줌에서 약 45° 까지이고 낮은 줌에서는 더 좁습니다.
**모바일 웹의 벡터 지도는 아직 실험적**이라고 공식 문서가 적고, 하드웨어 가속이 꺼지면 래스터로 내려갑니다(`map.getRenderingType()` 로 확인).

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | Dynamic Maps — 월 10,000건 무료, 그 뒤 1,000건당 $7 (지금과 같음) |
| 서버 저장 | 없음 |

**출처**
- developers.google.com/maps/documentation/javascript/webgl/tilt-rotation (공식, 열람)
- developers.google.com/maps/documentation/javascript/webgl/support (공식)

**확인 못 한 것** — 카메라를 움직이는 것 자체에 추가 과금이 있는지.

> FIT 의 `replay-stage` 가 이미 이 방식입니다. 래스터로 내려갔을 때의 대체 화면이 있는지는 2단계에서 봅니다.

---

## 보았지만 후보에 올리지 않은 것

| 본 것 | 왜 안 올렸나 |
|---|---|
| Strava · Komoot · Relive · FindPenguins 의 GPS 기반 3D | 위치 기록이 있어야 합니다. house-rules 「위치는 자취를 안 남깁니다」. 연출만 5·7에 반영 |
| Google Maps Timeline | 위치 기록. 애니메이션 없음 |
| Flighty | 실제 항적 데이터. 일정 앱이 가질 수 없음 |
| Wanderlog · TripIt · Journi | 경로 애니메이션 없음(확인한 범위) |
| Airbnb Travel Map | 친구 그래프 — "친구 안 함" |
| CesiumJS + Photorealistic 3D Tiles | 5번보다 무겁고 별도 렌더러. Map Tiles 정책상 캐시·오프라인 금지, Enterprise SKU(월 1,000건 무료, 그 뒤 1,000건당 $6) |
| Mapbox · MapLibre | 구글 장소를 구글 아닌 지도에 올리는 약관 문제(Service Specific Terms, 2차 요약) |
| TravelBoast | 경로 모양·카메라 모두 확인 못 함 |

## 아무도 안 하는 것

- **일정(계획)만으로 3D 재생** — 3D 를 하는 앱은 모두 GPS 기록이 필요하고, 일정 앱(Wanderlog, TripIt)은 애니메이션이 없습니다.
- **일본 전철을 노선 모양대로 따라가는 여행 재생** — Mini Tokyo 3D 는 실시간 열차 지도이지 내 여행 재생이 아니고, 영상 앱은 구글 길찾기에 기대어 일본 대중교통 모양을 확실히 못 얻습니다.
