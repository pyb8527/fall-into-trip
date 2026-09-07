import { Link } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-provider';
import { Body, Button, Card, Caption, ErrorNote, Field, Screen, Title } from '@/ui';

/**
 * 최초 운영자 만들기.
 *
 * 서버에 운영자가 하나도 없을 때만 열립니다. 설치 토큰(SETUP_TOKEN)은
 * 서버 환경변수에만 있는 값이라, 배포 직후 아무나 운영자를 선점하지
 * 못하게 막습니다.
 */
export default function Setup() {
  const { setup } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await setup(email.trim(), name.trim(), password, token.trim());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '설치하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>최초 설치</Title>
      <Body tone="secondary">
        이 서버에는 아직 운영자가 없습니다. 첫 운영자 계정을 만들어 주세요.
      </Body>

      <Card>
        <Field
          label="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
        />
        <Field label="이름" value={name} onChangeText={setName} maxLength={80} />
        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          hint="8자 이상"
        />
        <Field
          label="설치 토큰"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          secureTextEntry
          hint="서버의 SETUP_TOKEN 환경변수에 넣어 둔 값입니다."
          onSubmitEditing={submit}
        />
        {error ? <ErrorNote message={error} /> : null}
        <Button
          label="운영자 만들기"
          onPress={submit}
          busy={busy}
          disabled={!email || !name || password.length < 8 || !token}
        />
      </Card>

      <Link href="/(auth)/login">
        <Caption tone="accent">이미 계정이 있다면 로그인</Caption>
      </Link>
    </Screen>
  );
}
