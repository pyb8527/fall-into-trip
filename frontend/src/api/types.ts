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
  /**
   * 지도에서 나를 가리키는 그림의 이름("rabbit").
   *
   * 이모지가 아니라 짧은 이름입니다. 어떤 그림을 그릴지는 화면이 정합니다
   * (constants/user-marks.ts). 안 골랐으면 비어 있습니다.
   */
  mark: Maybe<string>;
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
  /**
   * 사람이 자유롭게 적는 비용.
   *
   * "무료", "1인 2천엔", "￥1,200~1,800" 같은 것이 들어 있습니다. 숫자로
   * 읽지 않습니다 — 틀리면 멀쩡한 계획에 틀린 돈이 붙습니다.
   */
  cost: string | null;
  /**
   * 셈할 수 있는 비용. 그 통화의 가장 작은 단위입니다.
   *
   * 12.50달러는 1250, 9000엔은 9000. 가계부의 금액과 같은 규칙이라야 잡아 둔
   * 것과 실제로 쓴 것을 나란히 놓을 수 있습니다. 위의 cost 와 따로 삽니다.
   */
  costAmount: Maybe<number>;
  /** 위 금액의 통화. 금액이 없으면 이것도 없습니다. */
  costCurrency: Maybe<string>;
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
  /**
   * 지도에 찍힐 그림의 이름("ramen", "onsen"…).
   *
   * 이모지 자체가 아니라 짧은 이름입니다. 어떤 그림을 그릴지는 화면이 정합니다
   * (constants/place-icons.ts). 비어 있으면 번호만 찍힌 핀이 됩니다.
   */
  icon: string | null;
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
  /** 그날 타는 편. "OZ112 09:20 인천 T1" 처럼 적어 두고 읽는 것입니다. */
  flight: Maybe<string>;
  /** 그날 밤 어디서 자는지. 안 적었으면 비어 있습니다. */
  stay: Maybe<Stay>;
  version: number;
  places: Place[];
};

/**
 * 잠자리.
 *
 * 장소가 아닙니다 — 동선에 끼면 "3번 호텔" 이 되고 스탬프를 찍는 자리가
 * 됩니다. 그날에 딸린 다른 종류의 값입니다. 좌표가 있어야 "숙소 근처" 를
 * 찾고 하루 동선의 출발점이 됩니다.
 */
export type Stay = {
  name: string;
  lat: Maybe<number>;
  lng: Maybe<number>;
  placeId: Maybe<string>;
  note: Maybe<string>;
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
  mark: Maybe<string>;
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
  /** 대중교통은 구글이 준 값, 자동차는 우리가 어림한 값, 걷기는 없음. */
  fare: Money | null;
};

/**
 * 돈.
 *
 * @param estimated 우리가 어림한 값인지. 대중교통 요금은 구글이 계산한 것이라
 *                  false 이고, 택시는 나라별 기본요금으로 어림한 것이라 true
 *                  입니다. 화면은 이것을 보고 "어림" 을 붙일지 정합니다.
 */
export type Money = {
  currency: string;
  amount: number;
  estimated: boolean;
};

/** 한 구간을 한 수단으로 갔을 때. */
export type GapOption = {
  mode: TravelMode;
  seconds: number;
  meters: number;
  polyline: string | null;
  fare: Money | null;
};

/**
 * 장소와 장소 사이의 빈칸.
 *
 * <p>수단을 하나 고르게 하지 않고 셋을 다 계산해 나란히 놓습니다. "지하철 25분
 * / 택시 10분" 이 함께 보여야 시간을 살지 돈을 살지 그 자리에서 정할 수
 * 있습니다.
 *
 * @param fastest  가장 빨리 가는 수단
 * @param cheapest 가장 돈이 덜 드는 수단. 둘이 같으면 고민할 것이 없습니다.
 */
export type Gap = {
  fromId: string;
  toId: string;
  options: GapOption[];
  fastest: TravelMode | null;
  cheapest: TravelMode | null;
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
  /** 잡아 둔 비용. 이 칸이 생기기 전에 올린 글에는 없습니다. */
  costAmount?: Maybe<number>;
  costCurrency?: Maybe<string>;
  note: string | null;
  url: string | null;
  placeId: string | null;
  /** 사본에 함께 담긴 핀 그림. 가져오면 그대로 따라갑니다. */
  icon?: string | null;
};

export type PostDetail = Omit<PostCard, 'summary'> & {
  summary: string | null;
  /** 내가 쓴 글인지. 내릴 수 있는지를 이걸로 정합니다. */
  mine: boolean;
  /** 댓글을 받는 글인지. 열어 둔 글에만 댓글칸이 생깁니다. */
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

/* ------------------------------------------------------------- 보석함 */

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
  /** 지도에 찍힐 그림의 이름. 일정으로 옮길 때 그대로 따라갑니다. */
  icon: Maybe<string>;
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
  icon: Maybe<string>;
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
  /** 지도에서 이 사람을 가리키는 그림의 이름. 안 골랐으면 비어 있습니다. */
  mark: Maybe<string>;
  lat: number;
  lng: number;
  accuracy: Maybe<number>;
  updatedAt: string;
};

/* ---------------------------------------------------------------- 가계부 */

/**
 * 쓴 돈 하나.
 *
 * <p>금액은 <b>그 통화의 가장 작은 단위</b>입니다 — 12.50달러는 1250 이고
 * 9000엔은 9000 입니다. 실수로 들고 다니면 셋이 나눠 낼 때마다 끝자리가
 * 흐려지고, 그 흐려짐이 정산에서 드러납니다.
 */
export type Spend = {
  id: string;
  /** 어느 날 것인지. 아직 안 정했으면 비어 있습니다. */
  dayId: Maybe<string>;
  /**
   * 어느 장소에서 썼는지. 안 정했으면 비어 있습니다.
   *
   * 가리키던 장소가 지워졌을 수도 있습니다 — 그때는 지출이 남고 번호만
   * 붕 뜹니다. 화면은 이름을 못 찾으면 그 줄을 안 적습니다.
   */
  placeId: Maybe<string>;
  payerId: string;
  payerName: string;
  cat: Maybe<string>;
  name: string;
  amount: number;
  currency: string;
  /** 이 통화가 소수점 아래 몇 자리를 쓰는지. 엔·원은 0. */
  decimals: number;
  pay: Maybe<string>;
  /** 나눠 낼 사람들. 비어 있으면 전원. */
  share: string[];
  version: number;
};

/**
 * 한 통화의 정산 결과.
 *
 * <p>엔으로 받을 돈과 원으로 낼 돈은 더하지 않습니다. 환율로 합칠 수도
 * 있지만 그러면 "언제 환율로" 가 남고, 그 답은 사람마다 다릅니다.
 */
export type Books = {
  currency: string;
  decimals: number;
  total: number;
  balances: { userId: string; name: string; balance: number }[];
  transfers: { fromName: string; toName: string; amount: number }[];
};

/**
 * 소식 한 줄.
 *
 * <p>내가 없는 동안 남이 한 일입니다. <b>내가 한 일은 안 옵니다</b> — 서버가
 * 거릅니다.
 *
 * <p>{@code tripId} 와 {@code postId} 는 <b>둘 중 하나만</b> 찹니다. 여행에서
 * 벌어진 일과 내 글에서 벌어진 일은 갈 곳이 다릅니다. 어디로 갈지는 서버가
 * 정해서 {@code url} 로 내려보냅니다.
 */
export type NewsItem = {
  at: string;
  kind:
    | 'place.add'
    | 'place.edit'
    | 'candidate.add'
    | 'candidate.vote'
    | 'post.like'
    | 'post.comment';
  /** 한 일을 한 사람. 지워진 계정이면 "누군가" 입니다. */
  actorName: string;
  tripId?: string | null;
  tripTitle?: string | null;
  postId?: string | null;
  postTitle?: string | null;
  /**
   * 사람이 읽는 한 줄.
   *
   * <p>서버가 만듭니다. 푸시가 같은 순간에 쓰는 말과 맞춰야 하는데, 화면과
   * 서버가 각자 만들면 어느 날 둘이 갈립니다.
   */
  text: string;
  url: string;
  /** 마지막으로 열어 본 뒤에 생긴 것. */
  fresh: boolean;
};

export type News = {
  items: NewsItem[];
  unseen: number;
  /** 마지막으로 열어 본 때. 한 번도 안 열었으면 없습니다. */
  seenAt?: string | null;
};
