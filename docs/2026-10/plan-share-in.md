# 다른 앱의 「공유」 에서 FIT 으로 — 안드로이드, 글자만 받아 붙여 넣기 판으로

> `verdict.md` 2번에서 **조건부 찬성 · 2차**로 받은 것의 실행 계획입니다.
> 아직 코드는 한 줄도 바뀌지 않았습니다.
>
> **혼자 서지 않습니다.** 받은 글을 놓을 자리가 `plan-paste-places.md` 의 판입니다.
> 그 계획의 관문(모델이 해내는지)이 먼저 넘어가야 하고, 그 계획이 접히면 이것도
> 접힙니다.
>
> **EAS 재빌드가 붙습니다.** 껍데기의 설정 플러그인이라 웹 배포로는 안 들어갑니다.
> `plan-widget.md` · 카톡 카드(앱) · `plan-app-offline.md` 의 남은 것과 한 번에
> 묶습니다(`verdict.md` 2번 「지켜야 할 것」).

## 1. 하려는 것

지금은 FIT 이 안드로이드 공유 시트에 **안 뜹니다.** `frontend/app.json` 의 `plugins`
에 `expo-sharing` 이 없어서 공유 대상(intent-filter)이 등록돼 있지 않습니다.

그래서 사람은 블로그 앱 · 인스타 · 단톡에서 글을 길게 눌러 복사하고, 앱을 바꿔 FIT 을
열고, 보석함 → 담기 → 붙여 넣기 판까지 세 번 누릅니다. `plan-paste-places.md` 가 서면
그 판은 생기지만, **판까지 가는 길**은 여전히 손으로 갑니다.

이 계획은 그 길을 「공유 → FIT」 한 번으로 줄입니다. 하는 일은 그것뿐입니다.

## 2. 이미 있는 것

| 필요한 일 | 지금 어디에 있나 |
|---|---|
| 받는 꾸러미 | `expo-sharing` ^57.0.22 — **이미 깔려 있음**(`frontend/package.json:39`). 보내는 쪽으로만 씀(`src/shell/answer.ts:4`) |
| 받는 API | `node_modules/expo-sharing/build/Sharing.d.ts:14-20` `getSharedPayloads()`(받은 그대로, 동기), `:21-32` `getResolvedSharedPayloadsAsync()`(주소를 **열어 보고** 내용을 풂), `clearSharedPayloads()`. 훅 `useIncomingShare`(`build/index.d.ts:1`). 전부 `@experimental` |
| 설정 플러그인 | `node_modules/expo-sharing/plugin/build/sharingPlugin.types.d.ts:71-84` — `android: { enabled, singleShareMimeTypes, multipleShareMimeTypes }`, `ios: { enabled, … }` |
| 껍데기 → 웹 말길 | `src/shell/talk.ts:130-136` `Tell`, `:151-155` `speak()`(JSON 두 겹 — 따옴표 · 줄바꿈이 든 글도 안 깨짐) |
| 웹이 껍데기 말을 듣는 자리 | `src/lib/shell-bridge.web.ts:52` `__fitShellSays`, `hearShell` · `inShell` |
| 같은 모양의 앞선 예 | 알림을 눌러 들어온 주소 — 껍데기 `src/shell/shell.tsx:229-237`, 웹 `src/lib/shell-open.web.ts:21-36`, 시작은 `src/app/_layout.tsx:72` |
| 받은 글을 놓을 판 | `components/paste-places-sheet.tsx` — **`plan-paste-places.md` 가 새로 만듭니다.** `initialText` 를 받게 해 두기로 그 계획에 적었습니다 |

## 3. 버리는 것

### 3.1 그림 · 파일 공유 받기 — 버립니다

`singleShareMimeTypes` 에 `text/plain` 하나만 둡니다. 스크린샷을 받으면 읽을 길이
없고, 읽으려면 `plan-paste-places.md` §3.2 에서 버린 OCR 이나 서버 문이 필요합니다.
여러 개 공유(`multipleShareMimeTypes`)도 안 받습니다.

### 3.2 공유된 주소를 열어 보기 — 버립니다

`getResolvedSharedPayloadsAsync()` 를 **부르지 않습니다.** 이 함수는 공유된 주소를
네트워크로 열어 내용을 풉니다(`Sharing.d.ts:24-27`). 기기에서 하든 서버에서 하든
남의 글을 긁어 오는 일이고, `plan-paste-places.md` §3.1 에서 버린 「링크 읽기」 를
옆문으로 들이는 셈입니다. 받은 그대로(`getSharedPayloads()`)만 씁니다.

공유된 것이 주소 하나뿐이면 판은 「글이 없어 장소를 뽑을 수 없어요. 본문을 복사해
붙여 넣어 주세요」 를 띄우고 칸에 그 주소를 둡니다. 주소를 열지 않습니다.

### 3.3 iOS 공유 확장 — 미룹니다

스토어는 안드로이드 먼저입니다(`docs/plan-store-readiness.md:33`). iOS 공유 확장은
앱 그룹 · 확장 번들 · 따로 뜨는 화면까지 붙는 다른 크기의 일이라, iOS 를 낼 때 같이
봅니다. 플러그인 설정에 `ios.enabled: false` 를 적어 둡니다.

### 3.4 받자마자 담기 — 버립니다

공유는 판을 여는 데까지입니다. 뽑기 · 고르기 · 담기는 `plan-paste-places.md` 의 판이
하던 그대로 사람이 누릅니다(같은 계획 §3.4).

### 3.5 모델이 없을 때 서버로 — 버립니다

웹뷰에서 모델을 쓸 수 없으면 받은 글은 판에 놓이기만 하고 「이 기기에서는 글을 읽을
수 없어요」 로 끝납니다. 서버로 보내 뽑지 않습니다(`plan-paste-places.md` §3.5).
그렇다면 이 계획을 지을 까닭이 없으니 **§8 의 0번에서 먼저 잽니다.**

## 4. 갈 곳

```
[사람]  블로그 앱에서 「공유」 → FIT
          |
          v
  안드로이드가 FIT 의 MainActivity 를 엶 (text/plain intent-filter — 설정 플러그인이 등록)
          |
          v
  껍데기(shell.tsx)  useIncomingShare → sharedPayloads
          |   text/url 만 고름 · 4,000자에서 자름 · clearSharedPayloads()
          |   pendingShare 에 들고 있음        ← 웹이 아직 안 떴을 수 있습니다
          |
          +-- 웹이 이미 떠 있으면 → speak({ kind: 'shared' })      (글은 안 실음, 「왔다」 만)
          v
  웹(shell-share.web.ts)
          |   시작할 때 한 번, 그리고 'shared' 를 들을 때마다
          |   ask({ kind: 'takeShared' })  → 껍데기가 pendingShare 를 넘기고 비움
          |   옛 껍데기면 답이 실패/빈 값 → 아무 일 없음
          v
  받은 글을 메모리에 들고 → router.push('/saved?paste=1')    ← 글을 주소에 싣지 않습니다
          |
          +-- 로그인 안 했으면 → 로그인 화면. 글은 메모리에 남아 있다가 로그인 뒤 이어서
          v
  saved.tsx  paste=1 을 보고 PastePlacesSheet 를 initialText 로 엶 → 들고 있던 글을 비움
          |
          v
  여기서부터는 plan-paste-places.md §4 그대로
```

**왜 껍데기가 밀지 않고 웹이 당겨 가나** — 껍데기의 `say()` 는 웹뷰가 아직 없거나 웹이
듣기 전이면 말을 조용히 버립니다(`shell.tsx:167-170`, `speak()` 의 `window.__fitShellSays &&`).
공유로 앱이 **꺼져 있다가** 켜지는 경우가 가장 흔한데, 그때 밀면 웹이 듣기 전에 말이
사라집니다. 웹이 준비된 뒤에 「온 것 있나」 를 묻게 하면 그 틈이 없습니다.

**글을 주소에 싣지 않는 이유** — 웹 기록과 뒤로가기에 남의 글이 남습니다. 경로에는
「판을 열라」 는 표시만 둡니다.

## 5. 닿는 파일

| 파일 | 무엇을 |
|---|---|
| `frontend/app.json` | `plugins` 에 `["expo-sharing", { "android": { "enabled": true, "singleShareMimeTypes": ["text/plain"] }, "ios": { "enabled": false } }]` |
| `frontend/src/shell/talk.ts` | `Ask` 에 `{ kind: 'takeShared' }`(답: 글 또는 null), `Tell` 에 `{ kind: 'shared' }`. 양쪽이 같이 읽는 파일입니다(`:20-24`) |
| `frontend/src/shell/shell.tsx` | `useIncomingShare` 로 받기, `pendingShare` 보관, 웹이 떠 있으면 `shared` 알림, `heard()`(`:178-218`)에서 `takeShared` 를 `canGoBack` 처럼 직접 답함 |
| `frontend/src/lib/shell-share.web.ts` | **새로.** `listenForShellShare()` — `shell-open.web.ts` 와 같은 모양. 당겨 온 글을 모듈 안에 들고, `takeSharedText()` 로 한 번 내줌 |
| `frontend/src/app/_layout.tsx` | `:72` 옆에 `useEffect(() => listenForShellShare(), [])` |
| `frontend/src/app/(app)/saved.tsx` | `paste` 검색값을 보고 판을 엶. 열면 검색값을 지움(뒤로 왔다 다시 열리지 않게) |
| `frontend/src/components/paste-places-sheet.tsx` | `plan-paste-places.md` 가 만든 판. 받은 것이 주소뿐일 때의 문구(§3.2) |

**안 고치는 것** — 백엔드 전부, `api/`, `lib/intent*.ts`, `lib/places-prompt.ts`.

## 6. API

**서버 API 가 없습니다.** 이 계획의 「계약」 은 껍데기와 웹 사이의 말입니다.

| | |
|---|---|
| 껍데기 → 웹 | `Tell { kind: 'shared' }` — 몸통 없음. 「가져갈 것이 생겼다」 |
| 웹 → 껍데기 | `Ask { kind: 'takeShared' }` — 답 `string \| null`. 한 번 내주면 껍데기는 비웁니다 |
| 옛 껍데기 | `takeShared` 를 모르면 `answer()` 의 `switch` 에 안 걸려 값 없이 답하거나 `failed` 입니다. 웹은 둘 다 「없음」 으로 봅니다 |
| 껍데기 없는 브라우저 | `inShell` 이 거짓이면 아무것도 안 합니다(`shell-open.web.ts:22-24` 와 같음) |
| 권한 | 보석함은 로그인한 사람 것입니다. 받은 글은 로그인 전에 서버로 가지 않으므로 권한 자리가 없습니다. 뒤의 검색 · 담기 권한은 `plan-paste-places.md` §6 |

### 무효화

새 서버 길이 없으니 **`keysOfWrite` · `keysOfRead` 에 더할 것이 없습니다.** 담은 뒤의
`saved` 알림은 `plan-paste-places.md` §6 그대로입니다.

### 구글 호출

이 계획 몫은 0 입니다. 판에서 나가는 검색은 `plan-paste-places.md` 의 몫으로 셉니다
(이름 하나에 1, `PlaceSearchService.java:158`). `touchesGoogle` 변화 없습니다.

### 스키마

없습니다.

### 스토어

받은 글은 기기 밖으로 안 나가므로 Data safety 에 더할 것이 없습니다. 새 권한도
없습니다 — 공유 대상 등록은 권한이 아닙니다(`app.json` 의 `blockedPermissions` 그대로).

## 7. 테스트

| | |
|---|---|
| `backend/src/test/http/*.test.mjs` | **더할 것이 없습니다.** 서버가 안 바뀝니다. 「동행자만 부를 수 있는가」 를 볼 여행 자리가 없습니다 |
| 프런트 | `npm run typecheck` |
| 기기 | EAS 로 구운 안드로이드 빌드에서 손으로 봅니다. 에뮬레이터만으로는 다른 앱의 공유 시트를 다 못 봅니다 |

**기기에서 볼 것**

| 경우 | 기대 |
|---|---|
| 앱이 꺼진 채 공유 | 앱이 뜨고 보석함의 판이 그 글로 열림 |
| 앱이 뒤에 떠 있을 때 공유 | 지금 화면에서 보석함 판으로 감 |
| 로그인 안 한 채 공유 | 로그인 → 판이 그 글로 열림 |
| 같은 글이 두 번 열리지 않음 | 판을 닫고 뒤로 · 앞으로 가도 다시 안 열림 |
| 주소만 공유(구글 지도 · 인스타) | 주소가 칸에 놓이고 §3.2 문구. 네트워크 요청 없음 |
| 그림 공유 | 공유 시트에 FIT 이 안 뜸 |
| 4,000자 넘는 글 | 잘려서 들어옴 |
| 옛 웹(새 껍데기) · 새 웹(옛 껍데기) | 둘 다 고장 없이 아무 일 없음 |

## 8. 순서와 의존

0. **웹뷰에서 모델이 도는지 먼저 잽니다.** 지금 앱(재빌드 없이)에서 설정 →
   `DeviceGroup`(`settings.tsx:473-485`)이 뜨는지, 즉 웹뷰에서 `canParseHere` 가 참인지
   봅니다. 거짓이면 공유로 받은 글을 읽을 길이 앱에 없으므로 **이 계획을 접습니다.**
   `plan-paste-places.md` 는 브라우저 기능으로 남습니다.
1. **`plan-paste-places.md` 가 섭니다.** 관문을 넘고 판이 돌아야 합니다.
2. `talk.ts` 의 말 둘 — 양쪽이 같이 읽으므로 먼저.
3. 웹 쪽 `shell-share.web.ts` · `_layout.tsx` · `saved.tsx` — 웹에 먼저 올려도 옛
   껍데기에서는 아무 일도 안 일어납니다. 그래서 껍데기보다 먼저 나가도 됩니다.
4. 껍데기 `shell.tsx` · `app.json` — EAS 재빌드. 2차의 다른 것들과 한 번에.

## 9. 아직 모르는 것

- **웹뷰에서 모델이 도는지.** §8 의 0번입니다. 이 계획 전체가 여기 달려 있습니다.
- **다른 앱이 공유로 무엇을 넘기는지.** 네이버 블로그 앱, 인스타, 카카오톡, 구글 지도,
  네이버 지도가 `text/plain` 에 본문을 싣는지 주소만 싣는지 모릅니다. 대부분 주소만
  넘기면 이 계획은 「판을 빨리 여는 것」 이상을 못 합니다(`verdict.md` 「아직 모르는 것」).
  0번과 같은 때에 각 앱에서 공유해 보고 적어 둡니다.
- **`expo-sharing` 받기가 얼마나 서 있는지.** `@experimental` 입니다. 앱이 떠 있을 때
  새 공유가 `useIncomingShare` 에 다시 들어오는지(안드로이드의 `onNewIntent`), 같은
  공유가 앱을 다시 열 때 또 들어오는지는 구워 봐야 압니다. 또 들어오면
  `clearSharedPayloads()` 를 부르는 때를 고칩니다.
- **로그인을 거치는 동안 글이 남는지.** 웹 메모리에 들고 있으므로 같은 페이지 안의
  이동에서는 남습니다. 카카오 · 구글 로그인이 앱 위 브라우저를 띄웠다가 돌아올 때
  웹뷰가 다시 불러오면(`answer.ts:34-50`) 글을 잃습니다. 그때는 껍데기가 아직 들고
  있게(`takeShared` 를 판이 연 뒤에 비우게) 바꿀지 봅니다.
- **4,000자가 맞는지.** `plan-paste-places.md` §9 의 「긴 글을 어디서 자를지」 를 잰 뒤
  같은 값으로 맞춥니다.
