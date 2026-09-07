import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
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
          <LogoMark size={22} />
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
