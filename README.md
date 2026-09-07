# FIT — fall into trip

여행 일정을 짜고, 동선을 지도에서 보고, 가계부를 함께 쓰는 곳.

## 어떻게 쓰나

1. 가입하고 여행을 하나 만듭니다.
2. 며칠짜리인지 정하면 날짜가 자동으로 깔립니다.
3. 날짜마다 갈 곳을 넣습니다. 시간을 적으면 알아서 시간순으로 섭니다.
4. 같이 가는 사람에게 **초대 링크**를 보냅니다. 상대 이메일을 몰라도 됩니다.
5. 동행자와 일정을 함께 고치고, 쓴 돈을 적어 두면 나중에 정산됩니다.

## 띄우기

```bash
docker compose -f docker-compose.dev.yml up -d      # PostgreSQL
cd backend
DB_URL="jdbc:postgresql://localhost:5433/fit" DB_USER=fit DB_PASSWORD=fit \
JWT_SECRET="32바이트 이상" SETUP_TOKEN=devtoken SECURE_COOKIE=false \
./gradlew bootRun
```

## 점검

```bash
node backend/src/test/http/auth.test.mjs      # 인증·토큰
node backend/src/test/http/invite.test.mjs    # 가입·초대·공동 편집
```

각 묶음은 깨끗한 DB 에서 돌려야 합니다.
```bash
docker compose -f docker-compose.dev.yml down -v && docker compose -f docker-compose.dev.yml up -d
```
