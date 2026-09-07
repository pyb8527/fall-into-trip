import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, request, setAccessToken, setSessionEndedHandler } from '@/api/client';
import type { AuthState, TokenResponse, User } from '@/api/types';

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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  setup: (email: string, name: string, password: string, token: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
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

  const accept = useCallback((res: TokenResponse) => {
    setAccessToken(res.accessToken);
    setUser(res.user);
    setSetupNeeded(false);
  }, []);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
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
      try {
        const res = await request<TokenResponse>('/api/auth/refresh', {
          method: 'POST',
          anonymous: true,
        });
        if (alive) {
          accept(res);
        }
        return;
      } catch {
        /* 아직 로그인한 적이 없거나 쿠키가 만료됐습니다. 정상적인 흐름입니다. */
      }

      try {
        const state = await request<AuthState>('/api/auth/state', { anonymous: true });
        if (alive) {
          setSetupNeeded(state.setupNeeded);
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
      login,
      register,
      setup,
      changePassword,
      logout,
      logoutAll,
      refreshUser,
    }),
    [ready, user, setupNeeded, login, register, setup, changePassword, logout, logoutAll, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
