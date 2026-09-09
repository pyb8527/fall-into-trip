/**
 * 지도·장소 검색이 주고받는 모양.
 *
 * 웹과 앱 구현이 각각 따로 있어서(.web.tsx / .tsx), 타입은 어느 쪽도 아닌
 * 이 파일에 둡니다. 그래야 화면 코드가 어느 구현을 보든 같은 타입을 씁니다.
 */

export type MapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 몇째 날인지. 같은 날끼리 선으로 잇습니다. */
  dayIndex: number;
  /** 그날 안에서 몇 번째인지. 핀에 적습니다. */
  order: number;
  /**
   * 핀 안에 그릴 그림.
   *
   * <p>같은 모양 핀이 스무 개 꽂혀 있으면 지도는 그냥 점의 무리입니다.
   * 라멘집인지 온천인지가 핀만 보고 읽히면, 다 짜 놓은 지도를 한 장으로
   * 찍었을 때 그것이 곧 여행의 요약이 됩니다.
   *
   * <p>비어 있으면 번호만 찍힌 핀을 그립니다.
   */
  emoji?: string;
  color: string;
  /** 공항처럼 멀리 떨어진 곳. 화면을 맞출 때 뺍니다. */
  fit: boolean;
  radius: number | null;
  /** 전체화면에서 핀을 눌렀을 때 바텀시트에 보여 줄 것들. */
  detail: {
    time: string | null;
    cat: string | null;
    cost: string | null;
    note: string | null;
    sub: string | null;
    dayLabel: string;
    visited: boolean;
  };
};

/** 지도에 얹는 사람과 임시 핀. 장소 핀과 생김새를 달리해 헷갈리지 않게 합니다. */
export type MapMate = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type MapNote = {
  id: string;
  label: string | null;
  lat: number;
  lng: number;
};

export type TripMapProps = {
  /** 지금 켜 둔 동행자들. */
  mates?: MapMate[];
  /** 잠깐 꽂아 둔 핀들. */
  notes?: MapNote[];
  /** 지금 내가 있는 자리. 켰을 때만 옵니다. */
  here?: { lat: number; lng: number; accuracy: number } | null;
  /** 있으면 점선 대신 이것을 그립니다. */
  routes?: RouteLine[];
  places: MapPlace[];
  activeId: string | null;
  onSelect: (id: string) => void;
  height?: number;
  /**
   * 지도 위에 얹는 단추들(내 위치·전체화면)을 보일지.
   *
   * <p>지도가 화면 전체를 채우는 일정 화면에서는 "전체화면" 이 뜻이 없고,
   * 그 자리는 위쪽 막대와 겹칩니다. 그럴 때 끕니다.
   */
  chrome?: boolean;
  /** 지도가 화면을 꽉 채울 때. 모서리를 둥글리지 않습니다. */
  bleed?: boolean;
  /**
   * 장소끼리 선으로 이을지.
   *
   * <p>일정에서는 이어야 합니다 — 순서가 곧 동선입니다. 보관함처럼 순서가
   * 없는 곳에서는 이으면 안 됩니다. 담아 둔 차례가 무슨 길인 것처럼 보여,
   * 있지도 않은 동선을 그려 놓게 됩니다.
   */
  link?: boolean;
  /**
   * 아래쪽이 몇 픽셀 가려져 있는지.
   *
   * <p>일정 판이 지도 위로 올라와 아래를 덮습니다. 이것을 모르면 고른 장소를
   * 화면 한가운데로 보내는데, 그 가운데가 판에 덮여 있어 정작 안 보입니다.
   * 덮인 만큼 위로 밀어 올려 <b>보이는 곳의 가운데</b>에 놓습니다.
   */
  bottomInset?: number;
  /**
   * 내 위치로 옮겨 달라는 신호.
   *
   * <p>값이 <b>바뀔 때마다</b> 지도가 내 자리로 갑니다. 무엇으로 바뀌는지는
   * 상관없고 달라지기만 하면 됩니다 — 같은 자리를 두 번 눌러도 두 번 다
   * 움직여야 하므로, 자리를 넘기는 대신 "눌렀다" 는 것만 넘깁니다.
   */
  goHereAt?: number;
};

/** 검색으로 찾은 장소. */
export type Found = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** 구글이 아는 번호. 나중에 영업시간을 물어볼 때 씁니다. */
  placeId: string | null;
  /** 구글이 알려 준 갈래로 서버가 미리 찍어 둔 핀 그림. 없을 수도 있습니다. */
  icon?: string | null;
};

export type PlaceSearchProps = {
  onPick: (found: Found) => void;
};

/**
 * 지도에 그릴 실제 이동 경로.
 *
 * <p>없으면 지도는 장소끼리 점선으로 잇습니다. 그건 "이 순서로 간다" 는 뜻일
 * 뿐 실제로 지나는 길이 아닙니다.
 */
export type RouteLine = {
  id: string;
  color: string;
  points: { lat: number; lng: number }[];
};
