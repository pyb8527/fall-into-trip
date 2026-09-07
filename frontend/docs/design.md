# 디자인 규격

화면을 만들 때 숫자를 새로 고르지 않기 위한 문서입니다. 값은 눈대중이
아니라 아래 근거에서 옮겨 왔고, 코드에서는 `src/constants/theme.ts` 의
이름으로만 씁니다.

밝은 화면 한 벌만 씁니다. 두 벌을 두면 어느 한쪽은 늘 덜 손질된 채로 남고,
색을 하나 고칠 때마다 두 군데를 맞춰야 합니다.

---

## 1. 색

토스 디자인 시스템(TDS)이 공개한 값을 그대로 옮겼습니다.

### 회색 10단계

| 이름 | 값 | 쓰는 곳 |
|---|---|---|
| grey900 | `#191F28` | 본문 글자 (`text`) |
| grey700 | `#4E5968` | 보조 설명 (`textSecondary`) |
| grey500 | `#8B95A1` | 곁다리 (`textMuted`) |
| grey400 | `#B0B8C1` | 못 누르는 것 (`textDisabled`) |
| grey200 | `#E5E8EB` | 선, 눌린 회색 칸 (`border`, `fillPressed`) |
| grey100 | `#F2F4F6` | 화면 바탕, 입력칸 (`background`, `fill`) |
| — | `#FFFFFF` | 카드 (`surface`) |

바탕을 흰색이 아니라 회색(`grey100`)으로 둡니다. 그 위에 흰 카드가 뜨면
선을 긋지 않고도 층이 나뉘어 화면이 조용합니다.

### 강조와 알림

| 이름 | 값 |
|---|---|
| `accent` / `accentPressed` / `accentSoft` | `#3182F6` / `#1B64DA` / `#E8F3FF` |
| `danger` / `dangerSoft` | `#F04452` / `#FFEEEE` |
| `success` / `successSoft` | `#15C47E` / `#F0FAF6` |
| `warning` / `warningSoft` | `#FF9F1C` / `#FFF4E5` |

못 누르는 버튼은 투명도를 낮추지 않고 아예 다른 색(`fill` + `textDisabled`)
으로 바꿉니다. 투명도만 낮추면 아래 배경이 비쳐 글자가 읽기 어려워집니다.

---

## 2. 글자

크기와 줄 높이는 TDS 본 타이포그래피 7단계 그대로입니다.

| 이름 | 크기 / 줄 높이 | 비율 | 쓰는 곳 |
|---|---|---|---|
| `display` | 30 / 40 | 1.33 | 아주 큰 제목 |
| `title` | 26 / 35 | 1.35 | 화면 제목 (한 화면에 하나) |
| `heading` | 22 / 31 | 1.41 | |
| `subheading` | 20 / 29 | 1.45 | |
| `body` | 17 / 25.5 | 1.50 | 본문, **입력칸**, 버튼 |
| `bodySmall` | 15 / 22.5 | 1.50 | 보조 본문 |
| `caption` | 13 / 19.5 | 1.50 | 메타 정보 |

**큰 글자일수록 줄 높이 비율이 낮습니다.** 제목은 붙어 있어야 덩어리로
읽히고, 본문은 벌어져 있어야 눈이 다음 줄을 찾습니다.

**자간은 음수로 좁힙니다.** 한글은 기본 자간이 성기게 보입니다. 큰 글자일
수록 더 좁힙니다 — `title` −0.7, `body` −0.3, `caption` −0.1.

**입력칸은 반드시 17(≥16)입니다.** iOS 사파리는 16 미만인 입력칸을 누르면
화면을 확대해 버립니다.

굵기는 400 / 500 / 600 / 700 네 단계만 씁니다.

---

## 3. 여백과 모서리

4의 배수로만 씁니다. 사이사이 값을 끼워 넣으면 금세 어긋납니다.

| 이름 | 값 | | 이름 | 값 |
|---|---|---|---|---|
| `xs` | 4 | | `xxl` | 24 |
| `sm` | 8 | | `xxxl` | 32 |
| `md` | 12 | | `huge` | 40 |
| `lg` | 16 | | | |
| `xl` | 20 | | | |

모서리: `sm` 8 (작은 버튼) · `md` 12 (버튼·입력칸) · `lg` 16 (카드) ·
`full` 999 (칩·배지).

- **화면 좌우 여백(`Gutter`) 20** — 가장 좁은 폰(360dp)에서도 320이 남아
  한 줄에 한글이 충분히 들어갑니다.
- **화면 블록 사이(`ScreenGap`) 36** — 제목·띠·카드처럼 서로 다른 이야기는
  카드 안쪽 간격(12)보다 훨씬 벌려야 덩어리로 나뉘어 읽힙니다. 4의 배수
  눈금에 없는 값이라 따로 이름을 붙여 둡니다.
- **본문 최대 폭 560** — 태블릿·웹에서 한 줄이 길어지면 눈이 다음 줄 첫
  글자를 잃습니다.
- 카드 안쪽 여백 20, 카드 안 요소 사이 12.

---

## 4. 누르는 크기

| 기준 | 최소 |
|---|---|
| Apple HIG | 44×44 pt |
| Material Design | 48×48 dp |
| WCAG 2.2 SC 2.5.8 (AA) | 24×24 px (바닥) |
| WCAG 2.2 SC 2.5.5 (AAA) | 44×44 px |

**어떤 것도 44 아래로 내려가지 않습니다.**

| 이름 | 값 | 쓰는 곳 |
|---|---|---|
| `Tap.min` | 44 | 모든 누르는 것의 하한 |
| `Tap.control` | 52 | 주 버튼, 입력칸 |
| `Tap.compact` | 36 | 줄 안의 작은 버튼이 **보이는** 높이 |
| `Tap.compactSlop` | 4 | 위아래로 넓혀 36 + 4×2 = 44 |

줄 안에 들어가는 작은 버튼은 44로 만들면 줄이 뚱뚱해집니다. 그래서 보기에는
36으로 두고 `hitSlop` 으로 실제 누르는 넓이를 44로 채웁니다. Apple 도
"보이는 크기와 누르는 넓이는 다를 수 있다" 고 씁니다.

---

## 5. 모바일에서 지키는 것

- **주 동작은 아래에 붙입니다.** 한 손으로 쥐면 엄지가 편히 닿는 곳은 화면
  아래 가운데이고, 위쪽 모서리는 거의 닿지 않습니다. `Screen` 의 `footer`
  가 그 자리입니다. (관찰 연구: 한 손 사용 49%, 터치의 약 75%가 엄지)
- **노치와 홈 인디케이터를 피합니다.** `useSafeAreaInsets` 로 위아래 여백을
  잡습니다. 헤더가 없는 화면은 `<Screen safeTop>`.
- **키보드가 입력칸을 덮지 않게 합니다.** iOS 는 `KeyboardAvoidingView` 로
  밀어 올리고, 안드로이드는 창 크기가 줄어드는 방식이라 건드리지 않습니다.
- **비었다고 버튼을 잠그지 않습니다.** 브라우저가 자동완성으로 칸을 채울 때
  `onChangeText` 가 불리지 않는 경우가 있어, 다 채워 놓고도 눌리지 않는
  버튼이 됩니다. 대신 눌렀을 때 확인하고 알려 줍니다.
- **되돌릴 수 없는 일은 그 자리에서 한 번 더 묻습니다**(`ConfirmButton`).
  React Native 의 `Alert` 은 웹에서 동작이 제각각입니다.

---

## 6. 로고

`src/ui/logo.tsx`

- **워드마크** `FIT` — 그림이 아니라 글자입니다. 어느 크기로 키워도
  뭉개지지 않고, 화면을 열 때 그림 파일을 기다리지 않으며, 색을 바꿔 쓸 수
  있습니다. 굵기 700, 자간 −0.5(글자끼리 붙어 한 덩어리로 보이게).
- **잠금 조합(`LogoLockup`)** — 워드마크 아래 `FALL INTO TRIP`.
  `size` 하나만 바꾸면 두 줄이 같은 비율로 커집니다.

  | | 비율 | size 80 일 때 |
  |---|---|---|
  | 설명 글자 크기 | 0.1875 | 15 |
  | 설명 자간 | 설명 글자 크기 × 0.24 | 3.6 |
  | 위 여백 | −0.0875 | −7 |

  위 여백이 음수인 것은, 큰 글자의 줄 상자에 글자 아래 여유가 붙어 있어
  그만큼 당겨야 두 줄이 한 덩어리로 보이기 때문입니다.

  쓰는 크기: 로그인·가입·시작 화면 80, 최초 설치 34, 내 계정 카드 22.

- 앱 아이콘과 시작 화면은 그림이어야 하므로 `icon.png` ·
  `splash-icon.png` 를 씁니다. iOS 앱 아이콘에는 투명도가 들어가면 안 되므로
  흰 바탕 그대로 둡니다.

---

## 근거

- [Apple Human Interface Guidelines — Layout (44pt 최소 탭 영역)](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Material Design — Accessibility (48dp 최소 터치 타깃)](https://m3.material.io/foundations/designing/structure)
- [WCAG 2.2 SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [TDS React Native — Typography](https://tossmini-docs.toss.im/tds-react-native/foundation/typography/)
- [TDS React Native — Colors](https://tossmini-docs.toss.im/tds-react-native/foundation/colors/)
- [The Thumb Zone: Designing For Mobile Users — Smashing Magazine](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/)
