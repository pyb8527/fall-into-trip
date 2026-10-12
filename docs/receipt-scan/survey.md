# 밖에서는 무엇을 하고 있나 — 영수증 사진으로 지출 채우기

> 2026-10-12 에 브라우저 안 OCR · 글자에서 값 뽑기 · 경쟁 앱 세 갈래를 본 기록입니다.
> 판단은 다음 문서(`verdict.md`)에서 합니다.
> 아직 코드는 한 줄도 바뀌지 않았습니다.

## 0. 이번 조사가 어디서 시작하나

### 하려는 것

영수증을 찍으면 **금액 · 통화 · 날짜 · 가게**를 읽어 지출 적기 칸을 채워 둡니다. 사람이 보고 "적기"를 누릅니다.

### 이미 있는 것

| | 지금 | 어디 |
|---|---|---|
| 지출 적기 | 판 하나(제목 · 금액 · 통화 · 낸 사람 · 나눌 사람) | `frontend/src/app/money/[id].tsx:1086` `SpendSheet` |
| 지출 칸 | 날짜 · 장소 · 낸 사람 · 분류(`cat`) · 이름 · 금액 · 통화 · 결제 수단(`pay`) · 나눔 | `expense/domain/Expense.java:32-74` |
| 지출에 사진 | **없음** | 같은 곳 |
| 기기 안 LLM | `@mlc-ai/web-llm`, Qwen2.5-1.5B(약 1GB, 사람이 원할 때 한 번 받음) | `frontend/package.json:19`, `lib/intent.web.ts:70` |
| 앱의 모양 | 웹을 웹뷰로 띄우는 껍데기 | `frontend/index.js`, `src/shell/shell.tsx:278` |

### OCR 은 두 번 "안 받는다"로 끝났었습니다

| 문서 | 근거 |
|---|---|
| `docs/2026-09/verdict.md:166`, `plan-booking-paste.md:57` | 기기에서 읽으면 **OCR 엔진이 새 네이티브 의존이고 EAS 재빌드가 붙는다** |
| `docs/2026-10/verdict.md:107` | 서버에서 읽으면 **사람이 남기려고 올린 것이 아닌 그림**을 받는 문이 새로 생긴다(사진 규칙은 사람이 올린 사진만) |

첫째 근거는 **그 뒤로 바뀐 사정**이 있습니다. 앱이 웹을 웹뷰로 띄우게 되면서(`frontend/index.js` 머리 주석), 브라우저에서 도는 OCR(WASM)은 네이티브 의존 없이 앱에서도 돕니다.
둘째 근거는 그대로입니다. 그래서 이번 조사는 **기기 안에서 읽는 길만** 봤습니다.

## 어디를 봤나

| 갈래 | 본 것 | 조사일 |
|---|---|---|
| 브라우저 안 OCR | Tesseract.js, PaddleOCR.js(공식 SDK), ppu-paddle-ocr, PP-OCR ONNX 변환본, Transformers.js(Donut · Florence-2 · TrOCR · manga-ocr), Scribe.js, docTR(TF.js), EasyOCR, Shape Detection API | 2026-10-12 |
| 글자에서 값 뽑기 | receipt-parser-core, 일본 국세청 경감세율 표시, WebLLM 구조화 출력, 작은 LLM 영수증 벤치마크 2건, Donut · Florence-2 · LayoutLMv3, CORD · SROIE · JaWildText · 한국 영수증 데이터 | 2026-10-12 |
| 경쟁 앱 · 불평 | Splitwise Pro, Tricount, Settle Up, Splid, Tab 류, Venmo, 카카오페이 · 토스 정산, 편한가계부 등, Wanderlog, Trabee Pocket, Expensify, Zoho Expense, Google Lens · Live Text, 영수증 인식 불평 글 | 2026-10-12 |

**못 본 것**
- 일본 · 한국 영수증을 **폰 브라우저에서** 돌린 시간 · 정확도 자료. 찾지 못했습니다. 재 봐야 합니다.
- 앱스토어 · 레딧 원문. 불평 인용은 검색 요약이나 업체 블로그를 거쳤습니다.
- 경쟁 앱이 기기에서 읽는지 서버에서 읽는지. 공식 문서로 확인한 곳이 없습니다.

## 눈에 띈 것 먼저

- **그룹 정산 앱은 대부분 사진을 붙이기만 합니다.** Tricount, Settle Up, Trabee Pocket 이 그렇습니다. 읽어서 채우는 것은 Splitwise Pro(유료), 품목 나누기 전용 앱(Tab 류), 업무 경비 앱(Expensify, Zoho)입니다.
- **불평은 셋으로 모입니다.** 합계 줄을 잘못 고른다 · 외국 영수증과 감열지에 약하다 · 유료인데 못 읽는다.
- **일본 · 한국 영수증에 맞춘 공개 규칙 파서는 찾지 못했습니다.** 규칙은 직접 써야 합니다.
- **작은 LLM 은 값을 정확히 맞히는 데 약합니다.** 3B 모델에서 이미 크게 떨어집니다(아래 8). 1.5B 는 더 낮을 것으로 봐야 합니다.

---

## 1. Tesseract.js — 브라우저 OCR 의 표준

**한 줄** — Tesseract 엔진을 WASM 으로 옮긴 것입니다. 가장 붙이기 쉽습니다.

**어떻게 동작하나**
워커에서 WASM(SIMD)으로 돕니다. 언어 데이터를 처음 쓸 때 받습니다. 현재 v7 이고, v5 에서 실행 시간이 약 절반으로 줄었다고 공식 README 가 적습니다.

| 언어 데이터 | fast | best |
|---|---|---|
| 한국어 `kor` | 1.68 MB | 12.5 MB |
| 일본어 `jpn` | 2.47 MB | 14.3 MB |
| 영어 `eng` | 4.11 MB | 15.4 MB |

(GitHub tessdata_fast · tessdata_best 파일 크기. Tesseract.js 가 기본으로 어느 쪽을 받는지는 확인 못 함.)

**영수증 정확도**
- 한국 감열지 영수증 벤치마크 KORIE(748장, 평판 스캔)에서 **단어 정확도 64.7%** — 논문(MDPI Mathematics 2026)의 수치를 2차 요약에서 가져왔습니다. 본문 확인 못 함.
- 일본어는 "글꼴 · 해상도 의존이 크고 노이즈 · 기울어짐에 약하다"는 2차 블로그 평가만 있습니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 기기 안에서만 |
| 푸시 | 불필요 |
| 외부 API | 없음 |
| 서버 저장 | 없음 |
| 라이선스 | Apache-2.0 |
| 첫 다운로드 | 한국어 + 일본어 fast 약 4MB |

**출처**
- github.com/naptha/tesseract.js (공식)
- github.com/tesseract-ocr/tessdata_fast, tessdata_best (공식)
- mdpi.com/2227-7390/14/1/187 (KORIE 논문), imagetotable.ai/references/receipt-ocr-accuracy (2차)
- lilting.ch/en/articles/ocr-web-2025 (2차)

**확인 못 한 것** — 폰에서 한 장 처리 시간.

## 2. PaddleOCR.js — PP-OCRv5 를 브라우저에서 (공식 SDK)

**한 줄** — PaddleOCR 팀이 낸 브라우저 SDK `@paddleocr/paddleocr-js`. PP-OCRv5 를 onnxruntime-web 으로 돌립니다.

**어떻게 동작하나**
글자 자리를 찾는 모델(감지)과 글자를 읽는 모델(인식) 둘을 받습니다. 백엔드는 `wasm` / `webgpu` / `auto`, 워커 모드가 있습니다.

| 모델 | 크기 | 언어 |
|---|---|---|
| PP-OCRv5_mobile_det (감지) | 4.7 MB | – |
| PP-OCRv5_mobile_rec (인식) | 16 MB | 중국어 간체 · 번체, 영어, **일본어** |
| korean_PP-OCRv5_mobile_rec | 14 MB | **한국어**, 영어, 숫자 |
| server_det / server_rec | 84.3 MB / 81 MB | 폰에는 무거움 |

**정확도**
- 공식 인식 정확도(Paddle 자체 평가셋, 영수증 전용 아님): mobile_rec 일본어 54.65%, server_rec 일본어 60.35%, korean mobile_rec 88.0%.
- KORIE 에서 PaddleOCR **단어 정확도 73.3%** — 데스크톱 파이썬 기준, 2차 요약 수치. Tesseract 64.7%, EasyOCR 68.6% 보다 높습니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 기기 안에서만 |
| 푸시 | 불필요 |
| 외부 API | 없음 |
| 서버 저장 | 없음 |
| 라이선스 | PaddleOCR 본체 Apache-2.0 (SDK 패키지 자체는 확인 못 함) |
| 첫 다운로드 | 감지 + 일본어 + 한국어 mobile 약 35MB |
| 헤더 | 멀티스레드 WASM · WebGPU 를 쓰려면 COOP/COEP 를 직접 처리하라고 문서가 적음 |

**출처**
- paddleocr.ai/latest/en/version3.x/inference_deployment/cross_platform/browser.html (공식)
- paddleocr.ai/v3.4.1/en/version3.x/module_usage/text_recognition.html, text_detection.html (공식)

**확인 못 한 것**
- SDK 가 `lang: "korean"` · `"japan"` 을 받는지(문서 예시는 `"ch"` 뿐)
- 폰 처리 시간
- 2025-12 시점에 "브라우저에서 안 됐다"는 2차 보고가 있습니다. 그 뒤 공식 SDK 가 나왔으므로 다시 재 봐야 합니다.

## 3. ppu-paddle-ocr · PP-OCR ONNX 변환본 — 커뮤니티 길

**한 줄** — 공식 SDK 가 안 맞을 때 같은 모델을 다른 포장으로 쓰는 길입니다.

**어떻게 동작하나**
- `ppu-paddle-ocr/web`: PP-OCRv5 mobile 을 onnxruntime-web 으로. "40개 넘는 언어, 한국어 · 일본어 포함" 변환본을 준다고 합니다. 라이브러리 MIT. README 의 속도 수치는 Apple M1(Bun) 225ms/회뿐입니다.
- `monkt/paddleocr-onnx`(Hugging Face): 직접 onnxruntime-web 에 붙일 변환 모델 모음. 한국어 인식 13MB. v5 감지는 server 급(84MB)이라 폰용 mobile 감지는 따로 구해야 합니다.

**무엇을 요구하나** — 2번과 같음. 라이선스 MIT(라이브러리) · Apache-2.0(모델).

**출처**
- cdn.jsdelivr.net/npm/ppu-paddle-ocr@5.1.1/README.md (2차)
- huggingface.co/monkt/paddleocr-onnx (2차)

**확인 못 한 것** — 검색 요약에 "영수증 벤치마크 문자 정확도 99.22%"가 있었지만 README 에 없습니다. **인용하지 않습니다.**

## 4. 이미지를 바로 구조화하는 모델 — Donut · Florence-2 · TrOCR

**한 줄** — OCR 없이 영수증 그림을 넣으면 바로 칸(JSON)을 내는 모델들입니다.

| 모델 | 무엇 | 브라우저 | 한·일 | 라이선스 |
|---|---|---|---|---|
| Donut (CORD 학습) | 영수증 → JSON. CORD 정확도(TED) 91.3, 서버 GPU 0.7초/장 | Transformers.js 판(`Xenova/donut-base-finetuned-cord-v2`), 양자화 인코더 91MB + 디코더 128MB | **인도네시아 영수증으로만 학습** — 한·일에는 미세조정이 필요 | 코드 MIT |
| Florence-2-base | `<OCR>` 작업, 0.23B | WebGPU 데모 있음 | 영어 중심이라는 2차 보고 | MIT |
| TrOCR | 한 줄 인식 — 감지 모델을 따로 붙여야 함 | 가능 | 영어 중심 | – |
| manga-ocr | 만화 일본어 | Transformers.js | 일반 문서에는 안 맞는다는 2차 보고 | – |
| LayoutLMv3 | 문서 이해 | – | – | **CC BY-NC-SA 4.0 (비상업)** |

**출처**
- github.com/clovaai/donut (공식), huggingface.co/Xenova/donut-base-finetuned-cord-v2 (2차)
- huggingface.co/microsoft/Florence-2-base (공식), huggingface.co/blog/transformersjs-v3 (공식)
- huggingface.co/microsoft/layoutlmv3-base (공식)

## 5. 그 밖의 브라우저 OCR — 쓸 수 없거나 맞지 않음

| 이름 | 왜 |
|---|---|
| Scribe.js | **AGPL-3.0** — 상용은 따로 문의. 모든 파일을 같은 출처에서 내보내야 함 |
| docTR (TF.js) | 데모 있음, 라틴 문자 위주로 보임. 한·일 확인 못 함 |
| EasyOCR | 브라우저 이식판 없음 |
| Shape Detection API `TextDetector` | 크롬 실험 플래그를 켜야만. 플랫폼에 따라 글자 없이 상자만 |

**출처** — github.com/scribeocr/scribe.js, blog.tensorflow.org/2022/06/ocr-in-browser-using-tensorflowjs.html, developer.chrome.com/docs/capabilities/shape-detection (모두 공식)

## 6. 웹뷰에서 돌릴 때 걸리는 것

**한 줄** — 같은 OCR 이라도 앱 껍데기(웹뷰) 안에서는 조건이 다릅니다.

- **iOS WKWebView 와 WebGPU**: iOS 18.2 때 Safari 에서 켜도 WKWebView 는 GPU 에 못 닿았다는 보고. iOS 26 에서 기본으로 켜졌다는 보고와 함께, iPhone 15(iOS 26.4) WKWebView 에서 프로세스가 죽었다는 보고가 있습니다. **기본은 WASM, WebGPU 는 써지면 쓰는 것**으로 보는 편이 맞습니다.
- **멀티스레드 WASM**: SharedArrayBuffer 를 쓰려면 COOP/COEP 헤더가 필요합니다. 지금 nginx 가 이 헤더를 보내는지, 붙이면 구글 지도 · 카카오 같은 바깥 스크립트가 깨지지 않는지 확인해야 합니다. 안 되면 단일 스레드로 돕니다.
- **Android WebView 의 WebGPU**: 확인 못 함.
- **첫 다운로드**: 모델은 한 번 받아 기기에 담아 둬야 합니다. Tesseract 한·일 fast 약 4MB, Paddle mobile 약 35MB.

**출처** — developer.apple.com/forums/thread/822200, thread/770862 (공식 포럼)

## 7. 글자에서 값 뽑기 — 규칙

**한 줄** — OCR 이 준 글자 덩어리에서 "합계 줄"을 고르는 규칙입니다. **일본 · 한국 영수증에 맞춘 공개 파서는 찾지 못했습니다.**

**참고할 만한 공개 파서**
- `receipt-parser-core`(Apache-2.0, 파이썬, 2021년에 멈춤): 가게 목록 · 합계 키워드 · 무시 키워드 · 날짜 정규식을 설정 파일 하나로 움직입니다. 독일어 기본. **합계 키워드에 받은 현금 · 거스름이 섞여 있어** 그것을 합계로 고르는 함정이 그대로 보입니다.

**일본 영수증 — 공식으로 확인한 것**
- 경감세율 8% 품목에는 "※" 같은 표시를 붙이고 그 뜻을 영수증에 적습니다. 기호는 정해져 있지 않아 "軽" 등도 씁니다. 표준세율 10%(국세청 PDF).

**일본 영수증 — 출처 없는 설계안**
- 합계 후보: `合計` → `税込合計` → `お買上計`
- 빼는 줄: `小計`, `お預り`/`お預かり`(받은 현금), `お釣り`/`釣銭`(거스름), `(内消費税)`, `対象計`
- 검산: `お預り − お釣り = 合計`, 외세 영수증은 `小計 + 消費税 = 合計`
- 날짜: `令和N年` = 2018+N 년(令和8年 = 2026), `2026/10/08`, `2026年10月8日`

**한국 영수증 — 설계안(출처 없음)**
- 합계 후보: `받을금액`, `합계`, `결제금액`, `승인금액`
- 빼는 줄: `부가세`, `과세물품가액`, `면세`, `받은금액`, `거스름돈`
- `카드승인` · `승인번호` 근처 금액으로 교차 확인

**통화 — 설계안(출처 없음)**
- `¥` 는 엔화와 위안화가 함께 씁니다. `円` 이나 일본어 글자가 같이 보일 때만 JPY.
- `₩` · `원` 은 KRW.
- 그 밖에는 여행지 통화로 두고 "추정"이라고 표시.

**출처**
- pypi.org/project/receipt-parser-core/, github.com/ReceiptManager/receipt-parser-legacy (공식)
- nta.go.jp/.../keigenzeiritsu/pdf/0019011-044_01.pdf (국세청, 공식)

**확인 못 한 것** — 일본어 기술 글(zenn)의 "키워드 → 아래쪽 → 가장 큰 금액 → 검산" 방법은 원문이 404 였습니다.

## 8. 글자에서 값 뽑기 — 기기 안 LLM

**한 줄** — 이미 들어 있는 web-llm 에 OCR 글자를 주고 JSON 으로 칸을 받습니다.

**어떻게 동작하나**
- WebLLM 은 `response_format: { type: "json_object", schema }`(JSON 스키마)와 EBNF 문법으로 출력 모양을 강제합니다. 공식 예제가 쓰는 모델 목록에 **Qwen2.5-1.5B-Instruct-q4f16_1-MLC**(FIT 가 쓰는 그 모델)가 들어 있습니다.
- **모양은 보장하지만 값이 맞는지는 보장하지 않습니다.**

**작은 LLM 의 영수증 정확도 — 근거 둘**

| 출처 | 조건 | 결과 |
|---|---|---|
| "From Pixels to Pairs" (arXiv 2609.17538, 2차) | Gemma-2B ~ Qwen2.5-7B 를 OCR 글자에 텍스트만으로 | 가장 작은 Gemma-2B 정확 일치: SROIE 0.41(정답 글자) / 0.38(PaddleOCR 글자), CORD 0.27 / 0.14. OCR 잡음은 "어느 칸인가"보다 "값이 맞나"를 더 떨어뜨림 |
| doc-ai-receipts (개인 프로젝트, 2차) | CORD v2 테스트 100장, RapidOCR | 합계: Qwen2.5-7B 0.88, **정규식 0.80**. Qwen2.5-3B 는 모든 칸이 맞는 비율 0.20. 소계 · 세금은 정규식이 7B 보다 높음 |

Qwen2.5-0.5B · 1.5B 의 영수증 수치는 찾지 못했습니다.

**무엇을 요구하나**

| 항목 | |
|---|---|
| 위치 | 불필요 |
| 사진·파일 | 없음(글자만) |
| 푸시 | 불필요 |
| 외부 API | 없음 |
| 서버 저장 | 없음 |
| 기기 | WebGPU, 모델 약 1GB 를 이미 받은 사람 |
| 라이선스 | WebLLM Apache-2.0 |

**출처** — github.com/mlc-ai/web-llm (`examples/json-schema`) (공식), arxiv.org/html/2609.17538, github.com/Palakshchat15/doc-ai-receipts (2차)

## 9. 시험용 공개 영수증 데이터

| 데이터 | 무엇 | 라이선스 | 쓸모 |
|---|---|---|---|
| **CORD** | 인도네시아 영수증 공개 1,000장. 합계 · 받은 현금 · 거스름을 **따로** 라벨링 | CC BY 4.0 | "받은 현금을 합계로 고르는가" 시험에 딱 맞음 |
| SROIE (ICDAR 2019) | 말레이시아 · 영어. 가게 · 주소 · 날짜 · 합계 | 2차 출처는 CC-BY-4.0, 공식 조건 확인 못 함 | |
| JaWildText | 일본 영수증 KIE 과제 포함(검색 요약 1,151장) | 데이터 "공개 예정" — 배포처 · 라이선스 확인 못 함 | 나오면 일본어 시험 |
| HumynLabs/Korean_Receipts_Dataset | 한국 영수증 | CC BY 4.0 | 정답 라벨 유무 불명 |
| AI Hub 영수증 | – | 확인 못 함 | |

**출처** — github.com/clovaai/cord (공식), huggingface.co/datasets/Voxel51/scanned_receipts (2차), arxiv.org/abs/2603.27942, huggingface.co/datasets/HumynLabs/Korean_Receipts_Dataset (2차)

## 10. 경쟁 앱 — 읽어서 채우는 곳

**한 줄** — 영수증을 **읽어서** 칸을 채우는 앱들입니다.

| 앱 | 무엇을 하나 | 유료 | 출처 |
|---|---|---|---|
| **Splitwise Pro** | 찍으면 내용을 읽고 **품목마다 친구에게 배정**. "today's foreign exchange rates"로 환산 | Pro 전용 | splitwise.com/pro (공식) |
| **Tab** 류(Tabify, Ninja Tab) | 품목 · 가격을 찾고 각자 자기 품목을 눌러 세금 · 팁까지. 여러 폰에서 함께 고름 | 확인 못 함 | 앱스토어 설명(2차) |
| **Expensify SmartScan** | 가맹점 · 금액 · 날짜 · **통화** · 세금. 확신이 없으면 사람에게 확인 요청. 통화는 위치 + 통화 기호로 | 업무용 | community.expensify.com (공식 커뮤니티), 98.6% 주장은 2차 · 검증 안 됨 |
| **Zoho Expense Autoscan** | 가맹점 · 날짜 · 금액, 품목이 여럿이면 품목별 지출로 나눔. 무료 월 20회 | 무료 한도 | blog.zoho.com (공식) |

**무엇을 요구하나** — 모두 처리 위치(기기/서버)를 공식으로 밝히지 않았습니다. Expensify 는 서버.

## 11. 경쟁 앱 — 사진만 붙이는 곳 · 없는 곳

| 앱 | 무엇 | 출처 |
|---|---|---|
| Tricount | 영수증 사진을 지출에 **붙이기만**. 읽지 않음. 무료(Premium 폐지). bunq 카드 결제를 지출로 옮기는 기능(iOS) | tricount.com (공식) |
| Settle Up | 프리미엄에서 사진 저장. 읽는다는 근거 없음 | 앱스토어(2차) |
| Trabee Pocket | 통화 환산 + 사진 첨부. 읽지 않음 | bankrate.com (2차) |
| 편한가계부 등 국내 가계부 | 영수증 사진 보관 · 첨부. 국내 가계부는 카드 · 문자 연동이 중심(추정) | 앱스토어(2차) |
| Splid, Venmo/PayPal, 카카오페이 · 토스 정산, Wanderlog | 영수증 기능을 찾지 못함 | – |

## 12. 사람들이 지금 하는 우회 — 글자 복사

**한 줄** — iOS 라이브 텍스트 · Google Lens 로 사진 속 숫자를 길게 눌러 복사해 가계부에 붙여 넣습니다.

안내 글은 있지만, 레딧에서 실제로 이렇게 쓴다는 글은 찾지 못했습니다.

**출처** — applemagazine.com/iphone-scan-text/, iphonelife.com/node/281282 (2차)

> FIT 에는 이미 "붙여 넣으면 읽는" 길이 있습니다(`docs/2026-09/plan-booking-paste.md`, `docs/2026-10/plan-paste-places.md`). 지출 칸에 같은 길을 붙이면 OCR 없이도 이 우회가 한 번에 됩니다.

## 13. 영수증 인식에 대한 불평

**한 줄** — 읽는 기능이 있는 곳에서 나오는 불평입니다. 업체 블로그가 많아 과장이 섞였을 수 있습니다.

| 불평 | 출처 |
|---|---|
| **합계를 확신 있게 틀림** — 실제 $34.17 을 경고 없이 $84.17 로. AI 인식은 못 읽은 숫자를 그럴듯하게 지어낼 수 있음 | beancount.io/blog/2026/07/10/... (2026-07-10, 2차) |
| **엉뚱한 줄을 고름** — 소계 · 세금 · 팁 중 하나를 합계로. "깔끔해 보이는 오답"이라 나중에 잡기 가장 어려움 | getfinny.app/blog/ai-receipt-ocr-accuracy-2026 (2차) |
| **감열지** — 바래면 대비가 낮아져 정확도가 70% 아래로 | 같은 출처 |
| **외국 영수증** — 낯선 양식 · 외화 · 다른 날짜 표기 · 섞인 언어 | 같은 출처 |
| **유료인데 품목을 못 읽음**(Splitwise) | 검색 요약만, 원문 확인 못 함 |
| 사진 대비만 조정해도 인식률 89% → 92.5% (한국 연구) | koreascience.kr/article/JAKO201810760742811.page |

---

## 보았지만 후보에 올리지 않은 것

| 본 것 | 왜 안 올렸나 |
|---|---|
| 서버에서 읽기(EasyOCR · docTR 파이썬, Expensify 식) | `docs/2026-10/verdict.md:107` — 읽기용 그림을 받는 문. 이번 조사는 기기 안만 봄 |
| Scribe.js | AGPL-3.0 |
| LayoutLMv3 | 비상업 라이선스 |
| Shape Detection API | 실험 플래그 |
| Tricount 의 카드 결제 연동 | 은행(bunq) 계정 연동 — 결제 연동은 여기서 다루지 않음 |
| Google Photos 식 사진 모음 | 사진 첨부만 하는 것은 이번 주제(읽어서 채우기)가 아님 |

## 아무도 안 하는 것

- **기기 안에서만 읽는 영수증 스캔** — 처리 위치를 밝힌 앱이 없고, 업무 경비 앱은 서버입니다.
- **한 · 일 영수증에 맞춘 규칙 + 검산** — 공개된 것이 없습니다.
- **여행지 통화로 기본값을 잡는 것** — Expensify(위치 + 통화 기호) 말고는 근거를 못 찾았습니다.
