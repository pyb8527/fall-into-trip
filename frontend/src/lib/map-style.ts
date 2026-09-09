/**
 * 조용한 지도.
 *
 * <p>구글이 주는 기본 지도는 그 자체로 이미 꽉 차 있습니다. 가게 이름, 도로
 * 번호, 상권 표시가 색색으로 얹혀 있어서 그 위에 우리 핀과 동선을 올리면
 * 어느 것이 내 일정인지 골라내야 합니다.
 *
 * <p>여기서 한 일은 <b>지도를 예쁘게 만든 것</b>이 아니라 <b>지도를 조용하게
 * 만든 것</b>입니다. 땅·물·길은 서로 겨우 구별될 만큼만 남기고, 구글이 찍어
 * 주는 가게 표시는 지웠습니다. 그래야 우리가 찍은 것이 화면에서 가장 진한
 * 것이 됩니다.
 *
 * <p>바탕은 화면 배경(#F5F4F1)보다 아주 조금 밝습니다. 같으면 지도가 어디서
 * 시작하는지 알 수 없고, 많이 밝으면 창처럼 뚫려 보입니다.
 *
 * <p>웹과 앱이 같은 값을 씁니다. 둘이 갈리면 같은 여행을 폰과 브라우저에서
 * 볼 때 다른 지도가 됩니다.
 */
export const QUIET_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#F7F6F3' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B867D' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  /* 아이콘은 전부 끕니다. 구글이 찍어 주는 가게 표시가 우리 핀과 뒤섞이면
     어느 것이 내 일정인지 알 수 없습니다. */
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  /* 행정구역 경계선은 두되 흐리게. 어느 동네인지는 알아야 합니다. */
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#E2DFD8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5C5852' }],
  },

  /* 가게·상권 이름은 지웁니다. 이것이 켜져 있으면 도시 지도가 글자로 덮입니다. */
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#EFEDE7' }] },
  /* 공원만 남깁니다. 걸어 다닐 때 초록 덩어리가 있으면 방향을 잡기 쉽습니다. */
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E3EDE3' }] },

  /* 길 — 큰길일수록 진합니다. 도시의 뼈대가 보여야 동선이 어디를 지나는지
     읽힙니다. 길 이름은 지웁니다. 우리 동선과 겹쳐 읽기 어려워집니다. */
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#EAE7E0' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F1EDE4' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#E0D9CB' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  /* 철길은 도시에서 좋은 이정표입니다. 길보다 조금 다른 색으로 둡니다. */
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#E9E5DC' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  /* 물 — 뭍의 모양이 또렷하도록 한 단 낮춘 파랑으로. 기본 지도의 물색은
     선명해서 그것만 먼저 눈에 띕니다. */
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D7E4E6' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#93A5A8' }] },
] as const;
