/**
 * app.json 위에 얹는 설정.
 *
 * <h3>키는 파일에 안 적습니다</h3>
 *
 * 지도 키를 app.json 에 적어 두면 저장소에 그대로 박힙니다. 빌드할 때
 * 환경 변수에서 받습니다 — EAS 쪽에 넣어 두면(`eas secret:create`) 빌드가
 * 꺼내 씁니다.
 *
 * <h3>쪽마다 다른 키입니다</h3>
 *
 * 웹·iOS·안드로이드가 <b>각각 다른 키</b>를 씁니다. 제한 방식이 다르기
 * 때문입니다 — 웹은 HTTP 리퍼러로, 안드로이드는 패키지 이름과 서명
 * 지문(SHA-1)으로, iOS 는 번들 ID 로 묶습니다. 켜야 할 API 도 각각
 * Maps JavaScript / Maps SDK for Android / Maps SDK for iOS 로 따로입니다.
 *
 * 하나를 돌려 쓰면 제한을 못 걸거나(전부 허용해야 하므로) 셋 중 둘에서
 * 거절당합니다.
 *
 * <h3>없으면 회색 판입니다</h3>
 *
 * 키가 없어도 앱은 뜹니다. 지도만 회색으로 남습니다 — 그런데 그것이
 * <b>조용히</b> 일어나서, 빌드해서 폰에 깔고 나서야 압니다. 그래서 빌드할 때
 * 한 줄 적어 둡니다.
 */

const ANDROID_MAPS = process.env.GOOGLE_MAPS_ANDROID_KEY;
const IOS_MAPS = process.env.GOOGLE_MAPS_IOS_KEY;

/*
  파이어베이스 설정 파일.

  <p>알림(FCM)에 필요합니다. 저장소에 안 둡니다 — 이 파일 자체가 비밀은
  아니지만 프로젝트 번호와 키가 들어 있고, 무엇보다 저장소에 두면 누가
  고쳐 놓아도 알아채기 어렵습니다.

  <p>EAS 쪽에 파일로 올려 두면 빌드할 때 풀어 놓고 그 경로를 여기 넣어
  줍니다(GOOGLE_SERVICES_JSON). 없으면 알림만 안 오고 나머지는 그대로
  돕니다.
*/
const SERVICES = process.env.GOOGLE_SERVICES_JSON;

module.exports = ({ config }) => {
  /* 빌드 기록에 남습니다. 폰에 깔아 보고 나서야 아는 것보다 낫습니다. */
  if (!ANDROID_MAPS) {
    console.warn('[FIT] GOOGLE_MAPS_ANDROID_KEY 가 없습니다 — 안드로이드 지도가 회색으로 뜹니다.');
  }
  if (!IOS_MAPS) {
    console.warn('[FIT] GOOGLE_MAPS_IOS_KEY 가 없습니다 — iOS 지도가 회색으로 뜹니다.');
  }
  if (!SERVICES) {
    console.warn('[FIT] GOOGLE_SERVICES_JSON 이 없습니다 — 안드로이드 알림이 안 옵니다.');
  }

  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: IOS_MAPS,
      },
    },
    android: {
      ...config.android,
      /* 없으면 아예 안 넣습니다. 빈 문자열을 넣으면 빌드가 그 경로를
         찾다가 터집니다. */
      ...(SERVICES ? { googleServicesFile: SERVICES } : {}),
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: ANDROID_MAPS,
        },
      },
    },
  };
};
