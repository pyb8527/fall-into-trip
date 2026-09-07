# ============================================================================
#  API 서버
#  ---------------------------------------------------------------------------
#  빌드와 실행을 나눕니다. 실행 이미지에 JDK·Gradle·소스가 남아 있으면 크기도
#  크고, 서버에서 굳이 있을 이유가 없는 것들이 함께 놓입니다.
# ============================================================================

# --------------------------------------------------------------------- 빌드
FROM eclipse-temurin:17-jdk AS build

WORKDIR /src

# 의존성 목록만 먼저 넣습니다. 소스만 고쳤을 때 이 층을 다시 만들지 않도록.
COPY gradle/ gradle/
COPY gradlew settings.gradle build.gradle ./
RUN chmod +x gradlew

COPY src/ src/

# Gradle 캐시를 층 밖에 둡니다. 이미지에는 남지 않고 다음 빌드에서 재사용됩니다.
# 테스트는 여기서 돌리지 않습니다. DB 가 필요하고, 그건 CI 가 할 일입니다.
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon clean bootJar -x test

# bootJar 결과만 꺼냅니다. 이름에 버전이 붙으므로 찾아서 옮깁니다.
RUN find build/libs -name '*.jar' ! -name '*-plain.jar' -exec cp {} /app.jar \;

# --------------------------------------------------------------------- 실행
FROM eclipse-temurin:17-jre-alpine

# root 로 돌릴 이유가 없습니다.
RUN addgroup -S fit && adduser -S fit -G fit
USER fit

WORKDIR /app
COPY --from=build --chown=fit:fit /app.jar /app/app.jar

EXPOSE 8080

# 컨테이너에 준 메모리에 맞춰 힙을 잡습니다. 고정값으로 두면 메모리를 늘려도
# 그대로이고, 줄이면 그때 죽습니다.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseContainerSupport"

# compose 가 api 를 기다렸다가 web 을 띄울 수 있게 스스로 상태를 알립니다.
HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=6 \
    CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
