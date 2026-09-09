import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-provider';
import { USER_MARKS, markOf } from '@/constants/user-marks';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ConfirmButton,
  Divider,
  ErrorNote,
  Field,
  Press,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';
import { LogoMark } from '@/ui/logo';

const PASSWORD_MIN = 8;

export default function Settings() {
  const { user, logout, logoutAll } = useAuth();
  const router = useRouter();

  return (
    <Screen safeTop>
      <Title>내 계정</Title>

      <Card>
        <Row gap={Spacing.lg}>
          {user?.mark ? (
            <Body style={styles.markEmoji}>{markOf(user.mark)}</Body>
          ) : (
            <LogoMark size={22} />
          )}
          <View style={styles.identity}>
            <Row gap={Spacing.sm}>
              <Subtitle>{user?.name}</Subtitle>
              {user?.role === 'ADMIN' ? <Badge label="운영자" tone="accent" /> : null}
            </Row>
            <Body small tone="secondary" numberOfLines={1}>
              {user?.email}
            </Body>
          </View>
        </Row>
        <Divider />
        <Row style={styles.metaRow}>
          <Caption>가입</Caption>
          <Caption tone="secondary">{formatDate(user?.createdAt)}</Caption>
        </Row>
        <Row style={styles.metaRow}>
          <Caption>마지막 로그인</Caption>
          <Caption tone="secondary">{formatDate(user?.lastLoginAt)}</Caption>
        </Row>
      </Card>

      {user?.role === 'ADMIN' ? (
        <Button label="운영 화면 열기" variant="secondary" onPress={() => router.push('/admin')} />
      ) : null}

      <MarkCard />

      <PasswordCard />

      <Card>
        <Subtitle>로그아웃</Subtitle>
        <Body small tone="secondary">
          이 기기에서만 나갈지, 로그인해 둔 모든 기기에서 나갈지 고를 수 있습니다.
        </Body>
        <Button label="로그아웃" variant="secondary" onPress={logout} />
        <Row style={styles.dangerRow}>
          <ConfirmButton
            label="모든 기기에서 로그아웃"
            confirmLabel="정말 전부 내보내기"
            onConfirm={logoutAll}
          />
        </Row>
      </Card>
    </Screen>
  );
}

/**
 * 지도에서 나를 가리킬 그림.
 *
 * <p>동행자 위치를 이름 첫 글자로 그리고 있었습니다. "지영" 이든 "지훈" 이든
 * 지도에는 똑같이 "지" 하나만 뜹니다. 누가 어디 있는지 보라고 켠 것인데 정작
 * 누구인지가 안 보였습니다.
 *
 * <p>동물로 둔 것은 서로 헷갈리지 않게 하기 위해서입니다. 도형이나 색은 열
 * 개만 넘어가도 구별이 안 되지만, 토끼와 곰은 아무리 작게 그려도 다릅니다.
 */
function MarkCard() {
  const { user, refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(next: string | null) {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.patch('/api/auth/mark', { mark: next ?? '' });
      /* 고른 것이 화면 곳곳(지도·동행자 목록)에 쓰이므로 로그인 정보를 다시
         받아 옵니다. 여기서만 바꿔 두면 지도는 옛 그림을 그립니다. */
      await refreshUser();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '바꾸지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Subtitle>지도에서 나</Subtitle>
      <Body small tone="secondary">
        동행자와 위치를 나눌 때 지도에 이 그림으로 찍힙니다. 안 고르면 이름 첫 글자로
        찍힙니다.
      </Body>

      <Row gap={Spacing.xs}>
        <Press
          onPress={() => pick(null)}
          scale={0.9}
          accessibilityLabel="그림 없이 이름 첫 글자"
          accessibilityState={{ selected: !user?.mark }}
          style={[styles.mark, !user?.mark ? styles.markOn : null]}>
          <Body small strong tone={!user?.mark ? 'accent' : 'secondary'}>
            {user?.name?.slice(0, 1) ?? '나'}
          </Body>
        </Press>
        {USER_MARKS.map((m) => {
          const on = user?.mark === m.key;
          return (
            <Press
              key={m.key}
              onPress={() => pick(m.key)}
              scale={0.9}
              accessibilityLabel={m.label}
              accessibilityState={{ selected: on }}
              style={[styles.mark, on ? styles.markOn : null]}>
              <Body style={styles.markEmoji}>{m.emoji}</Body>
            </Press>
          );
        })}
      </Row>

      {error ? <ErrorNote message={error} /> : null}
    </Card>
  );
}

/** 비밀번호를 바꾸면 서버가 다른 기기를 모두 내보냅니다. 이 기기만 남습니다. */
function PasswordCard() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const nextError =
    next.length > 0 && next.length < PASSWORD_MIN ? `${PASSWORD_MIN}자 이상이어야 합니다.` : undefined;
  const ready = !!current && next.length >= PASSWORD_MIN;

  async function submit() {
    if (!ready || busy) {
      return;
    }
    setError(null);
    setDone(false);
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '바꾸지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Subtitle>비밀번호 바꾸기</Subtitle>
      <Field
        label="현재 비밀번호"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="current-password"
        returnKeyType="next"
      />
      <Field
        label="새 비밀번호"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        hint={`${PASSWORD_MIN}자 이상. 바꾸면 다른 기기는 모두 로그아웃됩니다.`}
        error={nextError}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {error ? <ErrorNote message={error} /> : null}
      {done ? (
        <Body small tone="success" strong>
          바꿨습니다. 다른 기기는 모두 로그아웃됐습니다.
        </Body>
      ) : null}
      <Button label="바꾸기" onPress={submit} busy={busy} disabled={!ready} />
    </Card>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) {
    return '없음';
  }
  return iso.slice(0, 10);
}

const styles = StyleSheet.create({
  mark: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  markEmoji: {
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
  identity: {
    flexShrink: 1,
    gap: Spacing.xs,
  },
  metaRow: {
    justifyContent: 'space-between',
  },
  dangerRow: {
    justifyContent: 'flex-start',
  },
});
