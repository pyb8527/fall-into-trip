/**
 * 서버가 내려보내는 모양.
 *
 * 백엔드의 AuthDtos·TripDtos·AdminDtos 와 짝입니다. 한쪽을 고치면 다른
 * 쪽도 같이 고쳐야 합니다.
 */

export type Role = 'ADMIN' | 'MEMBER';
export type TripRole = 'EDITOR' | 'VIEWER' | 'NONE';

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type TokenResponse = {
  accessToken: string;
  expiresIn: number;
  user: User;
};

export type AuthState = {
  setupNeeded: boolean;
};

export type TripSummary = {
  id: string;
  title: string;
  ownerId: string;
  /** 내가 넣어 둔 폴더. 폴더는 보는 사람 것이라 사람마다 다릅니다. */
  folderId: Maybe<string>;
  startIso: string | null;
  endIso: string | null;
  dayCount: number;
  placeCount: number;
};

export type Trip = {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
};

export type Move = {
  mode?: string;
  min?: number;
  via?: string;
  cost?: string;
};

export type Place = {
  id: string;
  sort: number;
  name: string;
  ja: string | null;
  en: string | null;
  lat: number;
  lng: number;
  cat: string | null;
  time: string | null;
  cost: string | null;
  note: string | null;
  url: string | null;
  radius: number | null;
  fit: boolean;
  move: Move | null;
  updatedAt: string;
  updatedBy: string | null;
  version: number;
  /**
   * 구글이 아는 이 장소의 번호.
   *
   * 영업시간 같은 내용은 저장이 막혀 있어(구글 약관) 번호만 들고 있다가
   * 필요할 때 이걸로 물어봅니다. 좌표를 직접 넣은 장소에는 없습니다.
   */
  placeId: string | null;
};

export type Day = {
  id: string;
  sort: number;
  label: string;
  shortName: string | null;
  date: string | null;
  iso: string | null;
  theme: string | null;
  color: string | null;
  budget: string | null;
  flight: unknown;
  version: number;
  places: Place[];
};

export type TripDetail = {
  trip: Trip;
  days: Day[];
  visited: string[];
  myRole: TripRole;
};

/* ------------------------------------------------------------------ 운영 */

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  ownedTrips: number;
  activeSessions: number;
};

export type AuditEntry = {
  id: number;
  at: string;
  userId: string | null;
  userName: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
};

export type PageView<T> = {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
};

export type AdminStats = {
  users: number;
  admins: number;
  disabledUsers: number;
  trips: number;
  places: number;
  expenses: number;
  auditLast24h: number;
  topActions: Record<string, number>;
};

/**
 * 비어 있을 수 있는 값.
 *
 * <p>서버는 비어 있는 필드를 null 로 보내지 않고 <b>아예 빼고</b> 보냅니다
 * (spring.jackson.default-property-inclusion: non_null). 그래서 받는 쪽에서는
 * 없는 것과 null 을 가르면 안 됩니다. `x != null` 로 한 번에 봅니다.
 */
export type Maybe<T> = T | null | undefined;

/* ------------------------------------------------------- 동행자와 초대 */

/** 여행을 같이 보는 사람. */
export type Companion = {
  id: string;
  name: string;
  email: string;
  role: TripRole;
  owner: boolean;
};

/**
 * 막 만든 초대.
 *
 * 서버에는 해시만 남으므로 token 은 이때 한 번만 옵니다. 목록에는 없습니다.
 */
export type NewInvite = {
  id: string;
  token: string;
  role: TripRole;
  /** 비어 있으면 기한 없는 링크입니다. */
  expiresAt: Maybe<string>;
  maxUses: number;
};

/** 발급해 둔 초대. 토큰은 실리지 않습니다. */
export type InviteRow = {
  id: string;
  role: TripRole;
  createdAt: string;
  /** 비어 있으면 기한 없는 링크입니다. */
  expiresAt: Maybe<string>;
  maxUses: number;
  usedCount: number;
  revoked: boolean;
};

/** 링크를 받은 사람이 들어가기 전에 보는 것. 로그인 없이도 볼 수 있습니다. */
export type InvitePreview = {
  tripTitle: string;
  ownerName: string | null;
  role: TripRole;
  /** 비어 있으면 기한 없는 링크입니다. */
  expiresAt: Maybe<string>;
};

/* ------------------------------------------------------------ 이동 경로 */

/** 서버 RouteService.Mode 와 같아야 합니다. */
export type TravelMode = 'WALK' | 'TRANSIT' | 'DRIVE';

export type RouteLeg = {
  fromId: string;
  toId: string;
  seconds: number;
  meters: number;
  /** 지도에 그릴 길. 이어지지 않는 구간이면 비어 있습니다. */
  polyline: string | null;
  /** 그 수단으로 갈 수 있는지. 섬과 뭍 사이 같은 경우가 있습니다. */
  reachable: boolean;
};

export type DayRoute = {
  mode: TravelMode;
  legs: RouteLeg[];
  totalSeconds: number;
  totalMeters: number;
  /** 장소가 너무 많아 뒷부분을 계산하지 않았는지. */
  trimmed: boolean;
};

/* ------------------------------------------------------------ 장소 정보 */

/** 여는 구간 하나. end 가 비어 있으면 그날 안 닫습니다. */
export type OpenSpan = {
  start: string;
  end: Maybe<string>;
};

/**
 * 구글이 알려 주는 가게 정보.
 *
 * 우리 DB 에 쌓지 않고 볼 때마다 받아 옵니다(구글 약관). 그래서 화면에는
 * 출처를 함께 띄워야 합니다.
 *
 * 시간은 <b>오늘</b>이 아니라 <b>그 장소를 넣어 둔 날</b> 기준입니다. 10월
 * 9일에 갈 곳이 그날 쉬는지가 궁금한 것이지 오늘 여는지가 아닙니다.
 */
export type PlaceInfo = {
  /** 우리 쪽 장소 id */
  id: string;
  /** 넣어 둔 날의 영업시간 */
  onDay: Maybe<string>;
  /** 그날 쉬는지 */
  closedOnDay: boolean;
  /** 그날 여는 구간들. 둘 이상이면 사이가 브레이크 타임입니다. */
  spans: OpenSpan[];
  /** 요일별 전체. 월요일부터입니다. */
  hours: string[];
  phone: Maybe<string>;
  website: Maybe<string>;
  rating: Maybe<number>;
  ratingCount: Maybe<number>;
  /** 아예 문을 닫은 가게 */
  permanentlyClosed: boolean;
  mapUrl: Maybe<string>;
};

/* -------------------------------------------------------------- 게시판 */

/** 목록에 뜨는 한 줄. 일정 전체는 들어 있지 않습니다. */
export type PostCard = {
  id: string;
  title: string;
  summary: string | null;
  /** 어느 지역 여행인지. 안 고르고 올린 예전 글에는 없습니다. */
  region: string | null;
  authorName: string;
  dayCount: number;
  placeCount: number;
  likeCount: number;
  viewCount: number;
  /** 내가 추천했는지. 로그인 안 했으면 항상 false 입니다. */
  liked: boolean;
  createdAt: string;
};

/**
 * 올릴 때 떠 둔 일정 사본.
 *
 * 원본 여행이 아니라 그때의 모습입니다. 그래서 작성자가 나중에 일정을 고쳐도
 * 이 글은 바뀌지 않고, 여행을 지워도 남습니다.
 */
export type Itinerary = {
  title: string;
  days: ItineraryDay[];
};

export type ItineraryDay = {
  label: string | null;
  shortName: string | null;
  theme: string | null;
  color: string | null;
  budget: string | null;
  places: ItineraryPlace[];
};

export type ItineraryPlace = {
  name: string;
  ja: string | null;
  en: string | null;
  lat: number;
  lng: number;
  cat: string | null;
  time: string | null;
  cost: string | null;
  note: string | null;
  url: string | null;
  placeId: string | null;
};

export type PostDetail = Omit<PostCard, 'summary'> & {
  summary: string | null;
  /** 내가 쓴 글인지. 내릴 수 있는지를 이걸로 정합니다. */
  mine: boolean;
  /** 의견을 받는 글인지. 열어 둔 글에만 댓글칸이 생깁니다. */
  feedback: boolean;
  commentCount: number;
  itinerary: Itinerary;
};

/**
 * 일정에 달린 댓글.
 *
 * dayIndex 와 placeIndex 가 있으면 그 장소에 대한 말입니다. 없으면 일정 전체를
 * 두고 하는 말입니다.
 */
export type Comment = {
  id: string;
  text: string;
  authorName: string;
  /** 내가 남긴 것인지. 지울 수 있는지를 이걸로 정합니다. */
  mine: boolean;
  dayIndex: Maybe<number>;
  placeIndex: Maybe<number>;
  createdAt: string;
};

export type PostPage = {
  posts: PostCard[];
  page: number;
  totalPages: number;
  total: number;
};

/** 목록 정렬. 서버가 받는 이름과 같아야 합니다. */
export type PostSort = 'hot' | 'new' | 'top';

/**
 * 기간으로 거르기. 서버가 받는 이름과 같아야 합니다.
 *
 * 날짜 수를 그대로 받지 않고 묶어 둡니다. "3박4일" 을 찾는 사람이 4를 넣어야
 * 하는지 3을 넣어야 하는지 헷갈리기 때문입니다.
 */
export type PostDays = '1' | '2-4' | '5';

/* --------------------------------------------------------------- 폴더 */

/**
 * 여행을 묶어 두는 폴더.
 *
 * 여행이 아니라 <b>보는 사람</b>의 것입니다. 같이 간 사람에게는 안 보이고,
 * 그쪽은 자기 식대로 정리합니다.
 */
export type Folder = {
  id: string;
  name: string;
  tripCount: number;
};

/* ------------------------------------------------------------- 보관함 */

/**
 * 나중에 쓰려고 담아 둔 장소.
 *
 * 담는 순간의 값을 그대로 둡니다. 원래 글이 지워지거나 그쪽에서 이름을 고쳐도
 * 내가 담아 둔 것은 그대로입니다.
 */
export type SavedPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 구글이 아는 번호. 있으면 영업시간도 볼 수 있습니다. */
  placeId: Maybe<string>;
  cat: Maybe<string>;
  note: Maybe<string>;
  /** 어느 글에서 담았는지. 검색이나 지도에서 담았으면 비어 있습니다. */
  fromPost: Maybe<string>;
  createdAt: string;
};

/* ------------------------------------------------------ 가고 싶은 곳 */

/**
 * 후보 한 곳과 지금까지의 표.
 *
 * 정해지는 기준은 <b>동행자 전원</b>이 좋다고 했을 때입니다. 표를 안 던진
 * 사람이 있으면 아직 정해지지 않은 것으로 봅니다 — 안 본 사람을 반대로 세면
 * 한 명이 늦었다는 이유로 확정됩니다.
 */
export type Candidate = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  placeId: Maybe<string>;
  cat: Maybe<string>;
  note: Maybe<string>;
  addedBy: string;
  yes: number;
  no: number;
  memberCount: number;
  /** 내 표. 비어 있으면 아직 안 던진 것입니다. */
  myVote: Maybe<boolean>;
  agreed: boolean;
};

/* --------------------------------------------------------- 한 줄 팁 */

/**
 * 다녀온 사람이 남긴 한 줄.
 *
 * 여행이 아니라 그 가게에 달립니다. 같은 곳을 넣어 둔 사람이면 누구든 같은
 * 팁을 봅니다. 일주일 지난 것은 오지 않습니다.
 */
export type Tip = {
  id: string;
  text: string;
  authorName: string;
  /** 내가 남긴 것인지. 지울 수 있는지를 이걸로 정합니다. */
  mine: boolean;
  createdAt: string;
};

/* ----------------------------------------------------- 자유시간에 서로 찾기 */

/** "나 지금 여기 카페임" — 잠깐 꽂아 두는 핀. 몇 시간 뒤 사라집니다. */
export type LivePin = {
  id: string;
  lat: number;
  lng: number;
  label: Maybe<string>;
  authorName: string;
  /** 내가 꽂은 것인지. 뺄 수 있는지를 이걸로 정합니다. */
  mine: boolean;
  createdAt: string;
  expiresAt: string;
};

/**
 * 지금 켜 둔 동행자의 자리.
 *
 * 내 자리는 오지 않습니다 — 내 기기가 이미 알고, 서버를 거쳐 돌아오면 한 박자
 * 늦은 자리가 보입니다.
 */
export type LiveWhere = {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  accuracy: Maybe<number>;
  updatedAt: string;
};
