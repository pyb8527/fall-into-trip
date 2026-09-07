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

RUN npx expo export --platform web

# --------------------------------------------------------------------- 실행
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
