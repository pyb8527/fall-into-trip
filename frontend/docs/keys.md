# 구글 키와 클라이언트 ID

앱을 빌드하기 전에 채워야 하는 값들입니다. 하나라도 비면 **앱은 뜨는데 그
기능만 조용히 안 됩니다** — 지도는 회색 판으로, 구글 로그인은 눌러도 아무
일이 없거나 단추 자체가 안 뜹니다.

## 이 앱의 이름표

| | |
|---|---|
| 안드로이드 패키지 | `net.weeniebeenie.fit` |
| iOS 번들 ID | `net.weeniebeenie.fit` |
| URL scheme | `fit` |
| EAS 프로젝트 | `81e84073-2202-4fb2-9512-ecb87023c4fe` |

**안드로이드 서명 지문 (SHA-1)** — EAS 가 들고 있는 기본 키스토어:

```
3D:2F:72:82:0E:4B:DB:C2:B3:87:DA:75:37:7A:61:85:E4:64:3E:32
```

다시 확인하려면 `npx eas credentials -p android` → *Keystore: Manage everything*.

> **Play 에 올리면 지문이 하나 더 생깁니다.** 구글이 다시 서명하기 때문입니다.
> Play Console → 설정 → 앱 무결성 → 앱 서명 키 인증서의 SHA-1 을 **추가로**
> 등록하세요. 안 하면 "내 폰에선 되는데 스토어에서 받으면 안 되는" 상태가
> 됩니다. 콘솔의 두 항목 모두 지문을 여러 개 받으니 미리 넣어 둬도 됩니다.

## 지도 키 — 셋을 따로 만듭니다

하나를 돌려 쓸 수 없습니다. 제한 방식이 달라서, 하나로 묶으려면 제한을
아예 안 걸어야 합니다.

| 키 | 켤 API | 제한 | 들어가는 자리 |
|---|---|---|---|
| 웹 | Maps JavaScript API, Places API | HTTP 리퍼러 | `EXPO_PUBLIC_GMAPS_KEY` |
| 안드로이드 | Maps SDK for Android | 패키지 + SHA-1 | `GOOGLE_MAPS_ANDROID_KEY` |
| iOS | Maps SDK for iOS | 번들 ID | `GOOGLE_MAPS_IOS_KEY` |
| 서버 | Places API, Directions API | 서버 IP | `GOOGLE_MAPS_KEY` |

서버 키는 **브라우저·앱 번들에 안 들어갑니다.** 장소 검색과 길찾기를 서버가
대신 부르기 때문이고, 그래야 키가 밖으로 안 나갑니다.

안드로이드·iOS 키는 `app.config.js` 가 빌드할 때 환경 변수에서 읽습니다.
없으면 빌드 기록에 경고 한 줄이 남습니다 — 폰에 깔아 보고 나서야 아는
것보다 낫습니다.

## OAuth 클라이언트 ID — 셋을 따로 만듭니다

| 유형 | 넣을 것 | 들어가는 자리 |
|---|---|---|
| 웹 애플리케이션 | 승인된 JS 원본에 서비스 주소 | `GOOGLE_CLIENT_ID` (서버) |
| Android | 패키지 + SHA-1 | `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` |
| iOS | 번들 ID | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` |

안드로이드는 웹 클라이언트로 서명된 토큰을 내주는 흐름이 있어서, 웹 것도
같이 넘깁니다 — `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (값은 `GOOGLE_CLIENT_ID`
와 같은 것).

### 서버에 iOS·Android ID 를 알려 줘야 합니다

구글은 쪽마다 다른 클라이언트 ID 를 내주고, ID 토큰의 `aud` 에는 **받아 간
쪽의 ID** 가 박혀 옵니다. 서버가 웹 것 하나만 보고 있으면 앱에서 온 토큰이
전부 거절됩니다 — 남의 앱 토큰을 막으려는 검사인데 우리 앱까지 막는 셈입니다.

```
GOOGLE_AUDIENCES=<iOS 클라이언트 ID>,<Android 클라이언트 ID>
```

쉼표 사이에 **빈 자리가 생기지 않게** 하세요. 서버가 걸러 내기는 하지만,
그 자리는 원래 "아무 토큰이나 통과" 가 되는 곳입니다.

## 지금 들어가 있는 것

EAS 쪽(`npx eas env:list`):

| 이름 | 무엇 |
|---|---|
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | OAuth Android |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | OAuth iOS |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | OAuth 웹 |
| `GOOGLE_MAPS_ANDROID_KEY` | Maps SDK for Android |
| `EXPO_PUBLIC_GMAPS_KEY` | Maps JavaScript (웹) |
| `GOOGLE_SERVICES_JSON` | 파이어베이스 설정 파일 |

서버 쪽(뿌리 `.env`, 커밋 안 됨): `GOOGLE_CLIENT_ID`, `GOOGLE_AUDIENCES`,
`EXPO_PUBLIC_GMAPS_KEY`.

**아직 빈 것**

- `GOOGLE_MAPS_KEY` (서버) — 없으면 장소 검색과 길찾기가 꺼집니다.
  화면은 좌표를 직접 넣는 길을 안내합니다.
- `GOOGLE_MAPS_IOS_KEY` — iOS 빌드를 할 때 필요합니다.
- FCM 서비스 계정 키 — 없으면 알림만 안 옵니다.

## 어디에 넣나

### 서버 (docker compose)

저장소 뿌리의 `.env` — `.env.example` 을 베껴 쓰세요.

```
GOOGLE_MAPS_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_AUDIENCES=...,...
EXPO_PUBLIC_GMAPS_KEY=...
```

`EXPO_PUBLIC_GMAPS_KEY` 는 웹 이미지를 **빌드할 때** 박힙니다. 바꾸면
`docker compose up -d --build` 로 다시 구워야 반영됩니다.

### 앱 (EAS)

`eas.json` 에 적지 않습니다 — 저장소에 그대로 박히기 때문입니다. EAS 쪽에
넣어 두면 빌드가 꺼내 씁니다.

```
npx eas env:set --name GOOGLE_MAPS_ANDROID_KEY --value ...   --type string --visibility sensitive --scope project   --environment production --environment preview --environment development
```

파일은 `--type file --value <경로>` 로:

```
npx eas env:set --name GOOGLE_SERVICES_JSON --type file   --value C:/.../google-services.json --visibility secret --scope project   --environment production --environment preview --environment development
```

넣은 것 확인: `npx eas env:list`

> `eas secret:create` 는 옛 이름입니다. 지금은 `eas env:set` 입니다.

> `EXPO_PUBLIC_` 이 붙은 것은 **앱 번들에 박혀 나갑니다.** 비밀이 아닙니다 —
> 클라이언트 ID 와 지도 키는 원래 클라이언트가 들고 있어야 하는 값이고,
> 지켜 주는 것은 숨기는 것이 아니라 위의 제한(패키지·지문·번들 ID)입니다.

## 알림 (FCM / APNs)

지도·로그인과 별개입니다.

- **안드로이드**: Firebase 프로젝트에 같은 패키지(`net.weeniebeenie.fit`)로
  앱을 만들고 `google-services.json` 을 받아
  `npx eas credentials -p android` 에서 올립니다.
- **iOS**: Apple Developer 에서 APNs 키(.p8)를 만들어
  `npx eas credentials -p ios` 에서 올립니다.

서버는 이 둘을 직접 안 씁니다. Expo 가 대신 애플·구글에 넘깁니다.

## 빠뜨리면 어떻게 되나

| 빠진 것 | 증상 |
|---|---|
| 안드로이드/iOS 지도 키 | 지도가 회색 판. 앱은 안 죽습니다 |
| OAuth 클라이언트 ID | 구글 단추가 **아예 안 뜹니다** |
| `GOOGLE_AUDIENCES` | 단추는 뜨는데 눌러도 로그인 실패 |
| FCM / APNs | 알림 스위치는 켜지는데 안 옵니다 |

마지막 둘이 제일 찾기 어렵습니다 — 화면은 멀쩡해 보이기 때문입니다.
