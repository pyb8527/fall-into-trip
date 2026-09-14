import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, refreshSession, request, setAccessToken, setSessionEndedHandler } from '@/api/client';
import type { AuthState, TokenResponse, User } from '@/api/types';
import { forgetTrips } from '@/lib/keep';

/**
 * 로그인 상태.
 *
 * 액세스 토큰은 client.ts 의 메모리에만 있고 여기서는 다루지 않습니다.
 * 화면이 알아야 하는 것은 "지금 누구인가" 뿐입니다.
 */
type AuthContextValue = {
  /** 첫 확인이 끝났는지. 끝나기 전에는 화면을 고르면 안 됩니다. */
  ready: boolean;
  user: User | null;
  /** 운영자가 아직 없어 최초 설치 화면을 띄워야 하는지. */
  setupNeeded: boolean;
  /**
   * 구글 로그인이 켜져 있으면 그 클라이언트 ID.
   *
   * <p>빌드에 안 박고 서버가 내려보냅니다 — 박아 두면 값을 바꿀 때마다 웹을
   * 다시 구워야 하고, 그러면 .env 와 번들이 어긋난 채로 도는 날이 옵니다.
   * 비어 있으면 단추를 안 냅니다.
   */
  googleClientId: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  setup: (email: string, name: string, password: string, token: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  signInWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('AuthProvider 안에서만 쓸 수 있습니다.');
  }
  return value;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');

  const accept = useCallback((res: TokenResponse) => {
    setAccessToken(res.accessToken);
    setUser(res.user);
    setSetupNeeded(false);
  }, []);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    /* 이 기기에 저장해 둔 일정도 함께 지웁니다. 남의 폰을 빌려 잠깐
       로그인하는 일이 있고, 나간 뒤에 내 일정이 그 폰에 남아 있으면
       안 됩니다. */
    forgetTrips();
  }, []);

  /* 토큰이 끝내 되살아나지 않으면 화면에서도 로그아웃 상태가 돼야 합니다. */
  useEffect(() => {
    setSessionEndedHandler(() => setUser(null));
    return () => setSessionEndedHandler(() => {});
  }, []);

  /**
   * 앱을 켤 때 한 번.
   *
   * 액세스 토큰은 메모리에만 있으므로 껐다 켜면 없습니다. 대신 리프레시
   * 쿠키가 남아 있으면 조용히 다시 받아 옵니다. 없으면 로그인 화면으로
   * 가되, 운영자가 아직 없는 서버라면 설치 화면을 먼저 띄웁니다.
   */
  useEffect(() => {
    let alive = true;

    (async () => {
      /* 재발급은 client 가 하나만 돌립니다. 여기서 직접 부르면 개발 모드에서
         효과가 두 번 실행될 때 같은 리프레시 토큰이 두 번 나가고, 서버가
         그것을 탈취로 보고 로그인을 끊어 버립니다. */
      const revived = await refreshSession();
      if (revived && alive) {
        accept(revived as unknown as TokenResponse);
      }

      /*
        로그인이 됐든 안 됐든 부릅니다.

        전에는 세션이 되살아나면 여기서 그냥 빠져나갔습니다. 그래서
        googleClientId 가 빈 채로 남았고, <b>이미 로그인한 사람의 설정
        화면에서 "구글 잇기" 칸이 영영 안 떴습니다</b> — 구글 로그인에서
        "이미 가입된 주소입니다" 를 받은 사람이 가야 할 바로 그 자리입니다.

        setupNeeded 는 로그인 전에만 뜻이 있습니다. 되살아난 사람에게 다시
        켜면 멀쩡히 쓰던 사람에게 설치 화면이 뜹니다.
      */
      try {
        const state = await request<AuthState>('/api/auth/state', { anonymous: true });
        if (alive) {
          setGoogleClientId(state.googleClientId ?? '');
          if (!revived) {
            setSetupNeeded(state.setupNeeded);
          }
        }
      } catch {
        /* 서버가 아직 안 떴을 수 있습니다. 로그인 화면에서 다시 시도하게 둡니다. */
      }
    })().finally(() => {
      if (alive) {
        setReady(true);
      }
    });

    return () => {
      alive = false;
    };
  }, [accept]);

  const login = useCallback(
    async (email: string, password: string) => {
      accept(await api.anon<TokenResponse>('/api/auth/login', { email, password }));
    },
    [accept],
  );

  /**
   * 구글이 준 토큰으로 들어옵니다.
   *
   * <p>받는 자리가 비밀번호 로그인과 같습니다 — 서버가 세션을 똑같은 모양으로
   * 내주므로 화면은 무엇으로 들어왔는지 몰라도 됩니다.
   */
  const signInWithGoogle = useCallback(
    async (credential: string) => {
      accept(await api.anon<TokenResponse>('/api/auth/google', { credential }));
    },
    [accept],
  );

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      accept(await api.anon<TokenResponse>('/api/auth/register', { email, name, password }));
    },
    [accept],
  );

  const setup = useCallback(
    async (email: string, name: string, password: string, token: string) => {
      accept(await api.anon<TokenResponse>('/api/auth/setup', { email, name, password, token }));
    },
    [accept],
  );

  /* 비밀번호를 바꾸면 서버가 다른 기기를 모두 내보내고 이 기기용 토큰을 새로 줍니다. */
  const changePassword = useCallback(
    async (current: string, next: string) => {
      accept(await api.post<TokenResponse>('/api/auth/password', { current, next }));
    },
    [accept],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      /* 서버가 못 받았더라도 이 기기에서는 지웁니다. */
      clear();
    }
  }, [clear]);

  const logoutAll = useCallback(async () => {
    try {
      await api.post('/api/auth/logout-all');
    } finally {
      clear();
    }
  }, [clear]);

  const refreshUser = useCallback(async () => {
    const res = await api.get<{ user: User }>('/api/auth/me');
    setUser(res.user);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      setupNeeded,
      googleClientId,
      signInWithGoogle,
      login,
      register,
      setup,
      changePassword,
      logout,
      logoutAll,
      refreshUser,
    }),
    [ready, user, setupNeeded, googleClientId, login, register, setup, changePassword, logout,
     logoutAll, refreshUser, signInWithGoogle],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
