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

컨테이너는 셋을 따로 띄웁니다 — **db**, **api**, **web**.
밖으로 열리는 문은 web(nginx) 하나뿐이고, nginx 가 `/api` 를 api 로 넘깁니다.
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
node backend/src/test/http/auth.test.mjs      # 인증·토큰
node backend/src/test/http/invite.test.mjs    # 가입·초대·공동 편집
node backend/src/test/http/trip.test.mjs      # 여행·날짜·장소
node backend/src/test/http/admin.test.mjs     # 운영자 계정 관리·감사 로그
```

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
