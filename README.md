# FIT — fall into trip

여행 일정을 짜고, 동선을 지도에서 보고, 가계부를 함께 쓰는 곳.

## 어떻게 쓰나

1. 가입하고 여행을 하나 만듭니다.
2. 며칠짜리인지 정하면 날짜가 자동으로 깔립니다.
3. 날짜마다 갈 곳을 넣습니다. 시간을 적으면 알아서 시간순으로 섭니다.
4. 같이 가는 사람에게 **초대 링크**를 보냅니다. 상대 이메일을 몰라도 됩니다.
5. 동행자와 일정을 함께 고치고, 쓴 돈을 적어 두면 나중에 정산됩니다.

## 무엇으로 되어 있나

```
backend/    Spring Boot 3.3 · Java 17 · PostgreSQL 16 · Flyway
frontend/   Expo(React Native) 57 · expo-router · react-native-web
            같은 코드가 iOS·Android 앱이 되고, 웹으로도 뽑힙니다.
```

컨테이너는 셋을 따로 띄웁니다 — **db**, **api**, **fit**(웹).
밖으로 열리는 문은 fit(nginx) 하나뿐이고, nginx 가 `/api` 를 api 로 넘깁니다.
브라우저 입장에서 화면과 API 가 같은 주소라 CORS 를 타지 않고, 리프레시
쿠키도 `SameSite=Lax` 로 안전하게 실립니다.

## 통째로 띄우기

```bash
cp .env.example .env      # JWT_SECRET, DB_PASSWORD, SETUP_TOKEN 을 채웁니다
docker compose up -d --build
```

`http://localhost:8080` 에서 열립니다. 운영자가 없으면 최초 설치 화면이
먼저 나옵니다. 거기에 `.env` 의 `SETUP_TOKEN` 을 넣으면 첫 운영자가 됩니다.

> `SECURE_COOKIE` 는 HTTPS 뒤에 둘 때 반드시 `true` 로 바꾸세요.
> `false` 인 채로 인터넷에 올리면 리프레시 토큰이 평문으로 오갑니다.

## 내 서버에 올리기 — Cloudflare 터널

공유기 포트를 열지 않고 밖에서 들어오게 합니다. `cloudflared` 가 서버 안에서
Cloudflare 로 나가는 연결을 직접 맺고, 들어온 요청을 `web` 으로 넘깁니다.
방화벽에 구멍을 내지 않으므로 서버 주소가 드러나지 않습니다.

### 1. 터널 만들기

Zero Trust 대시보드 → **Networks → Tunnels → Create a tunnel** → 이름을 짓고
**Cloudflared** 를 고릅니다. 설치 명령에 들어 있는 **토큰**만 복사하세요
(명령 자체는 쓰지 않습니다. 우리는 compose 로 띄웁니다).

이어서 **Routes → Published application** 에서 공개 주소와 서비스를 잇습니다.

| 칸 | 값 |
|---|---|
| Subdomain / Domain | 예: `fit` / `weenie-beenie.net` |
| Type | `HTTP` |
| URL | `fit:80` |

`fit` 은 compose 안의 서비스 이름이자 그 네트워크에서의 주소입니다.
`localhost` 를 적으면 cloudflared 컨테이너 자기 자신을 가리켜 연결되지 않습니다.

cloudflared 를 이 compose 밖에서 따로 돌리고 있다면 이 이름으로는 닿지
않습니다. 같은 네트워크에 있어야 합니다 — `--profile tunnel` 로 함께 띄우는
편이 간단합니다.

### 2. `.env` 채우기

```bash
cp .env.example .env
```

| 값 | 넣을 것 |
|---|---|
| `TUNNEL_TOKEN` | 1번에서 복사한 토큰 |
| `SECURE_COOKIE` | **`true`** — 이제 HTTPS 로 들어옵니다 |
| `WEB_BIND` | **`127.0.0.1`** — 바깥으로 나가는 길을 터널 하나로 좁힙니다 |
| `CORS_ORIGINS` | `https://fit.weenie-beenie.net` |
| `JWT_SECRET`·`DB_PASSWORD`·`SETUP_TOKEN` | 각각 새로 만든 값 |
| `EXPO_PUBLIC_GMAPS_KEY` | 지도를 쓸 때만 |

### 3. 띄우기

```bash
docker compose --profile tunnel up -d --build
docker compose --profile tunnel logs -f cloudflared   # 연결 확인
```

`Registered tunnel connection` 이 보이면 붙은 것입니다. 대시보드의 터널
상태도 **HEALTHY** 로 바뀝니다.

### 꼭 함께 할 것

- **`SECURE_COOKIE=true`** — 안 바꾸면 리프레시 쿠키에 `Secure` 가 빠집니다.
- **구글 지도 키 리퍼러에 공개 도메인 추가** — `fit.weenie-beenie.net/*`.
  키는 번들에 박히므로 **바꾼 뒤 `--build` 로 다시 빌드**해야 반영됩니다.
- **최초 운영자를 만든 뒤 `SETUP_TOKEN` 을 비우고** 다시 띄우세요. 그 토큰이
  살아 있는 한 그것을 아는 사람은 운영자 자리를 노릴 수 있습니다.

### 운영 화면을 한 겹 더 잠그고 싶다면

Zero Trust → **Access → Applications** 에서 `fit.weenie-beenie.net/admin` 을
자체 호스팅 앱으로 등록하고 이메일 정책을 걸면, 로그인 화면에 닿기 전에
Cloudflare 가 먼저 막습니다. 앱 안의 운영자 권한 검사와 별개로 한 겹 더입니다.

### 알아 둘 것

- 터널은 **한 방향(서버 → Cloudflare)** 으로만 나갑니다. 공유기에 포트를
  열지 않아도 되고, 열려 있다면 닫아도 됩니다.
- `restart: unless-stopped` 라 서버를 다시 켜면 알아서 붙습니다.
- 토큰은 그 자체로 이 터널에 붙을 수 있는 자격입니다. 비밀번호처럼 다루세요.
  샜다고 생각되면 대시보드에서 터널을 지우고 다시 만드는 편이 빠릅니다.


## 개발하며 띄우기

DB 만 컨테이너로 띄우고 나머지는 로컬에서 돌립니다. 그래야 고치는 즉시
반영되고 디버거를 붙일 수 있습니다.

> **두 compose 를 동시에 띄우지 마세요.** 같은 폴더에서 부르면 도커는 둘을
> 한 프로젝트로 봅니다. 서비스 이름(`db`)이 겹치므로 나중에 부른 쪽이 앞의
> DB 컨테이너를 갈아 끼웁니다. 굳이 함께 띄워야 한다면 프로젝트를 나누세요.
>
> ```bash
> docker compose -p fit-prod up -d --build
> ```

```bash
docker compose -f docker-compose.dev.yml up -d      # PostgreSQL (5433)

# API
cd backend
DB_URL="jdbc:postgresql://localhost:5433/fit" DB_USER=fit DB_PASSWORD=fit \
JWT_SECRET="32바이트 이상" SETUP_TOKEN=devtoken SECURE_COOKIE=false \
CORS_ORIGINS=http://localhost:8081 ./gradlew bootRun

# 화면 — 웹으로 보기
cd frontend && npx expo start --web

# 화면 — 폰으로 보기 (Expo Go 로 QR 스캔)
cd frontend && npx expo start
```

실기기로 볼 때는 `localhost` 가 폰 자신을 가리키므로 개발 PC 의 LAN 주소를
넣어 줍니다.

```bash
EXPO_PUBLIC_API_BASE=http://192.168.0.10:8080 npx expo start
```

## 앱으로 빌드하기

Expo 앱은 **EAS Build** 로 만듭니다. 실제 컴파일은 Expo 클라우드에서 일어나므로
맥 없이도 iOS 빌드가 되고, 서버에서 돌릴 이유도 없습니다 — 어느 컴퓨터에서
해도 결과는 같습니다.

```bash
cd frontend
npx eas-cli@latest login       # expo.dev 계정
npx eas-cli@latest init        # app.json 에 projectId 를 넣어 줍니다
```

전역 설치가 편하면 `npm i -g eas-cli` 뒤 `eas` 로 부르면 됩니다.

### 지도 키는 파일에 넣지 않습니다

`eas.json` 과 `app.json` 은 깃에 올라갑니다. 키를 적어 두면 저장소에 그대로
박힙니다. EAS 쪽에 넣어 두고 빌드할 때 꺼내 쓰게 합니다.

환경마다 따로 넣습니다. 이름은 `eas.json` 의 프로필과 짝입니다.

```bash
npx eas-cli@latest env:set --name GOOGLE_MAPS_ANDROID_KEY --value "…" --environment preview --visibility sensitive

npx eas-cli@latest env:list --environment preview   # 들어갔는지 확인
```

`sensitive` 로 두면 대시보드에서 값이 가려집니다.

**웹에서 쓰는 키와 다른 것이어야 합니다.** 제한 방식도, 켜야 하는 API 도
다릅니다.

| | 웹 | 안드로이드 앱 | 서버(장소 찾기) |
|---|---|---|---|
| 켤 API | Maps **JavaScript** API | Maps **SDK for Android** | **Places** API |
| 제한 | HTTP 리퍼러 | 패키지명 + SHA-1 | 서버 IP |
| 들어가는 곳 | 브라우저 번들 | 앱 번들 | 서버에만 |

안드로이드 키에 걸 제한은 이렇게 잡습니다.

| 항목 | 값 |
|---|---|
| 애플리케이션 제한 | Android 앱 |
| 패키지 이름 | `net.weeniebeenie.fit` |
| SHA-1 인증서 지문 | 아래에서 확인 |
| API 제한 | Maps SDK for Android |

SHA-1 은 EAS 가 만들어 보관하는 키스토어에 있습니다.

```bash
npx eas-cli@latest credentials
# Android → 프로필 고르기 → Keystore → SHA1 Fingerprint
```

`EXPO_PUBLIC_API_BASE` 는 비밀이 아니라 그냥 주소이므로 `eas.json` 에 적어
두었습니다. 앱은 자기 주소가 없어서 서버를 명시해야 합니다 — 웹처럼 비워
두면 아무 데도 못 붙습니다.

### 빌드

```bash
# 폰에 바로 설치해서 볼 APK
npx eas-cli@latest build --profile preview --platform android

# 스토어용
npx eas-cli@latest build --profile production --platform android
npx eas-cli@latest build --profile production --platform ios    # 애플 개발자 계정 필요
```

끝나면 링크와 QR 이 나옵니다. APK 는 폰에서 받아 바로 설치하면 됩니다.

### 고친 뒤 다시 빌드하지 않아도 되는 것

`expo-updates` 를 붙여 두었습니다. **화면 코드와 이미지 변경은 재빌드 없이**
밀어 넣을 수 있습니다.

```bash
npx eas-cli@latest update --branch preview --message "무엇을 고쳤는지"
```

앱을 껐다 켜면 새 것을 받아 옵니다. 스토어 심사도 필요 없습니다.

**다만 JS 만 됩니다.** 이런 것은 여전히 다시 빌드해야 합니다.

- 새 네이티브 모듈 (예: 지도, 달력 같은 것을 새로 붙일 때)
- `app.json` 의 네이티브 설정 (아이콘, 권한, 패키지 이름, 지도 키)
- Expo SDK 올리기

`runtimeVersion` 을 앱 버전에 묶어 두었습니다. 네이티브가 바뀌어 버전을
올리면 옛 빌드에는 새 JS 가 내려가지 않습니다 — 맞지 않는 짝이 만나 죽는
것을 막습니다.

### 한 번 정하면 바꾸기 어려운 것

`app.json` 의 `ios.bundleIdentifier` 와 `android.package` 를
`net.weeniebeenie.fit` 로 두었습니다. 스토어와 기기가 앱을 알아보는 이름이라,
나중에 바꾸면 **다른 앱**이 됩니다. 설치된 앱이 갱신되지 않고 따로 깔립니다.


## 운영 화면

운영자(`ADMIN`)로 로그인하면 **내 계정 → 운영 화면 열기** 가 보입니다.

- **계정 관리** — 검색·필터, 운영자 승격/해제, 계정 잠금, 비밀번호 재설정,
  세션 강제 종료, 삭제.
- **감사 로그** — 누가 무엇을 했는지. 활동·사람·기간으로 거릅니다.

계정을 다루는 자리라 몇 가지를 막아 둡니다.

- 자기 권한을 스스로 낮추거나, 자기 계정을 잠그거나 지울 수 없습니다.
- 살아 있는 마지막 운영자는 강등·잠금·삭제할 수 없습니다.
- 잠그기·권한 변경·비밀번호 재설정은 그 계정의 세션을 함께 끊습니다.
  토큰 안에 옛 권한이 박혀 있기 때문입니다.
- 여행이나 기록이 남아 있는 계정은 지울 수 없고, 잠그라고 안내합니다.

## 점검

HTTP 로 실제 서버를 두드리는 방식입니다. 서버를 먼저 띄워 두세요.

```bash
node backend/src/test/http/auth.test.mjs       # 인증·토큰 회전·재사용 감지
node backend/src/test/http/invite.test.mjs     # 가입·초대 링크·공동 편집
node backend/src/test/http/trip.test.mjs       # 여행·날짜·장소·동선 그림
node backend/src/test/http/copy.test.mjs       # 여행 복제·동선 정리·알림
node backend/src/test/http/admin.test.mjs      # 운영자 계정 관리·감사 로그
node backend/src/test/http/guest.test.mjs      # 계정 없이 어디까지 되는지
node backend/src/test/http/community.test.mjs  # 글 올리기·복제·링크 미리보기
node backend/src/test/http/comment.test.mjs    # 댓글과 신고
node backend/src/test/http/tip.test.mjs        # 장소 팁과 신고
node backend/src/test/http/expense.test.mjs    # 가계부와 정산
node backend/src/test/http/candidate.test.mjs  # 후보와 투표
node backend/src/test/http/saved.test.mjs      # 보석함
node backend/src/test/http/folder.test.mjs     # 여행 폴더
node backend/src/test/http/live.test.mjs       # 임시 핀과 실시간 위치
node backend/src/test/http/icon.test.mjs       # 핀 그림과 이동 비교
node backend/src/test/http/place.test.mjs      # 장소 찾기
node backend/src/test/http/recommend.test.mjs  # 말로 묻고 갈 곳 받기
```

`place`·`recommend` 와 동선 그림은 구글 키가 있어야 끝까지 갑니다. 키가
없으면 그 앞의 울타리(권한·검증·꺼져 있을 때의 안내)만 봅니다 — 거기까지가
눈으로 지키기 어려운 자리이고, 결과가 맞는지는 키를 넣고 사람이 눌러 봐야
아는 일입니다.

각 묶음은 깨끗한 DB 에서 하나씩 돌려야 합니다. 서로의 계정과 여행이 남아
있으면 뒤엣것이 어긋납니다.

```bash
docker compose -f docker-compose.dev.yml down -v && docker compose -f docker-compose.dev.yml up -d
```

기본 주소는 `http://127.0.0.1:8080` 이고, `BASE` 로 바꿀 수 있습니다.

```bash
BASE=http://127.0.0.1:8090 node backend/src/test/http/admin.test.mjs
```

프론트는 타입 검사와 웹 번들로 확인합니다.

```bash
cd frontend
npm run typecheck
npm run export:web
```
