/**
 * 조용한 지도.
 *
 * <p>구글이 주는 기본 지도는 그 자체로 이미 꽉 차 있습니다. 가게 이름, 도로
 * 번호, 상권 표시가 색색으로 얹혀 있어서 그 위에 우리 핀과 동선을 올리면
 * 어느 것이 내 일정인지 골라내야 합니다.
 *
 * <p>여기서 한 일은 <b>지도를 예쁘게 만든 것</b>이 아니라 <b>지도를 조용하게
 * 만든 것</b>입니다. 그래야 우리가 찍은 것이 화면에서 가장 진한 것이 됩니다.
 *
 * <h3>한 번 너무 멀리 밀었습니다</h3>
 *
 * <p>처음에는 poi·transit·road 의 라벨을 <b>통째로</b> 껐습니다. 그러자 지도에
 * 기준이 될 글자가 하나도 안 남았습니다 — 주요 역도, 공원 이름도, 큰길
 * 이름도 없으니 <b>지도만 보고는 여기가 어딘지 알 수 없었습니다.</b> 조용한
 * 것과 아무 말도 안 하는 것은 다릅니다.
 *
 * <p>가르는 기준을 바꿉니다. 「글자인가」가 아니라 <b>「우리 핀과 다투는가」</b>
 * 입니다.
 *
 * <p>다투는 것 — <b>가게</b>(poi.business). 핀이 서는 자리가 바로 가게라,
 * 켜 두면 내가 넣은 곳과 구글이 아는 곳이 같은 모양으로 섞입니다. 끕니다.
 *
 * <p>다투지 않고 도와주는 것 — <b>역</b>(transit.station.rail·airport),
 * <b>동네 이름</b>(administrative), <b>공원과 명소</b>(poi.park·attraction),
 * <b>큰길 이름</b>(arterial·highway). 이것들은 내 일정이 아니라 <b>땅</b>을
 * 말합니다. 여행에서 "여기가 어디지" 에 답하는 것이 대개 역 이름입니다.
 *
 * <p>버스 정류장은 끕니다(transit.station.bus). 역과 달리 한 블록에 몇 개씩
 * 있어서, 켜면 그것만으로 화면이 덮입니다.
 *
 * <p>골목 이름도 끕니다(road.local). 큰길과 달리 수가 너무 많고, 우리 동선이
 * 지나는 자리가 바로 골목입니다.
 *
 * <p>바탕은 화면 배경(#F5F4F1)보다 아주 조금 밝습니다. 같으면 지도가 어디서
 * 시작하는지 알 수 없고, 많이 밝으면 창처럼 뚫려 보입니다.
 *
 * <p>웹과 앱이 같은 값을 씁니다. 둘이 갈리면 같은 여행을 폰과 브라우저에서
 * 볼 때 다른 지도가 됩니다.
 *
 * <h3>규칙은 넓은 것부터 적습니다</h3>
 *
 * <p>구글은 좁은 선택이 넓은 선택을 덮습니다. 「poi 는 이렇게」를 먼저 적고
 * 「그중 공원은 이렇게」를 뒤에 적어야 읽는 사람도 그 순서로 이해합니다.
 */
export const QUIET_MAP = [
  /* ---------------------------------------------------------------- 바탕 */
  { elementType: 'geometry', stylers: [{ color: '#F7F6F3' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B867D' }] },
  /* 글자 뒤에 흰 테를 두릅니다. 지도 위의 글자는 제 바탕을 못 고르므로,
     테가 없으면 공원 초록이나 물 위에서 뭉개집니다. */
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },

  /* ------------------------------------------------------- 동네와 경계 */
  /* 행정구역 경계선은 두되 흐리게. 어느 동네인지는 알아야 합니다. */
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#E2DFD8' }] },
  /* 도시·구 이름은 가장 또렷하게. 지도를 줄여 볼 때 이것 하나로 위치를
     잡습니다. */
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4A463F' }],
  },
  /* 동 이름. 걸어 다니는 배율에서 "여기가 어디지" 에 답하는 글자입니다. */
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6B665E' }],
  },

  /* ------------------------------------------------------------ 가게·명소 */
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#EFEDE7' }] },
  /* 구글이 찍어 주는 알약 그림은 전부 끕니다. 우리 핀과 같은 모양이라
     켜 두면 어느 것이 내 일정인지 알 수 없습니다. */
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  /*
    가게 이름은 끕니다.

    <p>핀이 서는 자리가 바로 가게입니다. 내가 넣은 「이치란」 옆에 구글이 아는
    「이치란」 이 글자로 또 서면, 같은 곳이 둘로 보입니다.
  */
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  /* 공원은 초록 덩어리로 남깁니다. 걸어 다닐 때 방향을 잡기 쉽습니다. */
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E3EDE3' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6E8A6E' }] },
  /* 관광 명소 이름은 남깁니다 — 가게가 아니라 땅의 이름에 가깝고, 여행에서
     위치를 말할 때 쓰는 말입니다("성 옆에"). */
  {
    featureType: 'poi.attraction',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6B665E' }],
  },

  /* ---------------------------------------------------------------- 길 */
  /* 큰길일수록 진합니다. 도시의 뼈대가 보여야 동선이 어디를 지나는지 읽힙니다. */
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#EAE7E0' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  /* 골목 이름은 끕니다. 수가 너무 많고, 우리 동선이 지나는 자리가 바로
     골목입니다. */
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  /* 큰길 이름은 옅게 남깁니다. 길 위에서 "이 길이 무슨 길" 을 알면 방향이
     잡히는데, 진하면 우리 동선과 겹쳐 읽기 어려워집니다. */
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#A39C92' }],
  },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F1EDE4' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#E0D9CB' }] },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#A39C92' }],
  },

  /* ------------------------------------------------------------ 철길과 역 */
  /* 철길은 도시에서 좋은 이정표입니다. 길보다 조금 다른 색으로 둡니다. */
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#DFDAD0' }] },
  /* 노선 이름은 끕니다. 역 이름과 겹쳐 서서 같은 자리를 두 번 말합니다. */
  { featureType: 'transit.line', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  /*
    역 이름은 진하게 남깁니다.

    <p>여행에서 "여기가 어디지" 에 답하는 것이 대개 역 이름입니다. 묶을 때도
    역을 기준으로 생각하고("신주쿠역 근처"), 길을 찾을 때도 역에서 셉니다.
    동네 이름과 같은 무게로 둡니다.
  */
  {
    featureType: 'transit.station.rail',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4A463F' }],
  },
  /* 역 그림은 켭니다. 위에서 poi 아이콘을 통째로 껐는데, 역 그림은 우리 핀과
     모양이 달라 안 다투고 글자 없이도 한눈에 잡힙니다. */
  {
    featureType: 'transit.station.rail',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'transit.station.airport',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4A463F' }],
  },
  {
    featureType: 'transit.station.airport',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'on' }],
  },
  /* 버스 정류장은 끕니다. 역과 달리 한 블록에 몇 개씩 있어서, 켜면 그것만으로
     화면이 덮입니다. */
  { featureType: 'transit.station.bus', stylers: [{ visibility: 'off' }] },

  /* ---------------------------------------------------------------- 물 */
  /* 뭍의 모양이 또렷하도록 한 단 낮춘 파랑으로. 기본 지도의 물색은 선명해서
     그것만 먼저 눈에 띕니다. */
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D7E4E6' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#93A5A8' }] },
] as const;
