import { Link } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { Body, Button, Card, ErrorNote, Field, Row, Screen, Title } from '@/ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      /* 성공하면 (auth)/_layout 이 알아서 여행 목록으로 보냅니다. */
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '로그인하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>로그인</Title>
      <Card>
        <Field
          label="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          placeholder="you@example.com"
          onSubmitEditing={submit}
        />
        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          onSubmitEditing={submit}
        />
        {error ? <ErrorNote message={error} /> : null}
        <Button label="로그인" onPress={submit} busy={busy} disabled={!email || !password} />
      </Card>

      <Row gap={Spacing.one}>
        <Body tone="secondary">처음이신가요?</Body>
        <Link href="/(auth)/register">
          <Body tone="accent">가입하기</Body>
        </Link>
      </Row>
    </Screen>
  );
}
