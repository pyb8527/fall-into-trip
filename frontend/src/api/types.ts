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
  expiresAt: string | null;
  maxUses: number;
};

/** 발급해 둔 초대. 토큰은 실리지 않습니다. */
export type InviteRow = {
  id: string;
  role: TripRole;
  createdAt: string;
  /** 비어 있으면 기한 없는 링크입니다. */
  expiresAt: string | null;
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
  expiresAt: string | null;
};
