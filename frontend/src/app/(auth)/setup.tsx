import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, UNEXPECTED } from '@/api/client';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { Body, Button, Card, Caption, Divider, ErrorNote, Field, Row, Screen, Title } from '@/ui';
import { LogoMark } from '@/ui/logo';

const PASSWORD_MIN = 8;

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

  const passwordError =
    password.length > 0 && password.length < PASSWORD_MIN
      ? `${PASSWORD_MIN}자 이상이어야 합니다.`
      : undefined;

  async function submit() {
    if (busy) {
      return;
    }
    if (!email.trim() || !name.trim() || !token.trim()) {
      setError('이메일·이름·설치 토큰을 모두 입력해 주세요.');
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setError(`비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await setup(email.trim(), name.trim(), password, token.trim());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      safeTop
      footer={<Button label="운영자 만들기" onPress={submit} busy={busy} />}>
      <View style={styles.head}>
        <LogoMark size={34} />
        <Title>최초 설치</Title>
        <Body tone="secondary">
          이 서버에는 아직 운영자가 없습니다. 첫 운영자 계정을 만들어 주세요.
        </Body>
      </View>

      <Card>
        <Field
          label="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          placeholder="you@example.com"
          returnKeyType="next"
        />
        <Field
          label="이름"
          value={name}
          onChangeText={setName}
          maxLength={80}
          returnKeyType="next"
        />
        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          hint={`${PASSWORD_MIN}자 이상`}
          error={passwordError}
          returnKeyType="next"
        />
        <Field
          label="설치 토큰"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          hint="서버의 SETUP_TOKEN 환경변수에 넣어 둔 값입니다."
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        {error ? <ErrorNote message={error} /> : null}

        <Divider />
        <Row style={styles.footNote}>
          <Link href="/(auth)/login">
            <Caption tone="accent" strong>
              이미 계정이 있다면 로그인
            </Caption>
          </Link>
        </Row>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  footNote: {
    justifyContent: 'center',
    paddingTop: Spacing.xs,
  },
});
