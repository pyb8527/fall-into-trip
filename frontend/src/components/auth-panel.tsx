import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Field,
  Screen,
  SegmentedTabs,
  Title,
} from '@/ui';
import { LogoLockup } from '@/ui/logo';

/** 서버의 AuthService.PASSWORD_MIN 과 같아야 합니다. */
const PASSWORD_MIN = 8;

export type AuthMode = 'login' | 'register';

const TABS: { value: AuthMode; label: string }[] = [
  { value: 'login', label: '로그인' },
  { value: 'register', label: '회원가입' },
];

/**
 * 로그인과 회원가입.
 *
 * <p>둘은 서로 대신하는 화면이라 한 자리에서 띠로 오갑니다. 링크로 두면
 * 눌러 본 뒤에야 다른 쪽이 있는 줄 압니다.
 *
 * <p>주소는 그대로 둘로 남겨 둡니다(/login, /register). 띠를 누르면 화면을
 * 갈아 끼우므로 뒤로 가기가 쌓이지 않습니다.
 */
export function AuthPanel({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  /* 초대 링크에서 넘어왔다면 로그인 뒤 그리로 돌아가야 합니다.
     띠를 눌러 가입 쪽으로 갈아탈 때도 잃어버리면 안 됩니다. */
  const { next: back } = useLocalSearchParams<{ next?: string }>();
  const { login, register } = useAuth();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  function switchTo(next: AuthMode) {
    if (next === mode) {
      return;
    }
    setError(null);
    /* 뒤로 가기에 쌓이지 않게 갈아 끼웁니다. 띠를 몇 번 눌렀다고 그만큼
       뒤로 가야 하면 답답합니다. */
    const to = next === 'login' ? '/(auth)/login' : '/(auth)/register';
    router.replace(back ? `${to}?next=${encodeURIComponent(back)}` : to);
  }

  /* 비었다고 버튼을 잠그지 않습니다. 브라우저가 자동완성으로 칸을 채울 때
     onChangeText 가 불리지 않는 경우가 있어, 다 채워 놓고도 눌리지 않는
     버튼이 됩니다. 대신 눌렀을 때 확인하고 알려 줍니다. */
  async function submit() {
    if (busy) {
      return;
    }
    if (!email.trim()) {
      setError('이메일을 입력해 주세요.');
      return;
    }
    if (isRegister && !name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (!password) {
      setError('비밀번호를 입력해 주세요.');
      return;
    }
    if (isRegister && password.length < PASSWORD_MIN) {
      setError(`비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        await register(email.trim(), name.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      /* 성공하면 (auth)/_layout 이 알아서 여행 목록으로 보냅니다. */
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      safeTop
      footer={
        <Button
          label={isRegister ? '가입하고 시작하기' : '로그인'}
          onPress={submit}
          busy={busy}
        />
      }>
      <View style={styles.brand}>
        <LogoLockup size={80} />
      </View>

      <SegmentedTabs items={TABS} value={mode} onChange={switchTo} />

      <View style={styles.head}>
        <Title>{isRegister ? '여행을 시작해요' : '다시 오셨네요'}</Title>
        <Body tone="secondary">
          {isRegister ? '계정을 만들면 바로 일정을 짤 수 있어요.' : '여행을 이어서 짜 봅시다.'}
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

        {isRegister ? (
          <Field
            label="이름"
            value={name}
            onChangeText={setName}
            placeholder="동행자에게 보일 이름"
            maxLength={80}
            returnKeyType="next"
          />
        ) : null}

        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          hint={isRegister ? `${PASSWORD_MIN}자 이상` : undefined}
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        {error ? <ErrorNote message={error} /> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.sm,
  },
  head: {
    gap: Spacing.sm,
  },
});
