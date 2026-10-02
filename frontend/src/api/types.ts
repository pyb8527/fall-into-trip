/**
 * 서버가 내려보내는 모양.
 *
 * 백엔드의 AuthDtos·TripDtos·AdminDtos 와 짝입니다. 한쪽을 고치면 다른
 * 쪽도 같이 고쳐야 합니다.
 */

export type Role = 'ADMIN' | 'MEMBER';

/**
 * 모임에서의 자리.
 *
 * <p>둘뿐입니다. 운영진·부방장 같은 것은 안 둡니다 — 스무 명짜리 모임에
 * 결재선이 필요하지 않습니다.
 */
export type GroupRole = 'OWNER' | 'MEMBER';

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
  /**
   * 올려 둔 얼굴 사진. 안 올렸으면 비어 있습니다.
   *
   * <p>{@code mark} 와 <b>함께</b> 옵니다 — 하나가 다른 하나를 대신하는 값이
   * 아닙니다. 사진은 프로필에 서고 표식은 지도 핀에 섭니다. 얼굴 사진을
   * 16픽셀로 줄이면 누구인지 안 보이므로 핀은 계속 그림을 씁니다.
   */
  photoId: Maybe<string>;
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
  /** 구글 로그인이 켜져 있으면 그 클라이언트 ID. 꺼져 있으면 빈 값입니다. */
  googleClientId?: string;
  /** 카카오 로그인을 켰는지 */
  kakao?: boolean;
};

export type TripSummary = {
  id: string;
  title: string;
  ownerId: string;
  /** 내가 넣어 둔 폴더. 폴더는 보는 사람 것이라 사람마다 다릅니다. */
  folderId: Maybe<string>;
  /**
   * 목록에서 이 여행을 가리키는 색. 안 정했으면 비어 있습니다.
   *
   * <p>날짜 띠가 쓰는 여덟 가지 중 하나입니다. 기본값이 없습니다 — 있으면
   * 정한 것과 안 정한 것을 구별할 수 없습니다.
   */
  theme: Maybe<string>;
  /** 이름 앞에 붙는 표식 하나. 안 정했으면 비어 있습니다. */
  emoji: Maybe<string>;
  startIso: string | null;
  endIso: string | null;
  dayCount: number;
  placeCount: number;
  /**
   * 어느 모임의 여행인지. 비어 있으면 혼자 여행입니다.
   *
   * <p>내 여행 화면이 이 값으로 「혼자」와 「모임」 두 칸을 가릅니다.
   */
  groupId: Maybe<string>;
  /** 모임 이름. 모임 칸에서 여행을 모임별로 묶는 데 씁니다. */
  groupName: Maybe<string>;
  /**
   * 목록에 세울 첫 사진. 한 장도 없으면 비어 있습니다.
   *
   * <p>장소마다 챙겨 둔 사진 가운데 일정 차례로 가장 앞의 것입니다. 비어
   * 있을 때만 동선 그림을 그립니다 — 그 그림이 구글 호출 한 번이라
   * ({@link TripThumb}), 사진이 있으면 안 그리는 편이 맞습니다.
   */
  firstPhotoId: Maybe<string>;
};

export type Trip = {
  id: string;
  title: string;
  ownerId: string;
  /**
   * 목록에서 이 여행을 가리키는 색. 안 정했으면 비어 있습니다.
   *
   * <p>날짜 띠가 쓰는 여덟 가지 중 하나입니다. 기본값이 없습니다 — 있으면
   * 정한 것과 안 정한 것을 구별할 수 없습니다.
   */
  theme: Maybe<string>;
  /** 이름 앞에 붙는 표식 하나. 안 정했으면 비어 있습니다. */
  emoji: Maybe<string>;
  /** 어느 모임의 여행인지. 비어 있으면 혼자 여행입니다. */
  groupId: Maybe<string>;
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

  /**
   * 다니면서 볼 사진.
   *
   * <p>메뉴판, 예매 화면, 가는 길 지도. 여행기에는 안 실립니다 — 다니려고
   * 넣어 둔 것이지 남에게 보이려고 넣은 것이 아닙니다.
   */
  refs: PlaceRefs[];
  /**
   * 고칠 수 있는가.
   *
   * <p>볼 수 있으면 늘 참입니다 — 「보기만」을 없앴습니다. 모임에 구경꾼을
   * 두는 것은 앞뒤가 안 맞습니다. 보여 주기만 하려면 여행기를 올립니다.
   */
  canEdit: boolean;
  /** 내가 만든 여행인지. 지우기와 모임 옮기기가 여기에 걸립니다. */
  owner: boolean;
  /** 여행 안내판. 글이 없어도 판(version)은 옵니다 */
  notice: TripNotice;
};

/**
 * 여행 안내판 — 숙소 도어락, 모이는 곳처럼 여행 전체에 걸린 글 한 장.
 *
 * <p>고칠 때 {@code version} 을 같이 보냅니다. 그 사이에 누가 고쳤으면
 * 409 — 합치지 않습니다.
 */
export type TripNotice = {
  text?: Maybe<string>;
  at?: Maybe<string>;
  byName?: Maybe<string>;
  version: number;
};

/** 다니면서 볼 사진. 장소 칸마다, 여행기에는 안 실립니다. */
export type PlaceRefs = {
  placeId: string;
  photoIds: string[];
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

/* --------------------------------------------------------- 모임과 초대 */

/**
 * 모임.
 *
 * <p>사람이 사는 자리입니다. 여행은 그 안에서 생깁니다. 사람 수와 여행 수가
 * 함께 오는 것은 목록에서 어느 것이 살아 있는 모임인지 보여야 하기
 * 때문입니다.
 */
export type Group = {
  id: string;
  name: string;
  about: Maybe<string>;
  /** 이름 앞에 붙는 표식 하나. 안 정했으면 비어 있습니다. */
  emoji: Maybe<string>;
  coverPhotoId: Maybe<string>;
  ownerId: string;
  memberCount: number;
  tripCount: number;
};

/** 모임에 있는 사람. 주인이 맨 앞으로 옵니다. */
export type Mate = {
  id: string;
  name: string;
  mark: Maybe<string>;
  role: GroupRole;
  owner: boolean;
};

/**
 * 피드 글 한 편 — 사진 몇 장과 글 한 줄.
 *
 * <p>여행기(Post 가 아니라 TripPost 쪽)와 다릅니다. 저쪽은 제목·지역·공개
 * 범위를 가지는, 남에게 내놓는 글입니다. 이쪽은 아는 사람들끼리 보는 것이라
 * 올리는 데 드는 품이 사진 고르기 하나여야 합니다.
 *
 * <p>좋아요가 없습니다. 스무 명짜리 모임에서 좋아요는 셈이 아니라 눈치가
 * 됩니다 — 누가 안 눌렀는지가 보입니다.
 */
export type FeedPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorMark: Maybe<string>;
  /** 모임 글이면 그 모임. 내 피드면 비어 있습니다. */
  groupId: Maybe<string>;
  /** 누가 볼 수 있는지. */
  audience: FeedAudience;
  /** 어느 여행 이야기인지. 지워진 여행이면 비어 있습니다. */
  tripId: Maybe<string>;
  tripTitle: Maybe<string>;
  /**
   * 그 여행의 어느 장소에서 올린 글인지.
   *
   * <p>안 고른 글과, <b>일정에서 장소가 빠진 글</b>은 비어 있습니다 — 뒤쪽은
   * 글이 남고 묶임만 끊긴 자리입니다({@code posts.place_id} 가 ON DELETE SET
   * NULL). 일정에서 장소 한 줄을 빼는 일이 남의 글을 지우는 일이면 안 됩니다.
   *
   * <p>날은 안 옵니다. 장소가 이미 날을 말하고({@code places.day_id}), 둘을
   * 따로 두면 장소를 다른 날로 끌어 옮길 때 어긋납니다 — 그러면 사진이 가 본
   * 적 없는 날에 놓입니다.
   */
  placeId: Maybe<string>;
  /** 그 장소의 이름. 장소가 지워진 글은 비어 있습니다. */
  placeName: Maybe<string>;
  text: Maybe<string>;
  tags: string[];
  photoIds: string[];
  commentCount: number;
  /** 내가 쓴 것인지. 고치기·지우기 단추가 여기에 걸립니다. */
  mine: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * 피드 글을 누가 볼 수 있는지.
 *
 * <p>여행기의 {@link Visibility} 와 <b>따로</b> 둡니다. 그쪽의 「주소 아는
 * 사람만」(LINK)은 피드에 뜻이 없고 — 피드에는 남이 뒤지는 목록이 애초에 없어서
 * "목록에서는 빠지고 주소로는 열린다" 가 할 일이 없습니다 — 거꾸로 「내 모임
 * 사람만」은 여행기에 없습니다. 값은 서버의 {@code feed/domain/Audience} 와
 * 같아야 합니다.
 *
 * <ul>
 *   <li>{@code EVERYONE} 모두
 *   <li>{@code MATES} 내 모임 사람만 — 모임에 올린 글이면 그 모임 사람,
 *       내 피드에 쓴 글이면 나와 모임을 함께 쓰는 사람입니다
 *   <li>{@code ONLY_ME} 나만
 * </ul>
 */
export type FeedAudience = 'EVERYONE' | 'MATES' | 'ONLY_ME';

/** 피드 한 번에 오는 것. @param more 더 있는지 */
export type FeedSlice = {
  posts: FeedPost[];
  more: boolean;
};

/**
 * 이 여행을 같이 보는 사람.
 *
 * <p>만든 사람과, 모임 여행이면 그 모임 사람 전부입니다. 일정의 이름표,
 * 챙길 것의 맡은 사람, 정산의 "누가 냈나" 가 이것을 씁니다.
 */
export type Person = {
  id: string;
  name: string;
  mark: Maybe<string>;
  /** 이 여행을 만든 사람인지. 이름 옆에 표를 다는 데 씁니다. */
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
  /** 비어 있으면 기한 없는 링크입니다. */
  expiresAt: Maybe<string>;
  maxUses: number;
};

/** 발급해 둔 초대. 토큰은 실리지 않습니다. */
export type InviteRow = {
  id: string;
  /** 비어 있으면 기한 없는 링크입니다. */
  expiresAt: Maybe<string>;
  maxUses: number;
  usedCount: number;
  /** 아직 쓸 수 있는지. 기한·한도·막은 것을 서버가 한 번에 봐 줍니다. */
  usable: boolean;
};

/**
 * 링크를 받은 사람이 들어가기 전에 보는 것. 로그인 없이도 볼 수 있습니다.
 *
 * <p>아는 이름이 하나라도 있으면 들어갈지를 바로 정할 수 있습니다.
 */
export type InvitePreview = {
  name: string;
  about: Maybe<string>;
  emoji: Maybe<string>;
  someNames: string[];
  memberCount: number;
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
  /**
   * 사진의 이름.
   *
   * <p>그림 주소가 아닙니다. 구글이 주는 그림 주소는 잠깐만 살아서 이 응답에
   * 실어 두면 화면을 그릴 때쯤 죽어 있습니다. 필요할 때 /api/places/photo 가
   * 풀어 줍니다.
   */
  photoName: Maybe<string>;
  /** 찍은 사람. 사진을 쓰려면 함께 적어야 합니다 — 구글이 그렇게 요구합니다. */
  photoBy: Maybe<string>;
};

/* -------------------------------------------------------------- 게시판 */

/** 목록에 뜨는 한 줄. 일정 전체는 들어 있지 않습니다. */
export type PostCard = {
  id: string;
  title: string;
  summary: string | null;
  /** 어느 지역 여행인지. 안 고르고 올린 예전 글에는 없습니다. */
  region: string | null;
  /** 무엇에 대한 여행인지. 글쓴이가 직접 적습니다. 안 달았으면 빈 배열. */
  tags: string[];
  authorName: string;
  dayCount: number;
  placeCount: number;
  likeCount: number;
  viewCount: number;
  /** 내가 추천했는지. 로그인 안 했으면 항상 false 입니다. */
  liked: boolean;
  createdAt: string;
  /** 표지 사진. 없으면 첫 사진, 그것도 없으면 동선 그림입니다. */
  coverPhotoId: string | null;
  /**
   * 표지를 안 골랐을 때 대신 세울 이 글의 첫 사진.
   *
   * <p>글에 실린 사진을 읽는 차례대로 훑은 첫 장입니다({@code PostService}).
   * 사진이 한 장도 없으면 비어 있고, 그때만 동선 그림을 그립니다.
   *
   * <p><b>있어도 되고 없어도 되는 칸입니다.</b> 목록({@code /api/posts})은
   * 싣지만 글 하나를 읽는 주소는 안 싣습니다 — 거기서는 일정 사본에 사진이
   * 그대로 들어 있어서 첫 장만 따로 받을 이유가 없습니다.
   */
  firstPhotoId?: Maybe<string>;
  /** 「내 여행으로 가져오기」 한 사람 수. 같은 사람은 한 번 */
  copyCount?: number;
  /** 모임 여행에서 나온 여행기인지 */
  fromGroup?: boolean;
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
  /**
   * 같이 실은 피드 글.
   *
   * <p><b>새 글에만 있습니다.</b> 장소마다 기록을 남기던 시절의 옛 글에는
   * 없고, 사본은 그때의 모습이라 고쳐 쓰지 않습니다 — 받는 쪽이 둘 다 그릴
   * 수 있어야 합니다.
   */
  stories?: Maybe<Story[]>;
};

/**
 * 여행기에 같이 실린 글 한 편.
 *
 * <p>사본입니다. 올린 뒤에 그 피드 글을 고치거나 지워도 여기 담긴 것은
 * 그대로입니다.
 */
export type Story = {
  text: Maybe<string>;
  author: string;
  /** 올린 때. */
  at: string;
  /**
   * 몇째 날 뒤에 설지(0부터).
   *
   * <p>비어 있으면 일정 뒤입니다 — 돌아와서 올린 글이거나, 붙어 있던 날이
   * 나중에 빠진 글입니다.
   */
  dayIndex?: Maybe<number>;
  tags: string[];
  photos: string[];
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
  /**
   * 그 자리에서 남긴 것.
   *
   * <p><b>옛 글에만 있습니다.</b> 장소마다 기록을 남기던 시절에 올린 글이고,
   * 사본은 그때의 모습이라 고쳐 쓰지 않습니다.
   *
   * <p>새 글에는 안 담깁니다 — 피드 글을 골라 싣는 길이 들어오면 그쪽으로
   * 갑니다(docs/groups/plan.md 3단계).
   */
  photos?: Maybe<string[]>;
  stars?: Maybe<number>;
  review?: Maybe<string>;
};

export type PostDetail = Omit<PostCard, 'summary'> & {
  summary: string | null;
  /** 내가 쓴 글인지. 내릴 수 있는지를 이걸로 정합니다. */
  mine: boolean;
  /** 어디까지 보이는지. */
  visibility: Visibility;
  /** 댓글을 받는 글인지. 열어 둔 글에만 댓글칸이 생깁니다. */
  feedback: boolean;
  commentCount: number;
  itinerary: Itinerary;
};

/**
 * 글이 어디까지 보이는지.
 *
 * <p>여행기를 쓰는 까닭이 셋으로 갈립니다 — 남에게 보여 주려고, 같이 간
 * 사람에게만, 나중에 내가 다시 보려고. 셋째가 없으면 "다녀온 것을 정리해
 * 두기" 가 곧 "남에게 내놓기" 가 되고, 그러면 대충 쓰거나 아예 안 씁니다.
 */
export type Visibility = 'LISTED' | 'LINK' | 'PRIVATE';

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
  /** 이름을 누르면 그 사람 페이지로 */
  authorId?: string;
  /** 내가 남긴 것인지. 지울 수 있는지를 이걸로 정합니다. */
  mine: boolean;
  dayIndex: Maybe<number>;
  placeIndex: Maybe<number>;
  createdAt: string;
  /**
   * 고친 적이 있으면 그때. 한 번도 안 고쳤으면 비어 있습니다.
   *
   * <p>{@code createdAt} 과 같은 값을 넣지 않습니다 — 그러면 방금 남긴 것도
   * 밀리초 차이로 「고침」으로 읽힐 수 있습니다. 안 고친 것은 <b>없는
   * 것</b>입니다.
   */
  editedAt?: Maybe<string>;
};

/**
 * 여럿이 다녀온 지역.
 *
 * <p>따로 채워 두는 것이 아니라 올라온 글을 세어 만듭니다. 글이 없으면
 * 목록도 비고, 그때는 화면이 다른 말을 합니다.
 */
export type PopularRegion = {
  region: string;
  /** 이 지역을 다녀온 글이 몇 개인지. */
  posts: number;
  likes: number;
  views: number;
};

/** 여럿이 일정에 넣은 장소. 한 글에서 두 번 넣었어도 한 번으로 셉니다. */
export type PopularPlace = {
  /** 같은 곳끼리 묶은 열쇠. 구글 번호가 있으면 그것, 없으면 이름. */
  key: string;
  name: string;
  icon: Maybe<string>;
  lat: Maybe<number>;
  lng: Maybe<number>;
  placeId: Maybe<string>;
  /** 몇 개의 글이 이 곳을 넣었는지. */
  posts: number;
  likes: number;
};

/** 올라온 글에 실제로 쓰인 갈래. 누를 수 있는 것만 냅니다. */
export type PopularKind = {
  kind: string;
  places: number;
};

export type PostPage = {
  posts: PostCard[];
  page: number;
  totalPages: number;
  total: number;
};

/** 목록 정렬. 서버가 받는 이름과 같아야 합니다. */
/** copied — 이번 주 많이 가져간 순(지난 이레 동안 「내 여행으로 가져오기」 한 사람 수) */
export type PostSort = 'hot' | 'new' | 'top' | 'copied';

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
  /**
   * 별 1~5. 안 준 것은 없습니다 — <b>0 이 아닙니다.</b>
   *
   * <p>별만 주거나 한 줄만 남기거나 둘 다 할 수 있습니다. 그래서 글이
   * 비어 있는 줄도 옵니다.
   */
  stars?: number | null;
  authorName: string;
  /** 내가 남긴 것인지. 지울 수 있는지를 이걸로 정합니다. */
  mine: boolean;
  createdAt: string;
  /**
   * 고친 적이 있으면 그때. {@link Comment} 의 것과 같은 규칙입니다.
   *
   * <p>고쳐도 {@code createdAt} 은 안 움직입니다 — 그 값에 「새로 올라온
   * 것」(이레)과 줄 순서가 걸려 있어서, 고칠 때마다 올라가면 같은 한 줄을
   * 다시 저장해 맨 위에 눌러앉힐 수 있습니다.
   */
  editedAt?: Maybe<string>;
};

/**
 * 이 여행에 가는지 하는 답.
 *
 * <p>줄이 없는 사람은 {@code 'MAYBE'} 입니다 — 여행을 만들 때 멤버 수만큼
 * 줄을 미리 깔지 않습니다.
 */
export type GoingAnswer = 'GOING' | 'NOT_GOING' | 'MAYBE';

/**
 * 한 사람의 참석 응답.
 *
 * <p><b>「못 가요」만 셈에서 빠집니다.</b> 「아직 몰라요」는 남습니다 — 표
 * 안 던진 사람을 미정으로 보는 규칙과 같은 결입니다.
 *
 * <p>보는 것은 안 바뀝니다. 못 간다고 한 사람도 그 여행을 그대로 봅니다.
 */
export type Going = {
  id: string;
  name: string;
  mark: Maybe<string>;
  owner: boolean;
  answer: GoingAnswer;
  /** 「셋째 날만 못 가요」 같은 것. 모두에게 보입니다 */
  note: Maybe<string>;
};

/** 그날 되는지. 「어쩔 수 없으면」은 「안 돼요」가 아니라서 2순위 셈에 남습니다. */
export type DateChoice = 'YES' | 'IF_NEED' | 'NO';

/**
 * 날짜 후보 하나. 서버가 줄 세운 차례로 옵니다.
 *
 * <p>{@code tier} — 1 가는 사람 모두 돼요 · 2 안 돼요 없음 · 3 나머지.
 * 많이 된다는 날이 아니라 <b>모두 되는 날</b>을 찾습니다.
 */
export type DateOption = {
  id: string;
  startIso: string;
  endIso: string;
  nights: number;
  createdBy: Maybe<string>;
  confirmed: boolean;
  tier: 1 | 2 | 3;
  yes: number;
  no: number;
  /** 가는 사람 중 답한 수 */
  answered: number;
  mine?: Maybe<DateChoice>;
  answers: { userId: string; name: string; answer: DateChoice }[];
};

export type DatePoll = {
  options: DateOption[];
  /** 지금 「가는 사람」 수 */
  people: number;
  amOwner: boolean;
};

/** 모임 달력에 빗금으로 그리는, 아직 정하는 중인 후보. */
export type OpenDate = {
  id: string;
  tripId: string;
  tripTitle: string;
  startIso: string;
  endIso: string;
  mine?: Maybe<DateChoice>;
};

/**
 * 마이페이지가 받는 것 — 이 사람이 어떤 여행을 해 왔나.
 *
 * <p>내 것과 남의 것이 같은 꼴입니다. {@code mine} 으로만 갈립니다 —
 * 내 것에만 「내 계정」 줄이 붙습니다.
 */
export type Profile = {
  id: string;
  name: string;
  /** 골라 둔 표식. 안 골랐으면 없고, 화면이 로고를 세웁니다 */
  mark?: string | null;
  /**
   * 올려 둔 얼굴 사진. 안 올렸으면 없습니다.
   *
   * <p>표식보다 앞섭니다 — 사진 · 표식 · 로고 차례입니다
   * ({@code components/profile-face}). 둘을 같이 두는 까닭은 표식이 <b>지도에서
   * 나를 가리키는 그림</b>이기도 해서입니다. 사진을 올려도 지도의 그 그림은
   * 그대로 두어야 하니, 사진이 표식을 지우지 않습니다.
   */
  photoId?: string | null;
  /** 한 줄 소개. 안 적었으면 없습니다 */
  bio?: string | null;
  /** 우리 사이 — 남의 페이지에만. 함께 속한 모임과 그 모임의 여행 */
  between?: {
    groups: { id: string; name: string; emoji?: string | null }[];
    trips: { id: string; title: string; startIso?: string | null; endIso?: string | null }[];
  } | null;
  /** 가입한 때 */
  since: string;
  mine: boolean;
  /** 같은 모임에 든 사람 수(자기 빼고, 겹치면 한 번) */
  companions?: number;
  counts: {
    /** 내가 만든 여행. 남이 만든 모임 여행은 안 셉니다 */
    trips: number;
    posts: number;
    /** 별점을 준 것만. 한 줄만 남긴 것은 리뷰로 안 셉니다 */
    reviews: number;
    groups: number;
  };
};

/**
 * 한 장소의 우리 별점.
 *
 * <p>구글 평점과 나란히 섭니다. 다르면 그것이 정보입니다 — 구글 4.2 에
 * 우리 4.6 이면 「우리 같은 사람들은 더 좋게 봤다」는 말이고, 그 반대면
 * 「소문보다 별로」입니다.
 */
export type OurStars = {
  /** 1.0~5.0. 소수 한 자리까지 */
  average: number;
  /** 몇 명이 줬는지. 적으면 화면이 평균을 덜 믿게 적습니다 */
  count: number;
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
  /**
   * 이 통화 합계를 <b>적어 둔 환율</b>로 원화로 바꾼 값.
   *
   * <p>환율을 아직 안 적어 두었으면 없습니다. 0 이 아니라 없는 것입니다 —
   * 0 을 쓰면 화면이 「0원」을 그럴듯하게 띄웁니다.
   *
   * <p>「대충 얼마 썼나」에만 씁니다. 아래 {@code transfers}(보낼 금액)에는
   * 안 씁니다 — 합계가 조금 틀리는 것은 괜찮지만 보낼 금액이 틀리면
   * 누군가 그만큼 손해입니다.
   */
  krw?: number | null;
  balances: { userId: string; name: string; balance: number }[];
  transfers: Transfer[];
};

/**
 * 송금 줄 하나.
 *
 * <p>{@code sentAt} 은 보낸 사람이, {@code receivedAt} 은 받은 사람이 누른
 * 때입니다. 금액이 그때와 같을 때만 옵니다 — 지출이 바뀌어 줄이 달라지면 옛
 * 표시는 사라집니다. 둘 다 있으면 끝난 줄입니다.
 */
export type Transfer = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
  sentAt?: Maybe<string>;
  receivedAt?: Maybe<string>;
};

/**
 * 환전했을 때의 환율.
 *
 * <p>어디서 받아 오지 않고 <b>적어 둡니다.</b> 받아 오는 환율은 중간값이라
 * 지갑에서 나간 돈과 다릅니다 — 공항 환전은 특히 그렇고, 카드는 비자·마스터
 * 환율에 수수료가 또 붙습니다.
 */
export type TripRates = {
  /** 이 여행에서 쓴 통화들(원화 제외). {@code rate} 가 없으면 아직 안 적은 것 */
  rates: { currency: string; decimals: number; rate: string | null }[];
  /** 이것이 비어 있지 않으면 원화 합계를 낼 수 없습니다 */
  needed: string[];
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
 *
 * <p><b>한 곳에서 온 것은 한 줄입니다.</b> 추천·댓글·표는 글마다·후보마다
 * 접혀서 옵니다 — 안 접으면 글 하나가 좀 받은 날 목록이 그것만으로 찹니다.
 */
export type NewsItem = {
  at: string;
  kind:
    | 'place.add'
    | 'place.edit'
    | 'candidate.add'
    | 'candidate.vote'
    | 'post.like'
    | 'post.comment'
    /* 모임에 걸리는 것 셋. 피드와 모임이 생긴 뒤 비어 있던 자리입니다 —
       글이 올라와도 들어가서 보지 않으면 몰랐습니다. */
    | 'feed.post'
    | 'feed.comment'
    | 'group.join'
    /* 여행 안내판. 무엇을 고쳤는지는 안 실립니다 — 도어락 번호가 소식함에
       그대로 뜨면 안 됩니다. */
    | 'notice.edit';
  /**
   * 한 일을 한 사람. 지워진 계정이면 "누군가" 입니다.
   *
   * <p><b>없을 수 있습니다.</b> 여럿이 한 줄로 접힌 것이고, 그때는 몇
   * 사람인지가 {@code text} 안에 들어 있습니다.
   */
  actorName?: string | null;
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
  /**
   * 내가 남긴 한 줄들이 얼마나 쓰였는지.
   *
   * <p>위 목록과 성격이 다릅니다. 소식은 읽으면 지나가지만 이것은
   * 사라지지 않고 쌓입니다.
   *
   * <p><b>한 줄도 안 남긴 사람에게는 없습니다.</b> 0 을 보여 주면 "너는
   * 아무것도 안 했다" 가 되고, 그건 돌아올 이유가 아니라 안 돌아올
   * 이유입니다.
   */
  mine?: {
    tipCount: number;
    /** 쓰인 <b>횟수</b>입니다. 사람 수가 아닙니다. */
    viewCount: number;
  } | null;
};
