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
};

/** 검색으로 찾은 장소. */
export type Found = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** 구글이 아는 번호. 나중에 영업시간을 물어볼 때 씁니다. */
  placeId: string | null;
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
