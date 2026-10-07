import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, refreshSession, request, setAccessToken, setSessionEndedHandler } from '@/api/client';
import type { AuthState, TokenResponse, User } from '@/api/types';
import { forgetTrips } from '@/lib/keep';

/**
 * 약관 · 개인정보 수집 · 이용 동의 세 칸.
 *
 * <p>하나로 뭉치지 않습니다. 서버도 세 칸을 따로 받습니다 — 법이 셋을 따로
 * 묻게 하고, 「모두 동의」는 셋을 한 번에 켜는 손쉬운 길일 뿐 넷째 칸이
 * 아닙니다({@code AuthDtos.AgreeRequest}).
 */
export type Consent = { over14: boolean; terms: boolean; privacy: boolean };

/**
 * 세션이 들고 있는 사람.
 *
 * <p>{@code needsConsent} 는 서버의 {@code UserView} 가 함께 내려보내는
 * 값입니다. 켜져 있으면 지금 판의 약관 · 처리방침에 아직 동의하지 않은
 * 것이고, 그동안은 동의 화면만 뜹니다({@code components/consent-gate}).
 * 구글 · 카카오로 처음 들어온 사람, 이 칸이 생기기 전에 가입한 사람이
 * 그렇습니다.
 *
 * <p>공용 타입({@code api/types})에 안 넣고 여기 둡니다. 이 값을 읽는 곳이
 * 로그인 상태를 쥔 이 파일과 동의 화면뿐입니다.
 */
export type SessionUser = User & { needsConsent?: boolean };

/**
 * 로그인 상태.
 *
 * 액세스 토큰은 client.ts 의 메모리에만 있고 여기서는 다루지 않습니다.
 * 화면이 알아야 하는 것은 "지금 누구인가" 뿐입니다.
 */
type AuthContextValue = {
  /** 첫 확인이 끝났는지. 끝나기 전에는 화면을 고르면 안 됩니다. */
  ready: boolean;
  user: SessionUser | null;
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
  /** 서버가 카카오 로그인을 켰는지. 꺼져 있으면 단추를 안 냅니다 */
  kakaoEnabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, consent: Consent) => Promise<void>;
  /**
   * 동의 화면에서 셋 다 켜고 넘어갑니다. 서버가 돌려준 사람으로 바꿔 끼우므로
   * {@code needsConsent} 가 꺼지고, 그 순간 동의 화면이 걷힙니다.
   */
  agree: (consent: Consent) => Promise<void>;
  setup: (email: string, name: string, password: string, token: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  signInWithGoogle: (credential: string) => Promise<void>;
  /** 앱 껍데기가 카카오에서 받아 온 표를 세션으로 바꿉니다 */
  signInWithKakaoTicket: (ticket: string, nonce: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  /**
   * 회원 탈퇴. 서버가 지우고 나면 이 기기에서도 로그인 상태를 걷습니다.
   *
   * @param password 비밀번호 사용자만. 카카오 · 구글 사용자는 그 전에 다시
   *                 확인해 두어야 합니다(account/delete 화면)
   */
  withdraw: (password?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('AuthProvider 안에서만 쓸 수 있어요.');
  }
  return value;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [kakaoEnabled, setKakaoEnabled] = useState(false);

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
   *
   * <h3>둘을 나란히 부릅니다</h3>
   *
   * <p>재발급을 기다린 뒤에 {@code /api/auth/state} 를 불렀습니다. 그런데
   * 뒤쪽은 {@code anonymous} 요청이라 <b>앞쪽이 받아 온 토큰을 쓰지
   * 않습니다</b> — 기다릴 까닭이 없는데 기다리고 있었습니다.
   *
   * <p>그 둘이 끝나야 {@code ready} 가 서고, {@code ready} 가 설 때까지
   * 모든 화면은 「확인하는 중…」입니다({@code (app)/_layout.tsx}). 그러니까
   * 이 한 번의 기다림은 <b>어느 화면을 열어도 그 화면이 제 것을 부르기
   * 전에</b> 얹혀 있었습니다. 나란히 부르면 왕복 하나가 통째로 빠집니다.
   *
   * <p>{@code revived} 를 뒤에서 씁니다({@code setupNeeded}). 값이 둘 다
   * 온 뒤에 보므로 순서를 바꿔도 뜻이 같습니다.
   */
  useEffect(() => {
    let alive = true;

    (async () => {
      /* 재발급은 client 가 하나만 돌립니다. 여기서 직접 부르면 개발 모드에서
         효과가 두 번 실행될 때 같은 리프레시 토큰이 두 번 나가고, 서버가
         그것을 탈취로 보고 로그인을 끊어 버립니다. */
      const reviving = refreshSession();

      /*
        로그인이 됐든 안 됐든 부릅니다.

        전에는 세션이 되살아나면 여기서 그냥 빠져나갔습니다. 그래서
        googleClientId 가 빈 채로 남았고, <b>이미 로그인한 사람의 설정
        화면에서 "구글 잇기" 칸이 영영 안 떴습니다</b> — 구글 로그인에서
        "이미 가입된 주소입니다" 를 받은 사람이 가야 할 바로 그 자리입니다.

        setupNeeded 는 로그인 전에만 뜻이 있습니다. 되살아난 사람에게 다시
        켜면 멀쩡히 쓰던 사람에게 설치 화면이 뜹니다.

        서버가 아직 안 떴을 수 있어 실패를 삼킵니다 — 로그인 화면에서 다시
        시도하게 둡니다. 재발급 쪽은 제가 null 로 답하므로 따로 안 감쌉니다.
      */
      const asking = request<AuthState>('/api/auth/state', { anonymous: true }).catch(
        () => null,
      );

      const [revived, state] = await Promise.all([reviving, asking]);

      if (!alive) {
        return;
      }
      if (revived) {
        accept(revived as unknown as TokenResponse);
      }
      if (state) {
        setGoogleClientId(state.googleClientId ?? '');
        setKakaoEnabled(!!state.kakao);
        if (!revived) {
          setSetupNeeded(state.setupNeeded);
        }
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

  const signInWithKakaoTicket = useCallback(
    async (ticket: string, nonce: string) => {
      accept(await api.anon<TokenResponse>('/api/auth/kakao/exchange', { ticket, nonce }));
    },
    [accept],
  );

  const register = useCallback(
    async (email: string, name: string, password: string, consent: Consent) => {
      accept(
        await api.anon<TokenResponse>('/api/auth/register', { email, name, password, ...consent }),
      );
    },
    [accept],
  );

  const agree = useCallback(async (consent: Consent) => {
    const res = await api.post<{ user: SessionUser }>('/api/auth/agree', consent);
    setUser(res.user);
  }, []);

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

  /*
    로그아웃과 달리 서버가 실패하면 이 기기도 그대로 둡니다. 지워지지 않은
    계정에서 로그아웃만 되면, 사람은 탈퇴된 줄 압니다.
  */
  const withdraw = useCallback(
    async (password?: string) => {
      await request('/api/auth/me', { method: 'DELETE', body: { password: password ?? null } });
      clear();
    },
    [clear],
  );

  const refreshUser = useCallback(async () => {
    const res = await api.get<{ user: SessionUser }>('/api/auth/me');
    setUser(res.user);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      setupNeeded,
      googleClientId,
      kakaoEnabled,
      signInWithGoogle,
      signInWithKakaoTicket,
      login,
      register,
      agree,
      setup,
      changePassword,
      logout,
      logoutAll,
      withdraw,
      refreshUser,
    }),
    [ready, user, setupNeeded, googleClientId, kakaoEnabled, login, register, agree, setup, changePassword, logout,
     logoutAll, withdraw, refreshUser, signInWithGoogle, signInWithKakaoTicket],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
