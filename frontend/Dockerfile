# ============================================================================
#  웹 프론트
#  ---------------------------------------------------------------------------
#  Expo 앱을 정적 파일로 뽑아 nginx 로 내보냅니다. 같은 소스가 iOS·Android
#  앱도 되지만, 그건 스토어로 나가는 길이라 여기서 다루지 않습니다.
#  (앱 개발은 로컬에서 `npx expo start`)
# ============================================================================

# --------------------------------------------------------------------- 빌드
FROM node:22-alpine AS build

WORKDIR /src

# 잠금 파일까지 함께 넣어 npm ci 로 정확히 같은 버전을 설치합니다.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# EXPO_PUBLIC_* 는 번들에 박히므로 실행할 때가 아니라 빌드할 때 정해야 합니다.
# 비워 두면 브라우저가 자기 주소로 /api 를 부르고, nginx 가 api 로 넘깁니다.
ARG EXPO_PUBLIC_API_BASE=""
ENV EXPO_PUBLIC_API_BASE=$EXPO_PUBLIC_API_BASE

# 지도 키도 번들에 박히므로 빌드할 때 들어와야 합니다. 비워 두면 지도와
# 장소 검색이 조용히 빠지고 나머지는 그대로 돕니다.
ARG EXPO_PUBLIC_GMAPS_KEY=""
ENV EXPO_PUBLIC_GMAPS_KEY=$EXPO_PUBLIC_GMAPS_KEY

# 지도 ID. 있으면 여행 요약의 「동선」이 기울인 벡터 지도에서 돕니다
# (components/replay-stage). 비워 두면 지금까지의 평평한 지도입니다.
ARG EXPO_PUBLIC_GMAPS_MAP_ID=""
ENV EXPO_PUBLIC_GMAPS_MAP_ID=$EXPO_PUBLIC_GMAPS_MAP_ID

# 카카오톡 공유 카드. JavaScript 키라 비밀이 아니고, 카카오 콘솔에 등록한
# 도메인에서만 돕니다. 비워 두면 카톡 단추가 빠지고 보통 공유만 남습니다.
ARG EXPO_PUBLIC_KAKAO_JS_KEY=""
ENV EXPO_PUBLIC_KAKAO_JS_KEY=$EXPO_PUBLIC_KAKAO_JS_KEY

RUN npx expo export --platform web

# --------------------------------------------------------------------- 실행
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
