import { useRouter } from 'expo-router';
import { useState } from 'react';

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
  ErrorNote,
  Field,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';

export default function Settings() {
  const { user, logout, logoutAll } = useAuth();
  const router = useRouter();

  return (
    <Screen>
      <Title>내 계정</Title>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Subtitle>{user?.name}</Subtitle>
          {user?.role === 'ADMIN' ? <Badge label="운영자" tone="accent" /> : null}
        </Row>
        <Body tone="secondary">{user?.email}</Body>
        <Caption>가입 {formatDate(user?.createdAt)}</Caption>
      </Card>

      {user?.role === 'ADMIN' ? (
        <Button label="운영 화면 열기" variant="secondary" onPress={() => router.push('/admin')} />
      ) : null}

      <PasswordCard />

      <Card>
        <Subtitle>로그아웃</Subtitle>
        <Body tone="secondary">
          이 기기에서만 나갈지, 로그인해 둔 모든 기기에서 나갈지 고를 수 있습니다.
        </Body>
        <Row gap={Spacing.two}>
          <Button label="로그아웃" variant="secondary" onPress={logout} />
          <ConfirmButton
            label="모든 기기에서"
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

  async function submit() {
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
      />
      <Field
        label="새 비밀번호"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        hint="8자 이상. 바꾸면 다른 기기는 모두 로그아웃됩니다."
      />
      {error ? <ErrorNote message={error} /> : null}
      {done ? <Body tone="success">바꿨습니다. 다른 기기는 모두 로그아웃됐습니다.</Body> : null}
      <Button
        label="바꾸기"
        onPress={submit}
        busy={busy}
        disabled={!current || next.length < 8}
      />
    </Card>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) {
    return '—';
  }
  return iso.slice(0, 10);
}
