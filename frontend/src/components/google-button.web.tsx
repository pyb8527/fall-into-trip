import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { shellSignIn } from '@/lib/google-signin.web';
import { inShell } from '@/lib/shell-bridge.web';
import { Colors, Radius, Spacing, Tap, Type } from '@/constants/theme';
import { Press } from '@/ui';

/**
 * 구글로 로그인하는 단추 (웹).
 *
 * <h3>구글이 그리는 단추를 씁니다</h3>
 *
 * <p>직접 그리면 이 앱의 흑백·각진 결에 맞출 수 있지만, 구글 로고와 문구에는
 * 지켜야 할 규칙이 있습니다. 대신 구글이 주는 선택지 중 <b>검은 채움 ·
 * 네모</b>를 고릅니다 — 규칙을 지키면서 이 화면과 가장 덜 부딪히는 모양입니다.
 *
 * <h3>스크립트를 화면이 필요할 때만 받습니다</h3>
 *
 * <p>모두에게 미리 받아 두면, 구글 로그인을 안 쓰는 사람도 열 때마다 구글에
 * 한 번 다녀오게 됩니다. 이 단추가 그려지는 자리에서만 받습니다.
 *
 * <p>클라이언트 ID 가 비어 있으면(서버 {@code .env} 에 안 넣었으면) 아무것도
 * 안 그립니다. 눌러도 안 되는 단추를 두지 않습니다.
 */
export function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const { googleClientId } = useAuth();

  /*
    앱 껍데기 안에서는 구글이 그리는 단추를 못 씁니다.

    <p>그 단추는 구글의 스크립트가 제 창 안에서 로그인을 끝내고 토큰을
    건네주는 방식인데, 웹뷰 안에서는 구글이 그 흐름 자체를 막습니다.
    우리가 그린 단추를 두고, 누르면 껍데기가 폰의 브라우저를 띄웁니다.
  */
  if (inShell) {
    return <ShellButton onCredential={onCredential} hidden={!googleClientId} />;
  }

  return <WebButton onCredential={onCredential} googleClientId={googleClientId} />;
}

/** 껍데기 안에서 쓰는 단추. 생김새는 앱 쪽(google-button.tsx)과 같습니다. */
function ShellButton({
  onCredential,
  hidden,
}: {
  onCredential: (credential: string) => void;
  hidden: boolean;
}) {
  if (hidden) {
    /* 서버가 클라이언트 ID 를 안 내려 줬습니다. 눌러도 아무 일이 없는
       단추를 두는 것보다 없는 편이 낫습니다. */
    return null;
  }
  return (
    <Press
      accessibilityLabel="Google로 로그인"
      onPress={() => {
        shellSignIn()
          .then((token) => {
            if (token) {
              onCredential(token);
            }
            /* null 이면 사람이 창을 닫은 것입니다. 고장이 아니므로 아무
               말도 안 합니다. */
          })
          .catch(() => {
            /* 껍데기가 못 했습니다. 비밀번호로 들어오는 길은 그대로
               있으므로 조용히 넘어갑니다. */
          });
      }}
      style={shellStyles.button}>
      <View style={shellStyles.logo}>
        <View style={[shellStyles.quarter, { backgroundColor: '#EA4335' }]} />
        <View style={[shellStyles.quarter, { backgroundColor: '#4285F4' }]} />
        <View style={[shellStyles.quarter, { backgroundColor: '#FBBC05' }]} />
        <View style={[shellStyles.quarter, { backgroundColor: '#34A853' }]} />
      </View>
      <Text style={shellStyles.label}>Google로 로그인</Text>
    </Press>
  );
}

function WebButton({
  onCredential,
  googleClientId,
}: {
  onCredential: (credential: string) => void;
  googleClientId: string | null | undefined;
}) {
  const slot = useRef<View | null>(null);
  /* 콜백이 매번 새 함수라도 구글을 다시 초기화하지 않도록 최신 것만 들고
     있습니다. 다시 초기화하면 단추가 깜빡이며 새로 그려집니다. */
  const latest = useRef(onCredential);
  latest.current = onCredential;

  useEffect(() => {
    if (!googleClientId) {
      return;
    }
    let alive = true;

    load()
      .then(() => {
        const google = (window as unknown as { google?: GoogleIdentity }).google;
        const node = slot.current as unknown as HTMLElement | null;
        if (!alive || !google || !node) {
          return;
        }
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (res) => latest.current(res.credential),
        });
        node.innerHTML = '';
        google.accounts.id.renderButton(node, {
          type: 'standard',
          theme: 'filled_black',
          /* 이 앱은 모서리를 안 둥글립니다. 구글이 주는 것 중 가장 가까운
             모양이 rectangular 입니다. */
          shape: 'rectangular',
          text: 'continue_with',
          size: 'large',
          locale: 'ko',
          width: Math.min(360, Math.max(240, node.clientWidth || 320)),
        });
      })
      .catch(() => {
        /* 구글에 못 닿았습니다. 비밀번호로 들어오는 길은 그대로 있으므로
           조용히 넘어갑니다 — 여기서 오류를 띄우면 로그인 화면이 구글
           사정에 묶입니다. */
      });

    return () => {
      alive = false;
    };
  }, [googleClientId]);

  if (!googleClientId) {
    return null;
  }
  return <View ref={slot} style={{ alignItems: 'center' }} />;
}

/** 스크립트를 한 번만 받습니다. 두 화면에서 열어도 하나입니다. */
let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if ((window as unknown as { google?: GoogleIdentity }).google) {
    return Promise.resolve();
  }
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = 'https://accounts.google.com/gsi/client';
      tag.async = true;
      tag.defer = true;
      tag.onload = () => resolve();
      tag.onerror = () => {
        /* 다음에 다시 받아 볼 수 있게 풀어 둡니다. 한 번 실패한 것을 들고
           있으면 네트워크가 돌아와도 영영 안 뜹니다. */
        loading = null;
        reject(new Error('구글 스크립트를 받지 못했습니다.'));
      };
      document.head.appendChild(tag);
    });
  }
  return loading;
}

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (opts: { client_id: string; callback: (res: { credential: string }) => void }) => void;
      renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};

/* 앱 쪽 단추(components/google-button.tsx)와 같은 값입니다. 구글 로고와
   문구에는 지켜야 할 규칙이 있어서, 흰 바탕 · 회색 테두리 · "Google로
   로그인" 이라는 가장 기본형을 씁니다. */
const shellStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    alignSelf: 'center',
    minHeight: Tap.min,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
  },
  /* 로고는 그림 파일이 아니라 네 조각 색으로 흉내 냅니다 — 파일 하나를
     더 실을 만한 일이 아니고, 이 크기에서는 구별이 안 갑니다. */
  logo: {
    width: 18,
    height: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 9,
    overflow: 'hidden',
  },
  quarter: {
    width: 9,
    height: 9,
  },
  label: {
    ...Type.body,
    color: Colors.text,
  },
});
