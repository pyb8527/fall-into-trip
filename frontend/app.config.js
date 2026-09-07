/**
 * app.json 위에 얹는 설정.
 *
 * 안드로이드 지도 키는 빌드할 때 환경 변수에서 받습니다. 파일에 적어 두면
 * 저장소에 그대로 박히기 때문입니다. EAS 쪽 환경 변수로 넣어 두면 빌드가
 * 꺼내 씁니다.
 *
 * 이 키는 웹에서 쓰는 키와 다른 것이어야 합니다. 제한 방식이 다릅니다 —
 * 웹은 HTTP 리퍼러로, 안드로이드는 패키지 이름과 서명 지문(SHA-1)으로
 * 묶습니다. 필요한 API 도 Maps SDK for Android 로 따로입니다.
 *
 * 키가 없으면 지도가 회색 판으로 뜹니다. 앱이 죽지는 않습니다.
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
      },
    },
  },
});
