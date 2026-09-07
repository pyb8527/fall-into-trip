import { Link } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { Body, Button, Card, ErrorNote, Field, Row, Screen, Title } from '@/ui';

export default function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await register(email.trim(), name.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '가입하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>가입</Title>
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
        />
        <Field
          label="이름"
          value={name}
          onChangeText={setName}
          placeholder="동행자에게 보일 이름"
          maxLength={80}
        />
        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          hint="8자 이상"
          onSubmitEditing={submit}
        />
        {tooShort ? <ErrorNote message="비밀번호는 8자 이상이어야 합니다." /> : null}
        {error ? <ErrorNote message={error} /> : null}
        <Button
          label="가입하고 시작하기"
          onPress={submit}
          busy={busy}
          disabled={!email || !name || password.length < 8}
        />
      </Card>

      <Row gap={Spacing.one}>
        <Body tone="secondary">이미 계정이 있나요?</Body>
        <Link href="/(auth)/login">
          <Body tone="accent">로그인</Body>
        </Link>
      </Row>
    </Screen>
  );
}
