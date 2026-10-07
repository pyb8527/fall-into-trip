import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { GoogleButton } from '@/components/google-button';
import { KakaoButton } from '@/components/kakao-button';
import { SUPPORT_EMAIL } from '@/constants/support';
import { Spacing } from '@/constants/theme';
import { confirmKakaoForWithdraw } from '@/lib/kakao-signin';
import {
  Band,
  Body,
  Button,
  Caption,
  ConfirmDialog,
  ErrorNote,
  Field,
  Loading,
  Screen,
  SectionHeader,
  Title,
} from '@/ui';

/** 내가 주인인 여행 · 모임 하나와 그 행방. 서버의 AccountDeletionService.Owned. */
/* 넘겨받을 사람이 없으면(지워지면) 서버가 그 칸을 아예 안 보냅니다. */
type Owned = { id: string; name: string; heirId?: string | null; heirName?: string | null };

/**
 * 탈퇴하면 무엇이 어떻게 되는지. 서버의 AccountDeletionService.Preview.
 *
 * <p>{@code confirm} 은 무엇으로 다시 확인하는지입니다 — 비밀번호 · 카카오 ·
 * 10분 안의 다시 로그인. {@code ready} 는 지금 그 확인이 되어 있는지입니다.
 */
type Preview = {
  confirm: 'password' | 'kakao' | 'recent';
  ready: boolean;
  trips: Owned[];
  groups: Owned[];
};

/**
 * 회원 탈퇴.
 *
 * <h3>한 장에 다 보여 줍니다</h3>
 *
 * <p>지워지는 것 · 남는 것 · 넘어가는 것을 누르기 전에 한 화면에서 봅니다.
 * 특히 <b>넘어가는 것</b>이 중요합니다 — 내가 만든 여행을 친구들이 같이 짜고
 * 있었다면 내 탈퇴로 그 일정이 사라지지 않고 누군가에게 넘어갑니다. 누구에게
 * 넘어가는지 모르고 누르게 하면 안 됩니다.
 *
 * <h3>로그인 없이도 열립니다</h3>
 *
 * <p>구글 플레이는 앱을 지운 사람도 탈퇴를 요청할 수 있는 <b>웹 주소</b>를
 * 요구합니다(Play Console 「데이터 삭제」). 그 주소가 이 화면입니다. 로그인하지
 * 않았으면 무엇이 지워지는지와 어떻게 하는지만 알려 주고 로그인으로 보냅니다
 * — 로그인하고 나면 이리로 돌아옵니다.
 *
 * <h3>설정에서도 여기로 옵니다</h3>
 *
 * <p>설정의 「회원 탈퇴」가 이 화면을 엽니다. 판(시트) 하나로 따로 만들면 같은
 * 안내가 두 벌이 되고, 고칠 때 한쪽이 남습니다.
 */
export default function AccountDeleteScreen() {
  const router = useRouter();
  const { ready, user, withdraw } = useAuth();
  /* 카카오에서 돌아왔는데 안 됐으면 서버가 까닭을 주소에 싣습니다. */
  const { social_error: socialError } = useLocalSearchParams<{ social_error?: string }>();

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  /*
    다 지웠습니다.

    <p>로그인 상태는 이미 걷혔습니다(auth-provider 의 withdraw). 그래도 이
    화면은 남아서 다 됐다고 말합니다 — 말없이 첫 화면으로 튕기면 지워진
    것인지 로그아웃만 된 것인지 알 수 없습니다.
  */
  if (done) {
    return (
      <Screen>
        <View style={styles.head}>
          <Title>계정과 데이터를 모두 지웠어요</Title>
          <Body tone="secondary">
            지금 바로 지웠고, 되돌릴 수 없어요. 다른 기기에 로그인해 둔 것도 모두 풀렸어요. 그동안
            써 주셔서 고마워요.
          </Body>
        </View>
        <Caption tone="secondary">
          구글로 로그인했다면 구글 계정 설정 › 보안 › 「타사 앱 및 서비스」에서 fit 의 권한도 지울
          수 있어요.
        </Caption>
        <Button label="처음으로" onPress={() => router.replace('/(auth)/welcome')} />
      </Screen>
    );
  }

  /* 지우는 중에는 로그인 상태가 먼저 걷힐 수 있습니다. 그 사이에 「로그인해
     주세요」가 번쩍이지 않게 지우는 동안에는 그리던 것을 그대로 둡니다. */
  if (!ready) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!user && !busy) {
    return (
      <Screen>
        <View style={styles.head}>
          <Title>회원 탈퇴</Title>
          <Body tone="secondary">
            로그인한 뒤 이 화면에서 바로 탈퇴할 수 있어요. 앱을 지웠어도 여기서 할 수 있어요.
          </Body>
        </View>

        <SectionHeader title="이렇게 해요" tight />
        <Body small>1. 쓰던 방법(이메일 · 구글 · 카카오)으로 로그인해요.</Body>
        <Body small>2. 지워지는 것과 넘어가는 것을 확인해요.</Body>
        <Body small>3. 본인 확인을 한 번 더 하고 「탈퇴하기」를 눌러요.</Body>

        <Button
          label="로그인하고 탈퇴하기"
          onPress={() => router.push(`/(auth)/login?next=${encodeURIComponent('/account/delete')}`)}
        />

        {SUPPORT_EMAIL ? (
          <Caption tone="secondary">
            로그인할 수 없으면 {SUPPORT_EMAIL} 로 가입한 이메일 주소를 적어 보내 주세요. 본인인지
            확인한 뒤 지워 드려요.
          </Caption>
        ) : null}

        <Band />
        <WhatGoes />
      </Screen>
    );
  }

  return (
    <Signed
      busy={busy}
      socialError={socialError}
      onWithdraw={async (password) => {
        setBusy(true);
        try {
          await withdraw(password);
          setDone(true);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/**
 * 로그인한 사람의 탈퇴 화면.
 *
 * <p>미리 보기(누구에게 넘어가는지 · 무엇으로 확인하는지)를 받아 온 뒤에만
 * 「탈퇴하기」를 엽니다.
 */
function Signed({
  busy,
  socialError,
  onWithdraw,
}: {
  busy: boolean;
  socialError?: string;
  onWithdraw: (password?: string) => Promise<void>;
}) {
  const router = useRouter();
  const { googleClientId, signInWithGoogle, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const { data, error, loading, reload } = useAsync<{ preview: Preview; providers: string[] }>(
    async (signal) => {
      const [preview, me] = await Promise.all([
        api.get<Preview>('/api/auth/me/deletion-preview', signal),
        api.get<{ providers?: string[] }>('/api/auth/me', signal),
      ]);
      return { preview, providers: me.providers ?? [] };
    },
    [],
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorNote message={error ?? UNEXPECTED} onRetry={reload} />
      </Screen>
    );
  }

  const { preview, providers } = data;
  const canGo = preview.confirm === 'password' ? password.length > 0 : preview.ready;

  /*
    카카오로 다시 확인.

    <p>브라우저면 페이지째 카카오에 다녀와 이 화면으로 돌아옵니다 — 그때 화면이
    새로 켜지며 미리 보기를 다시 받으므로 따로 할 것이 없습니다. 앱이면 앱 위에
    띄운 브라우저가 닫힌 뒤 여기서 다시 받습니다.
  */
  async function confirmKakao() {
    if (checking) {
      return;
    }
    setFailed(null);
    setChecking(true);
    try {
      const got = await confirmKakaoForWithdraw();
      if (got === 'done') {
        reload();
      }
    } catch (e) {
      setFailed(e instanceof Error ? e.message : UNEXPECTED);
    } finally {
      setChecking(false);
    }
  }

  /* 구글로 다시 로그인. 새 세션이 열리며 서버가 「방금 로그인함」을 적습니다. */
  async function confirmGoogle(credential: string) {
    setFailed(null);
    try {
      await signInWithGoogle(credential);
      reload();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  async function go() {
    setAsking(false);
    setFailed(null);
    try {
      await onWithdraw(preview.confirm === 'password' ? password : undefined);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  return (
    <Screen
      footer={
        <Button
          label="탈퇴하기"
          variant="danger"
          busy={busy}
          disabled={!canGo}
          onPress={() => setAsking(true)}
        />
      }>
      <View style={styles.head}>
        <Body tone="secondary">
          탈퇴하면 계정과 내가 남긴 것이 바로 지워져요. 지운 것은 되돌릴 수 없어요.
        </Body>
      </View>

      <WhatGoes />

      <Band />
      <SectionHeader title="남는 것" tight />
      <Body small>
        같이 간 여행의 가계부에는 내 이름 대신 「탈퇴한 사람」으로 남아요. 내가 낸 돈과 나눠 낼 몫이
        사라지면 동행자들의 정산이 틀어지기 때문이에요. 이름 말고는 아무것도 남지 않아요.
      </Body>

      <Band />
      <SectionHeader title="넘어가는 것" tight />
      {preview.trips.length === 0 && preview.groups.length === 0 ? (
        <Body small tone="secondary">
          내가 만든 여행이나 모임이 없어요.
        </Body>
      ) : (
        <>
          <Caption tone="secondary">
            같이 쓰던 사람이 있으면 가장 먼저 들어온 사람에게 넘어가요. 혼자 쓰던 것은 지워져요.
          </Caption>
          {preview.trips.map((t) => (
            <Heir key={`trip-${t.id}`} kind="여행" item={t} />
          ))}
          {preview.groups.map((g) => (
            <Heir key={`group-${g.id}`} kind="모임" item={g} />
          ))}
        </>
      )}

      <Band />
      <SectionHeader title="본인 확인" tight />
      {preview.confirm === 'password' ? (
        <Field
          label="지금 비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          returnKeyType="done"
          hint="남이 잠깐 빌린 폰으로 지우지 못하게 한 번 더 물어요."
        />
      ) : preview.confirm === 'kakao' ? (
        preview.ready ? (
          <Body small tone="success" strong>
            카카오로 확인했어요. 10분 안에 탈퇴해 주세요.
          </Body>
        ) : (
          <>
            <Body small tone="secondary">
              카카오로 한 번 더 로그인해 주세요. 탈퇴할 때 카카오와의 연결도 함께 끊어요.
            </Body>
            <KakaoButton label="카카오로 다시 확인" onPress={confirmKakao} />
          </>
        )
      ) : preview.ready ? (
        <Body small tone="success" strong>
          방금 로그인했어요. 10분 안에 탈퇴해 주세요.
        </Body>
      ) : (
        <>
          <Body small tone="secondary">
            로그인한 지 오래됐어요. 다시 로그인하고 10분 안에 탈퇴해 주세요.
          </Body>
          {googleClientId && providers.includes('google') ? (
            <GoogleButton onCredential={confirmGoogle} />
          ) : (
            <Button
              label="다시 로그인하기"
              variant="secondary"
              onPress={async () => {
                await logout();
                router.replace(`/(auth)/login?next=${encodeURIComponent('/account/delete')}`);
              }}
            />
          )}
        </>
      )}

      {failed ? <ErrorNote message={failed} /> : null}
      {!failed && socialError ? <ErrorNote message={socialError} /> : null}

      <ConfirmDialog
        visible={asking}
        title="정말 탈퇴할까요?"
        message="계정과 데이터가 바로 지워지고 되돌릴 수 없어요."
        confirmLabel="탈퇴하기"
        danger
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={go}
      />
    </Screen>
  );
}

/** 넘어가는 것 한 줄 — 「도쿄 여행 → 민지 님에게」 또는 「지워져요」. */
function Heir({ kind, item }: { kind: string; item: Owned }) {
  return (
    <View style={styles.heir}>
      <Body small strong numberOfLines={1}>
        {kind} · {item.name}
      </Body>
      <Caption tone={item.heirName ? 'secondary' : 'danger'}>
        {item.heirName ? `${item.heirName} 님에게 넘어가요` : '혼자 쓰던 것이라 지워져요'}
      </Caption>
    </View>
  );
}

/**
 * 지워지는 것.
 *
 * <p>로그인 안 한 사람에게도 보여 줍니다. 탈퇴를 고민하는 사람이 가장 먼저
 * 묻는 것이 「무엇이 지워지나」이고, 그 답을 듣는 데 로그인이 필요하면 안
 * 됩니다.
 */
function WhatGoes() {
  return (
    <>
      <SectionHeader title="지워지는 것" tight />
      <Body small>· 프로필 — 이름, 이메일, 얼굴 사진, 한 줄 소개</Body>
      <Body small>· 내가 올린 글 · 여행기 · 댓글 · 장소 팁</Body>
      <Body small>· 내가 올린 사진 — 서버에 둔 파일까지</Body>
      <Body small>· 보석함에 담은 장소, 방문 표시, 위치 나누기 기록</Body>
      <Body small>· 이어 둔 구글 · 카카오 로그인, 모든 기기의 로그인</Body>
    </>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.xs,
    paddingBottom: Spacing.s2,
  },
  heir: {
    gap: Spacing.s1,
    paddingVertical: Spacing.s2,
  },
});
