import { Platform } from 'react-native';

/**
 * 서버와 이야기하는 유일한 통로.
 *
 * 서버는 토큰을 둘로 나눠 씁니다.
 *
 * - 액세스 토큰은 응답 본문으로만 오고, 여기 모듈 변수에만 둡니다.
 *   AsyncStorage·localStorage 에 두면 끼어든 스크립트가 읽어 갈 수 있습니다.
 *   앱을 껐다 켜면 사라지지만, 그때는 아래 리프레시로 다시 받습니다.
 * - 리프레시 토큰은 HttpOnly 쿠키로만 오갑니다. 우리가 값을 볼 일이 없고,
 *   웹이든 앱이든 쿠키 저장소가 알아서 실어 보냅니다.
 */

/**
 * 웹은 nginx 가 같은 주소에서 /api 를 서버로 넘겨 주므로 비워 둡니다.
 * 같은 출처가 되면 CORS 도, SameSite 도 걸리지 않습니다.
 *
 * 앱(iOS·Android)은 그럴 수 없으니 주소를 넣어 줘야 합니다. 시뮬레이터가
 * 아니라 실기기로 볼 때는 localhost 가 폰 자신을 가리키므로, 개발 PC 의
 * LAN 주소를 EXPO_PUBLIC_API_BASE 에 넣습니다.
 */
export const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? (Platform.OS === 'web' ? '' : 'http://localhost:8080')
).replace(/\/$/, '');

/** 서버가 내려보낸 사람이 읽을 수 있는 오류. 화면은 이 message 를 그대로 띄웁니다. */
export class ApiError extends Error {
  readonly status: number;
  /** 낙관적 잠금 충돌 등 화면이 따로 처리해야 하는 경우에만 붙습니다. */
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let accessToken: string | null = null;

/** 로그인·재발급이 끝날 때마다 갱신됩니다. */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function hasAccessToken() {
  return accessToken !== null;
}

/**
 * 토큰이 죽었을 때 화면에 알려 줄 자리.
 *
 * 재발급까지 실패했다면 더 할 수 있는 일이 없으므로 로그인 화면으로
 * 돌려보내야 합니다. 그 판단은 AuthProvider 가 합니다.
 */
type SessionEndedHandler = () => void;
let onSessionEnded: SessionEndedHandler = () => {};

export function setSessionEndedHandler(handler: SessionEndedHandler) {
  onSessionEnded = handler;
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 로그인·재발급처럼 토큰을 붙이면 안 되거나 재시도하면 안 되는 요청. */
  anonymous?: boolean;
  signal?: AbortSignal;
};

/** 재발급이 돌려주는 것. 화면이 "나는 누구인가" 를 다시 세울 때 씁니다. */
export type RefreshedSession = {
  accessToken: string;
  expiresIn: number;
  user: unknown;
};

/**
 * 재발급은 한 번에 하나만.
 *
 * <p>리프레시 토큰은 쓸 때마다 새 것으로 갈아 끼워집니다(회전). 그래서 같은
 * 토큰으로 두 번 부르면 서버는 이미 쓴 것이 또 왔다고 보고 탈취로 판단해
 * 그 로그인 전체를 끊습니다.
 *
 * <p>겹칠 일이 생각보다 많습니다. 화면 하나가 여러 요청을 던져 401 이 동시에
 * 오기도 하고, 개발 모드에서는 React 가 효과를 두 번 실행해 앱이 뜨자마자
 * 두 번 부르기도 합니다. 그래서 어디서 부르든 이 하나를 나눠 씁니다.
 */
let refreshing: Promise<RefreshedSession | null> | null = null;

export function refreshSession(): Promise<RefreshedSession | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          return null;
        }
        const data = (await res.json()) as RefreshedSession;
        if (!data?.accessToken) {
          return null;
        }
        accessToken = data.accessToken;
        return data;
      } catch {
        /* 네트워크가 끊긴 것과 토큰이 죽은 것을 여기서는 구분하지 않습니다.
           어느 쪽이든 이번에는 되살리지 못한 것으로 봅니다. */
        return null;
      } finally {
        /* 다음에 다시 시도할 수 있게 비웁니다. */
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function toError(res: Response): Promise<ApiError> {
  let message = '서버와 연결하지 못했습니다.';
  let code: string | undefined;
  try {
    const data = (await res.json()) as { error?: string; code?: string };
    if (data?.error) {
      message = data.error;
    }
    code = data?.code;
  } catch {
    /* 본문이 JSON 이 아니면 상태 코드만으로 안내합니다. */
    if (res.status === 404) {
      message = '없는 주소입니다.';
    }
  }
  return new ApiError(res.status, message, code);
}

async function send(path: string, options: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (!options.anonymous && accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await send(path, options);
  } catch {
    throw new ApiError(0, '서버와 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
  }

  /* 액세스 토큰이 만료됐을 뿐일 수 있습니다. 한 번만 되살려 보고 다시 던집니다. */
  if (res.status === 401 && !options.anonymous) {
    const revived = await refreshSession();
    if (!revived) {
      accessToken = null;
      onSessionEnded();
      throw await toError(res);
    }
    try {
      res = await send(path, options);
    } catch {
      throw new ApiError(0, '서버와 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    }
    if (res.status === 401) {
      /* 새 토큰으로도 거절당했다면 권한 문제입니다. 더 시도하지 않습니다. */
      accessToken = null;
      onSessionEnded();
      throw await toError(res);
    }
  }

  if (!res.ok) {
    throw await toError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** 로그인·가입·설치처럼 토큰 없이 부르는 것. */
  anon: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body, anonymous: true }),
};

/** 쿼리스트링을 만듭니다. 값이 비면 아예 넣지 않습니다. */
export function query(params: Record<string, string | number | boolean | null | undefined>) {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}
