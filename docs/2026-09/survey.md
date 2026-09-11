# 밖에서는 무엇을 하고 있나 — 2026년 9월

> 2026-09-11 에 경쟁 앱·플랫폼 문서·사용자 불평 세 갈래를 본 기록입니다.
> 판단은 `verdict.md` 에서 합니다. 여기서는 좋다·나쁘다를 쓰지 않습니다.
> 아직 코드는 한 줄도 바뀌지 않았습니다.

## 어디를 봤나

| 갈래 | 본 것 | 조사일 |
|---|---|---|
| 경쟁 앱 | Wanderlog, TripIt, Polarsteps, Lambus, Tripsy, 트리플, 마이리얼트립, Google Maps, Splitwise 계열 | 2026-09-11 |
| 최근 1년 신기능 | Polarsteps 2026 여름 릴리스, TripIt Apple Intelligence, Lambus 12.2.0(2026-01-04), Google Maps 공동 리스트 | 2026-09-11 |
| 플랫폼 | Places API (New) 릴리스 노트 2024-11 ~ 2026-08, Routes API, iOS Live Activities, Android 16 Live Updates, Expo 위젯 | 2026-09-11 |
| 불평 | 앱스토어 리뷰 요약글, 마일모아 게시판, 리뷰 매체가 인용한 레딧 | 2026-09-11 |

**레딧은 직접 못 봤습니다.** 크롤러가 `reddit.com` 에서 막혀 있어, 레딧을
인용한 리뷰 매체를 거쳐서 봤습니다. 원문을 확인한 것이 아니므로 그 대목은
아래에서 "인용의 인용" 이라고 밝힙니다.

**한 가지 사실을 먼저 적어 둡니다.** Places API (New) 는 필드마스크에 무엇을
적었는지로 요금 등급이 갈립니다. 등급은 넷입니다 — Essentials(ID only) ·
Pro · Enterprise · Enterprise + Atmosphere. 아래 후보 여럿이 이 등급표에
걸리므로, 후보마다 어느 등급인지 적었습니다. 참고로 지금
`PlaceSearchService.FIELDS` 는 `places.rating`·`places.userRatingCount` 를
달라고 하므로 이미 **Enterprise 등급**입니다(Pro 가 아닙니다).

출처: <https://developers.google.com/maps/documentation/places/web-service/text-search>
(2026-09-11 확인)

---

## 1. 오프라인으로 일정 보기

**한 줄** — 데이터가 없는 곳에서도 이미 짜 둔 일정을 펼쳐 봅니다.

**어떻게 동작하나**
사람이 여행을 한 번 열어 두면 그 일정이 기기에 남습니다. 비행기 안이나
로밍이 끊긴 곳에서 앱을 열면 마지막으로 받은 일정이 그대로 나옵니다.
Wanderlog 는 여기에 지도 타일 내려받기까지 붙이고, 내려받은 지도는 30일 뒤
지워지므로 긴 여행이면 다시 받아야 합니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 (지도 타일까지 받으면 기기 저장만 씀) |
| 푸시 | 불필요 |
| 외부 API | 불필요 |
| 서버 저장 | 0 — 기기 쪽 저장입니다 |

**왜 이것이 목록에 있나**
세 군데서 같은 말이 나왔습니다.

- Wanderlog 는 오프라인이 Pro($39.99/년) 전용이고, **이것이 앱스토어 불평
  1위**라고 리뷰 매체가 적습니다 (인용의 인용).
- 트리플은 유료도 아니라 아예 없습니다. "와이파이를 끄면 일정이 불러지지
  않습니다" 가 한국 사용자 글에 그대로 적혀 있습니다.
- tripprof 의 8개 항목 비교에서 **오프라인은 대부분의 앱이 빠뜨린 항목**으로
  분류됩니다.

**출처**
- <https://tripstone.app/blog/wanderlog-review> (2026-09-11 확인)
- <https://wanderlog.com/blog/2024/10/15/how-to-ensure-your-travel-plans-are-accessible-offline/> (2026-09-11 확인)
- <https://www.milemoa.com/bbs/board/10964010> (2026-09-11 확인)
- <https://tripprof.com/en/blog/best-trip-planning-apps-2026/> (2026-09-11 확인)

**규칙에 걸릴 수 있는 곳** — `docs/done/recommend.md` §3.2 가 "오프라인 로컬 관광지
DB" 를 이미 버렸습니다. 그 문단은 **장소 DB 를 앱에 심는 것**을 두고 한 말이라
같은 것인지 다른 것인지 2단계에서 갈라야 합니다.

**확인 못 한 것** — Wanderlog 의 오프라인이 일정만인지 지도 타일까지인지,
무료 구간에서 어디까지 열리는지. 앱을 직접 안 써 봤습니다.

---

## 2. 예약 정보를 사람이 안 옮겨 적게 하는 것

**한 줄** — 항공·숙소 예약 확인서를 앱이 읽어 일정 한 줄로 만듭니다.

**어떻게 동작하나**
갈래가 둘이고, 요구하는 것이 서로 아주 다릅니다.

**(가) 기기에서 읽기 — TripIt Pro + Apple Intelligence (2026)**
사람이 항공권 사진이나 PDF 를 iOS 공유 버튼으로 TripIt 에 넘기고 "사진에서
가져오기" 를 누릅니다. 기기 안의 iOS 파운데이션 모델이 날짜·시각·장소·예약
번호·금액을 뽑아 일정 항목을 채우고, 사람이 고친 뒤 저장합니다. TripIt 은
이것을 **"데이터가 기기를 떠나지 않는다"** 고 명시합니다. 정리 안 된 텍스트
항목(Unfiled Item)을 같은 방식으로 일정으로 바꾸는 길도 함께 열렸습니다.

**(나) 메일함을 앱이 뒤지기 — Wanderlog / TripIt 의 오래된 방식**
사람이 Gmail 계정을 연동해 두면 앱이 항공·숙소 확인 메일을 스스로 찾아
일정에 꽂습니다. Wanderlog 에서는 Pro 전용입니다.

**무엇을 요구하나**

| 항목 | (가) 기기에서 읽기 | (나) 메일함 연동 |
|---|---|---|
| 위치 | 불필요 | 불필요 |
| 사진·파일 | 사람이 고른 한 장을 기기에서만 읽음 | 불필요 |
| 푸시 | 불필요 | 불필요 |
| 외부 API | OS 모델 (iOS 전용) | Gmail OAuth |
| 계정 연동 | 없음 | 구글 계정 |
| 서버 저장 | 0 (뽑아낸 글자만 올라감) | 토큰 보관 필요 |
| 재빌드 | 네이티브 모듈 — 필요 | 불필요 |

**출처**
- <https://www.tripit.com/web/blog/news-culture/automate-travel-plans-tripit-pro-apple-intelligence> (2026-09-11 확인)
- <https://tripstone.app/blog/wanderlog-review> (2026-09-11 확인)

**규칙에 걸릴 수 있는 곳** — (가)는 "서버에 파일을 안 쌓습니다" 를 지키면서도
되는 드문 모양입니다. (나)는 구글 계정 연동이 새로 생깁니다.

**확인 못 한 것** — 안드로이드에 같은 것이 있는지. TripIt 은 Apple 쪽만
발표했습니다. `V18__flight_is_text.sql` 이 항공편을 글자로 바꿔 둔 이유가
이것과 이어지는지 2단계에서 코드를 봐야 합니다.

---

## 3. 가는 길 위에서 찾기 — search along route

**한 줄** — 두 지점을 잇는 길 **위에** 있는 곳만 골라 검색합니다.

**어떻게 동작하나**
Text Search (New) 에
`searchAlongRouteParameters.polyline.encodedPolyline` 로 경로의 인코딩된
폴리라인을 실어 보내면, 결과가 그 길 주변으로 쏠립니다.
`routingParameters.origin` 으로 출발점을 따로 덮어쓸 수 있어, 이미 길의
절반을 지나온 상태에서 검색하는 것도 됩니다. 출발점과 도착점이 같거나 아주
가까우면 결과가 비어 올 수 있다고 문서가 밝혀 둡니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 (폴리라인이 있으면 됨) |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | Places Text Search (New) — 이미 쓰는 것 |
| 서버 저장 | 0 |
| 구글 호출 | 검색 한 번. 폴리라인을 새로 받아야 하면 Routes 한 번이 더 붙음 |

**FIT 쪽 사실** — 폴리라인을 새로 만들 필요가 없을 수 있습니다.
`RouteService.java:236` 의 `Option` 레코드와 `:403` 의 `Leg` 레코드가 이미
`String polyline` 을 들고 있고, `:321-322` 의 필드마스크가
`routes.polyline.encodedPolyline` 를 달라고 합니다.

**출처** — <https://developers.google.com/maps/documentation/places/web-service/search-along-route> (2026-09-11 확인)

**확인 못 한 것** — 이 파라미터가 요금 등급을 올리는지. 문서의 그 페이지는
SKU 를 말하지 않습니다. 필드마스크 등급만 보면 올리지 않는 것처럼 읽히지만
확인 못 했습니다.

---

## 4. 결과마다 거리와 소요시간 — routingSummaries

**한 줄** — 검색 결과 하나하나에 "여기서 몇 분, 몇 미터" 가 붙어서 옵니다.

**어떻게 동작하나**
Text Search·Nearby Search 에서만 됩니다. 출발점을 주면 결과의 각 장소까지
소요시간과 거리를 구글이 계산해 함께 돌려줍니다. 사람이 보는 화면에서는
카드마다 "도보 12분" 같은 줄이 붙는 모양입니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 출발점이 필요 (좌표 또는 폴리라인 원점) |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | Places Text Search (New) |
| 서버 저장 | 0 |
| 요금 등급 | **Enterprise + Atmosphere** — 넷 중 가장 비싼 등급 |

**출처** — <https://developers.google.com/maps/documentation/places/web-service/text-search> (2026-09-11 확인)

**규칙에 걸릴 수 있는 곳** — 등급이 올라가는 것은 호출 수가 아니라 값입니다.
`GoogleQuotaFilter.callsOf` 는 **횟수**만 세므로 이 종류의 값 증가를 못
봅니다. 2단계에서 이 점을 따로 다뤄야 합니다.

**확인 못 한 것** — 실제 단가. 등급 이름만 확인했고 금액은 안 봤습니다.
`docs/done/recommend.md` §6.1 이 응답에 `distanceM` 을 적어 둔 것과 겹치는지도
코드를 봐야 압니다 — 우리가 직선거리로 이미 계산하고 있다면 이건 "도보
몇 분" 을 사는 값입니다.

---

## 5. 입구와 진입점 — entrances · navigationPoints

**한 줄** — 건물의 **입구 좌표**를 따로 줍니다.

**어떻게 동작하나**
2026-08-06 에 열렸습니다. 필드마스크에 `entrances` 와 `navigationPoints` 를
적으면 장소의 대표 좌표 말고 실제로 들어가는 자리가 함께 옵니다. 지하상가나
역과 붙은 건물에서 "지도에 찍힌 점에 도착했는데 들어갈 데가 없다" 를 줄이는
용도입니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | Places (New) — 이미 쓰는 것 |
| 서버 저장 | 0 (약관상 좌표 장기 보관은 따로 봐야 함) |
| 요금 등급 | **Enterprise + Atmosphere** |

**출처** — <https://developers.google.com/maps/documentation/places/web-service/release-notes> (2026-09-11 확인)

**FIT 쪽 사실** — 이 앱에는 `PlaceTip`(한 줄) 이 이미 있고,
`docs/ideas.md:93` 이 그 예로 **"2번 출구로 나와야 함"** 을 들고 있습니다.
사람이 적어서 푸는 문제를 구글이 값을 받고 파는 모양입니다. 겹침을 2단계에서
봐야 합니다.

**확인 못 한 것** — 한국·일본에서 실제로 데이터가 채워져 오는 비율. 새 필드는
지역마다 빈 경우가 많습니다.

---

## 6. 랜드마크로 위치를 설명하기 — addressDescriptor

**한 줄** — 주소 대신 "무엇 근처, 어느 동네 안" 으로 위치를 말해 줍니다.

**어떻게 동작하나**
2025-04-08 에 열렸습니다. 가까운 랜드마크와 그 장소를 품고 있는 지역을
관계로 적어 줍니다. 주소 체계가 사람의 길찾기와 안 맞는 곳에서 쓰라고 만든
것입니다. 인도 밖에서는 **실험 단계(experimental)** 로 표시돼 있습니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | Places (New) |
| 서버 저장 | 0 |
| 요금 등급 | **Pro** (인도 밖에서는 실험) |

**출처** — <https://developers.google.com/maps/documentation/places/web-service/release-notes> · <https://developers.google.com/maps/documentation/places/web-service/text-search> (둘 다 2026-09-11 확인)

**확인 못 한 것** — 일본에서 쓸 만한지. 일본은 주소가 블록 기반이라 이 기능이
가장 쓸모 있을 곳인데, 실험 단계라는 것 외에는 확인 못 했습니다.

---

## 7. 가까운 역 — transitStation

**한 줄** — 장소에 딸린 대중교통 역 정보를 줍니다.

**어떻게 동작하나**
2026-05-20 에 열렸습니다. 필드마스크에 `transitStation` 을 적으면 옵니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 외부 API | Places (New) |
| 서버 저장 | 0 |
| 요금 등급 | **Enterprise** — 지금 검색이 이미 쓰는 등급과 같음 |

**출처** — <https://developers.google.com/maps/documentation/places/web-service/release-notes> (2026-09-11 확인)

**FIT 쪽 사실** — `TaxiFare.java` 와 `RouteService` 의 `transitFare` 가 이미
대중교통 쪽을 다룹니다. Routes API 가 주는 것과 겹치는지 2단계에서 봐야 합니다.

**확인 못 한 것** — 이 필드가 정확히 무엇을 담는지(역 이름만인지, 거리·노선까지인지).
릴리스 노트 한 줄만 봤습니다.

---

## 8. 갈래 이름을 구글이 현지어로 — googleMapsTypeLabel

**한 줄** — `restaurant` 같은 영어 타입 대신 사람이 읽는 말로 옵니다.

**어떻게 동작하나**
2026-02-12 에 열렸습니다. 같은 날 **새 장소 타입 180개**가 함께 지원되기
시작했습니다. 2024-11-07 에도 104개가 늘었습니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 외부 API | Places (New) |
| 서버 저장 | 0 |
| 요금 등급 | **Pro** — 지금 등급보다 낮음. 값이 안 오릅니다 |

**출처** — <https://developers.google.com/maps/documentation/places/web-service/release-notes> (2026-09-11 확인)

**FIT 쪽 사실** — `PlaceKind.guess(List<String> googleTypes, String name)`
(`trip/domain/PlaceKind.java:72`) 가 타입 목록으로 열여섯 갈래를 추론합니다.
타입이 180개 늘었다는 것은 이 추론 함수가 못 보는 타입이 늘었다는 뜻이기도
합니다.

**확인 못 한 것** — 늘어난 타입 중 우리 열여섯 갈래와 어긋나는 것이 무엇인지.
목록을 안 펼쳐 봤습니다.

---

## 9. 아직 문 안 연 곳 — includeFutureOpeningBusinesses · openingDate

**한 줄** — 개업 예정인 곳을 검색 결과에 넣고, 언제 여는지 알려 줍니다.

**어떻게 동작하나**
2026-03-17 에 열렸습니다. `includeFutureOpeningBusinesses` 를 켜면 아직 안
연 곳이 결과에 섞이고, `openingDate` 로 예정일이 옵니다. 영업 상태에
`FUTURE_OPENING` 이 새로 생겼습니다. **기본값은 꺼져 있습니다** — 켜야
섞입니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 외부 API | Places (New) |
| 서버 저장 | 0 |
| 요금 등급 | `openingDate` 는 **Pro** |

**출처** — <https://developers.google.com/maps/documentation/places/web-service/release-notes> (2026-09-11 확인)

**FIT 쪽 사실** — `PlaceInfoService.FIELDS`
(`trip/application/PlaceInfoService.java:77-86`) 가 `businessStatus` 를 이미
받습니다. 새 상태값이 들어오면 그 분기가 무엇으로 떨어지는지 봐야 합니다.

**확인 못 한 것** — 우리가 이 파라미터를 켜지 않아도 `FUTURE_OPENING` 상태가
상세 조회에 나타날 수 있는지.

---

## 10. 구글이 지어 주는 장소·후기 요약 — generativeSummary · reviewSummary

**한 줄** — 장소 설명과 후기 요약을 구글이 만들어서 줍니다.

**어떻게 동작하나**
2025-04-15 에 미리보기, 2025-05-08 에 정식, 2025-08-21 에 지역과 언어가
늘었습니다. 셋입니다 — 장소 요약, 후기 요약, 지역 요약. 여기에 딸려서
`flagContentUri` 가 생겼는데, **응답에 들어오는 모든 후기·사진·생성 요약에
붙는 신고 링크**입니다. 부적절한 내용을 구글에 알리는 통로를 화면에 두라는
뜻입니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 외부 API | Places (New) |
| 서버 저장 | 0 (장기 보관은 약관 문제) |
| 요금 등급 | **Enterprise + Atmosphere** — 가장 비싼 등급 |
| 그 밖에 | 신고 링크를 화면에 두는 의무 |

**출처** — <https://developers.google.com/maps/documentation/places/web-service/release-notes> · <https://ubilabs.com/en/insights/google-maps-updates> (둘 다 2026-09-11 확인)

**규칙에 걸릴 수 있는 곳** — `docs/done/recommend.md` §7.2 가 "자연어 문단 답변
생성" 을 이미 버렸습니다. 다만 그 판단의 근거는 **우리가 지어내는 자리를
만들지 않는다** 였고, 이것은 구글이 지어서 주는 것입니다. 같은 판단이
그대로 적용되는지 2단계에서 가려야 합니다. `PlaceInfoService` 주석이 사진과
후기를 안 받는 이유로 든 "글쓴이 표시 의무" 와도 이어집니다.

**확인 못 한 것** — 한국어 요약의 품질과, 한국·일본 장소에 실제로 채워져
오는 비율.

---

## 11. 공동 편집에 댓글과 변경 이력

**한 줄** — 누가 무엇을 왜 바꿨는지가 일정 옆에 남습니다.

**어떻게 동작하나**
지금 시장에 **없는 것**입니다. Wanderlog 는 실시간 공동 편집을 하지만, 리뷰
매체가 사람들이 원한다고 꼽은 것은 그 위의 두 가지입니다 — 구글 문서처럼
항목에 댓글을 다는 것과, 변경 이력을 보는 것 (인용의 인용). Google Maps 의
공동 리스트는 장소를 함께 모으는 데까지고 논의가 남지 않습니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 안 늘려도 됨 (들어왔을 때만 보이게 하면) |
| 외부 API | 불필요 |
| 서버 저장 | 글자만. 파일 없음 |

**출처**
- <https://tripstone.app/blog/wanderlog-review> (2026-09-11 확인)
- <https://www.androidauthority.com/google-maps-share-sheet-update-3571897/> — **403 으로 못 읽었습니다.** 공동 리스트에 관한 내용은 검색 결과 요약과 <https://techcrunch.com/2023/11/15/google-maps-gets-more-social-feature-help-you-collaborate-with-friends> 쪽으로만 봤습니다

**FIT 쪽 사실** — `docs/ideas.md` 의 1번(소식함)이 이미 이 방향이고,
`Place.updatedBy`·`updatedAt`·`Trip.version` 이 저장되지만 어느 화면도 안
쓴다고 적혀 있습니다(`docs/ideas.md:35-37`). 댓글 쪽은 `PostComment` ·
`CommentService` 가 커뮤니티 글에 이미 붙어 있습니다.

**확인 못 한 것** — 레딧 원문. 리뷰 매체가 "implied" 로 묶어 놓은 목록이라,
사람들이 실제로 그 말을 했는지 아니면 글쓴이의 정리인지 가릴 수 없습니다.
**이 후보의 근거는 약합니다.**

---

## 12. 위치 공유의 정밀도를 사람이 고르기

**한 줄** — 실시간 위치를 끄고 "마지막으로 기록된 지점까지" 만 보여 줍니다.

**어떻게 동작하나**
Polarsteps 2026 여름 릴리스에 들어갔습니다. 사람이 라이브 위치를 보일지
고르고, 안 보이기로 하면 대신 **마지막 기록 지점까지의 경로**만 공유됩니다.
지금 어디 있는지는 감추고 어디까지 갔는지는 보여 주는 중간 단계입니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | 불필요 |
| 서버 저장 | Polarsteps 방식은 **자취를 쌓습니다** (경로를 보여 주려면 지난 점들이 남아 있어야 함) |

**출처** — <https://www.polarsteps.com/news/polarsteps-launches-summer-2026-release-new-tools-for-planning-privacy-and-sharing> (2026-09-11 확인)

**규칙에 정면으로 걸립니다** — "위치는 자취를 안 남깁니다"
(`trip/application/LiveService.java`, 한 사람당 한 줄 덮어쓰기). Polarsteps 의
"마지막 기록 지점까지의 경로" 는 점이 쌓여 있어야 성립합니다. 고르게 하는
쪽(정밀도 선택)만 떼어 받을 수 있는지가 2단계의 물음입니다.

**확인 못 한 것** — Polarsteps 가 자취를 얼마나 오래 두는지.

---

## 13. 다녀온 뒤의 요약

**한 줄** — 여행이 끝나면 앱이 그 여행을 한 장으로 정리해 줍니다.

**어떻게 동작하나**
셋을 봤고 값이 크게 다릅니다.

| 앱 | 무엇을 만드나 | 무엇을 요구하나 |
|---|---|---|
| TripIt Rewind | 한 해의 여행 수·나라·도시를 센 요약. 공유 가능 | 이미 있는 일정 데이터만 |
| Polarsteps Trip Reels | 자동 생성 영상. 2026 에 **실제 지형을 반영한 지도 플라이오버**가 붙음 | 영상 생성·보관 |
| Polarsteps Travel Books | 인쇄 사진책 (유료 상품) | 사진 |

**무엇을 요구하나** (TripIt Rewind 쪽 기준)

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | 불필요 |
| 서버 저장 | 0 — 이미 있는 것을 세기만 함 |

**출처**
- <https://www.tripit.com/web/blog/news-culture/tripit-turns-20> (2026-09-11 확인)
- <https://www.polarsteps.com/news/polarsteps-launches-summer-2026-release-new-tools-for-planning-privacy-and-sharing> (2026-09-11 확인)

**규칙에 걸릴 수 있는 곳** — 영상과 사진책은 "서버에 파일을 안 쌓습니다" 에
걸립니다. 세어서 보여 주는 쪽은 안 걸립니다. 이 후보는 **둘로 갈라서**
판정해야 합니다.

**FIT 쪽 사실** — 셀 재료가 이미 있습니다. `Visit`(방문 표시),
`Expense`(지출·통화), `Place`, `Day`, `TripMember`.

**확인 못 한 것** — TripIt Rewind 가 해마다 계속 나오는지, 2024년 한 번만
나온 것인지. 2024 요약이라고만 적혀 있습니다.

---

## 14. 잠금화면 위젯과 Live Activity

**한 줄** — 앱을 열지 않고도 다음 일정과 남은 날이 보입니다.

**어떻게 동작하나**
TripIt 은 iOS 잠금화면 위젯으로 다음 여행·다음 일정의 핵심만 띄우고, 여행
중에는 내용이 바뀝니다. iOS 의 Live Activities 는 잠금화면·Dynamic Island·
홈화면·애플워치 Smart Stack·맥 메뉴바·CarPlay 까지 나갑니다.
안드로이드는 16 부터 **Live Updates** 로 같은 갈래가 열렸고(2025-06-10 발표),
위젯은 Jetpack Glance 로 만듭니다.

**Expo 에서 되는지**
됩니다. 다만 네이티브입니다.

| | |
|---|---|
| `expo-apple-targets` | 설정 플러그인으로 Apple 타겟(위젯·App Clip)을 만듭니다. CocoaPods 1.16.2 · Xcode 16 · **Expo SDK 53 이상** 필요 |
| Expo Widgets | 2026 에 나온 것. 위젯을 **React 컴포넌트로** 정의하고 CNG 가 네이티브를 처리합니다 |
| 안드로이드 | 위 두 글은 iOS 얘기입니다. 안드로이드 쪽 경로는 **확인 못 했습니다** |

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | Live Activity 를 밖에서 갱신하려면 필요. 위젯만이면 불필요 |
| 외부 API | 불필요 |
| 서버 저장 | 0 |
| **EAS 재빌드** | **필요** — 네이티브입니다. `expo-updates` 로 못 들어갑니다 |
| 웹 | 안 됩니다 |

**출처**
- <https://www.tripit.com/web/blog/news-culture/tripit-widgets-ios> (2026-09-11 확인)
- <https://expo.dev/blog/home-screen-widgets-and-live-activities-in-expo> · <https://github.com/EvanBacon/expo-apple-targets> (둘 다 2026-09-11 확인)
- <https://www.dualmedia.fr/en/live-activities-widgets/> (2026-09-11 확인)

**FIT 쪽 사실** — `docs/ideas.md` 의 2번이 D-day 를 "새 데이터도 서버 호출도
없는 한 줄" 로 적어 두었습니다. 그것을 위젯까지 내보내는 것은 재빌드가
붙는 별개의 일입니다.

**확인 못 한 것** — 이 저장소의 Expo SDK 버전. `expo-apple-targets` 가 SDK 53
이상을 요구하는데 `docs/done/recommend.md` §8.1 은 Expo 57 이라고 적습니다.
`frontend/package.json` 을 2단계에서 봐야 합니다. 안드로이드 위젯을 Expo
CNG 로 넣는 방법도 확인 못 했습니다.

---

## 15. 대화형 도우미에 여행을 맡기기

**한 줄** — ChatGPT·Claude 같은 데서 대화만으로 여행을 만들고 고칩니다.

**어떻게 동작하나**
둘을 봤습니다.

- **Lambus** 는 앱을 ChatGPT·Claude·Gemini 에 연결해, 대화 하나로 여행을
  만들고 경유지를 넣고 세부를 고치게 합니다. 방향이 반대입니다 — 앱 안에
  AI 를 넣는 게 아니라, **AI 쪽에서 앱을 부릅니다.**
- **Google Grounding Lite** 는 MCP 로 구글 지도 데이터를 AI 앱에 붙여 줍니다.
  2억 개 넘는 장소, 위치 기반 날씨, 기본 경로 계산입니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 불필요 |
| 푸시 | 불필요 |
| 외부 API | MCP 서버를 우리가 내놓아야 함 |
| 계정 연동 | 남의 AI 클라이언트가 우리 API 를 부를 인증 경로가 새로 필요 |
| 서버 저장 | 0 |

**출처**
- <https://www.lambus.com/> (2026-09-11 확인)
- <https://ubilabs.com/en/insights/google-maps-updates> (2026-09-11 확인)

**규칙에 걸릴 수 있는 곳** — "사람이 수락해야 바뀝니다"
(`trip/domain/RouteTidy.java`). 대화로 일정을 고치는 것은 앱 밖의 모델이 우리
데이터를 쓰는 일이고, 무엇이 수락 없이 바뀔 수 있는지가 문제입니다. 인증도
새로 생깁니다.

**확인 못 한 것** — Lambus 가 실제로 MCP 서버를 내놓는 것인지, 아니면
ChatGPT 앱 안의 연동인지. 홈페이지 문구 수준으로만 봤습니다. Grounding Lite
가 유료인지, 우리 같은 쪽에 값이 있는지도 확인 못 했습니다.

---

## 눈에 띈 것

**여럿이 공통으로 가진 것**

- **오프라인**. 있는 앱은 자랑하고 없는 앱은 불평을 받습니다. 무료로 주는
  곳이 드물어서, 유료화 지점으로 굳어 있습니다.
- **예약 정보 자동 등록**. Wanderlog·TripIt 둘 다 있고 둘 다 유료입니다.
- **AI 일정 생성**. 트리플·마이리얼트립·Wanderlog·Polarsteps·Lambus 전부
  있습니다. 그런데 평이 좋지 않습니다 — Wanderlog 쪽은 "generic",
  AI 전용 앱들은 "heavy editing 필요" 로 묶입니다.

**아무도 안 하는 것**

- **결정 과정을 남기는 것.** 동시 편집은 흔한데, 왜 그렇게 정했는지가 남는
  곳이 없습니다. FIT 의 후보·투표(`CandidateService`)가 서 있는 자리가 여기고,
  조사한 열다섯 개 중 이것을 가진 앱은 없었습니다.
- **여행 중에 쓰는 것.** 대부분이 여행 **전**(계획)과 **후**(기록)에 무게가
  있습니다. Polarsteps 는 후, Wanderlog 는 전입니다. 여행 중은 Flighty 같은
  항공편 앱이 Live Activity 로 가져가 있습니다.

**플랫폼 쪽에서 눈에 띈 것**

Places API (New) 의 최근 1년 추가분은 **대부분 Enterprise + Atmosphere
등급**에 들어갔습니다 (`entrances`·`navigationPoints`·`generativeSummary`·
`reviewSummary`·`routingSummaries`). 값이 안 드는 쪽에 들어간 것은
`googleMapsTypeLabel`·`openingDate`·`addressDescriptor`(Pro) 와
`transitStation`(Enterprise, 지금과 같은 등급) 입니다.

새 기능이 열렸다는 소식과 **그것을 켜면 값이 얼마나 오르는가**가 릴리스
노트에서 따로 놀아서, 후보마다 등급을 적어 두었습니다. 이 등급 차이는
`GoogleQuotaFilter` 가 세는 **횟수**로는 안 보입니다.

**조사 중에 못 채운 자리**

- 레딧 원문을 못 봤습니다. 11번 후보의 근거가 특히 약합니다.
- 경쟁 앱을 직접 써 보지 않았습니다. 1번의 "무료로 어디까지 열리는가" 같은
  것은 리뷰 글의 말을 옮긴 것입니다.
- 앱스토어 평점·다운로드 수 같은 숫자는 **적지 않았습니다.** 신뢰할 출처를
  못 찾았습니다.
