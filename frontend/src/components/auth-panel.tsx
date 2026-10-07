import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError, UNEXPECTED } from '@/api/client';
import { useAuth } from '@/auth/auth-provider';
import { Colors, Spacing, Type, Weight } from '@/constants/theme';
import { agreedAll, ConsentChecks, NO_CONSENT } from '@/components/consent-checks';
import { GoogleButton } from '@/components/google-button';
import { canSignInWithKakao, KakaoButton } from '@/components/kakao-button';
import { startKakao } from '@/lib/kakao-signin';
import { canSignInWithGoogle } from '@/lib/google-signin';
import { Button, ErrorNote, Field, IconButton, Row, Screen, Title } from '@/ui';
import { LogoSymbol } from '@/ui/logo';

/** 서버의 AuthService.PASSWORD_MIN 과 같아야 합니다. */
const PASSWORD_MIN = 8;

export type AuthMode = 'login' | 'register';

/**
 * 로그인과 회원가입.
 *
 * <h3>띠를 걷고 두 화면으로 나눴습니다</h3>
 *
 * <p>둘을 한 자리에 두고 <b>SegmentedTabs</b> 로 오갔습니다. 서로 대신하는
 * 화면이니 한 자리에 모아 두는 편이 "다른 쪽이 있다" 를 바로 보여 준다는
 * 이유였습니다.
 *
 * <p>그런데 띠는 <b>같은 것의 다른 모습</b>을 고르는 물건입니다 — 받은 돈과
 * 쓴 돈, 일정과 지도처럼요. 로그인과 가입은 같은 것의 다른 모습이 아니라
 * <b>다른 일</b>입니다. 들어온 사람은 둘 중 하나만 하려고 왔고, 다른 쪽을
 * 고르는 일은 많아도 한 번입니다. 그 한 번을 위해 화면 맨 위 한 줄을 늘
 * 비워 두고 있었습니다.
 *
 * <p>게다가 띠가 바뀔 때 <b>칸이 하나 늘었다 줄었다</b> 합니다(이름 칸).
 * 고르는 것과 바뀌는 것이 한 화면에 함께 있으면, 누른 뒤에 무엇이 달라졌는지
 * 를 눈이 다시 찾아야 합니다.
 *
 * <p>이제 화면 하나에 일 하나입니다. 다른 쪽으로 가는 길은 맨 아래 글자
 * 링크로 둡니다 — 지나가는 길목에 두면 매번 보이고, 아래에 두면 필요할 때만
 * 눈에 듭니다.
 *
 * <h3>판을 벗겼습니다</h3>
 *
 * <p>회색 바닥에 흰 카드를 얹고 그 안에 칸들을 두었습니다. 바닥이 흰색이
 * 된 뒤에는 그 카드가 <b>흰 종이 위의 흰 종이</b>입니다 — 테두리 하나로
 * 구역을 만들어 놓고 그 안에 화면 전체를 넣은 셈입니다. 걷습니다.
 *
 * <p>주소는 그대로 둘입니다(/login, /register).
 */
export function AuthPanel({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const navigation = useNavigation();
  /* 초대 링크에서 넘어왔다면 로그인 뒤 그리로 돌아가야 합니다.
     다른 쪽으로 갈아탈 때도 잃어버리면 안 됩니다. */
  /* social_error — 카카오에서 돌아왔는데 안 됐을 때 서버가 실어 보낸 까닭.
     카카오는 페이지째 오가서 이 화면이 그 말을 받을 길이 주소뿐입니다. */
  const { next: back, social_error: socialError } = useLocalSearchParams<{
    next?: string;
    social_error?: string;
  }>();
  const { login, register, signInWithGoogle, signInWithKakaoTicket } = useAuth();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(NO_CONSENT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  /** 다른 쪽(로그인 ↔ 가입)으로. 돌아갈 자리는 들고 갑니다. */
  function switchTo(next: AuthMode) {
    setError(null);
    /* 뒤로 가기에 쌓이지 않게 갈아 끼웁니다. 두 화면을 몇 번 오갔다고
       그만큼 뒤로 가야 하면 답답합니다. */
    const to = next === 'login' ? '/(auth)/login' : '/(auth)/register';
    router.replace(back ? `${to}?next=${encodeURIComponent(back)}` : to);
  }

  /**
   * 구글이 준 토큰으로 들어옵니다.
   *
   * <p>여기서 막히는 가장 흔한 경우가 <b>이미 그 주소로 비밀번호 계정이
   * 있는 것</b>입니다(409). 서버가 그때 무엇을 해야 하는지까지 적어서
   * 보내므로 그 문구를 그대로 띄웁니다.
   */
  async function withGoogle(credential: string) {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle(credential);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  /**
   * 카카오로 들어옵니다.
   *
   * <p>브라우저에서는 페이지째 옮겨 가서 여기로 안 돌아옵니다. 앱 껍데기
   * 안에서는 껍데기가 받아 온 표를 바꾸고 여기서 끝납니다.
   */
  async function withKakao() {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await startKakao(signInWithKakaoTicket);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
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
      setError(`비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`);
      return;
    }
    if (isRegister && !agreedAll(consent)) {
      setError('만 14세 이상이고 약관과 개인정보처리방침에 동의해야 가입할 수 있어요.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        await register(email.trim(), name.trim(), password, consent);
      } else {
        await login(email.trim(), password);
      }
      /* 성공하면 (auth)/_layout 이 알아서 여행 목록으로 보냅니다. */
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    /*
      단추를 아래에 붙이지 않습니다.

      붙여 두면 자판이 올라올 때 단추가 자판 바로 위로 따라 올라옵니다.
      거기를 누르면 먼저 칸에서 손이 떠나면서 자판이 닫히고, 그 순간 화면이
      도로 늘어나 단추가 손끝에서 달아납니다. 눌렀는데 아무 일도 안 일어난
      것처럼 보이고, 자판만 닫힙니다.

      본문 안에 두면 그럴 일이 없습니다. 스크롤 안에서는 자판이 올라와
      있어도 누른 것이 그대로 전해집니다(keyboardShouldPersistTaps).
      비밀번호 칸에서 자판의 완료를 눌러도 똑같이 들어갑니다.
    */
    <Screen
      safeTop
      header={
        <Row gap={Spacing.s1}>
          <IconButton
            name="chevron-left"
            label="뒤로"
            bare
            /* 링크로 바로 들어오면 밑에 쌓인 것이 없어 화살표가 아무 데도
               못 갑니다. 그때는 문으로 보냅니다 — 여기까지 온 사람에게
               돌아갈 곳은 거기입니다. */
            onPress={() =>
              navigation.canGoBack() ? navigation.goBack() : router.replace('/(auth)/welcome')
            }
          />
        </Row>
      }>
      {/*
        심볼만, 워드마크 없이.

        <p>카드 머리에 「fit / FALL INTO TRIP」 묶음을 104 크기로 세워
        두었습니다. 이름이 두 번 나오는 셈이었습니다 — 바로 아래 제목이
        「로그인」 이고, 여기까지 온 사람은 방금 문에서 이름을 봤습니다.
        심볼 하나면 "그 앱이 맞다" 가 확인됩니다.
      */}
      <LogoSymbol size={56} />

      <Title>{isRegister ? '가입하기' : '로그인'}</Title>

      <View style={styles.form}>
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
            placeholder="같이 가는 사람에게 보일 이름"
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

        {/*
          약관 동의. 가입할 때만 묻습니다 — 로그인하는 사람은 이미 동의했거나,
          아직이면 들어온 뒤에 동의 화면이 따로 묻습니다(consent-gate).
        */}
        {isRegister ? <ConsentChecks value={consent} onChange={setConsent} /> : null}

        {error ? <ErrorNote message={error} /> : null}
        {!error && socialError ? <ErrorNote message={socialError} /> : null}
      </View>

      <View style={styles.submit}>
        <Button
          label={isRegister ? '가입하고 시작하기' : '로그인'}
          onPress={submit}
          busy={busy}
          /* 다른 칸과 달리 동의 칸은 잠급니다. 위에서 말한 자동완성 걱정이
             네모에는 없고, 셋을 다 켜야 한다는 것이 잠긴 단추로 바로
             보입니다. */
          disabled={isRegister && !agreedAll(consent)}
        />
      </View>

      {/*
        구글로 들어오기.

        비밀번호 칸 아래에 둡니다. 위에 두면 이미 비밀번호로 쓰던 사람이
        매번 지나쳐야 합니다.
      */}
      <GoogleBlock onDone={withGoogle} onKakao={withKakao} />

      {/* 다른 쪽으로 가는 길. 맨 아래입니다 — 찾는 사람만 찾습니다. */}
      <Pressable
        accessibilityRole="link"
        style={styles.switch}
        onPress={() => switchTo(isRegister ? 'login' : 'register')}>
        <Text style={styles.switchText}>
          {isRegister ? '계정이 있나요? ' : '계정이 없나요? '}
          <Text style={styles.switchLink}>{isRegister ? '로그인' : '가입하기'}</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

/**
 * 구글 단추와 그 위의 가름 줄.
 *
 * <p>단추가 안 그려지는 자리(앱, 또는 서버가 구글을 안 켠 경우)에서는
 * <b>가름 줄도 안 뜹니다.</b> 아래가 빈 채로 "또는" 만 남으면 무엇이 빠진
 * 것처럼 보입니다.
 */
function GoogleBlock({
  onDone,
  onKakao,
}: {
  onDone: (credential: string) => void;
  onKakao: () => void;
}) {
  const { googleClientId, kakaoEnabled } = useAuth();
  const google = !!googleClientId && canSignInWithGoogle;
  const kakao = kakaoEnabled && canSignInWithKakao;
  /*
    두 쪽을 다 봅니다.

    <p>서버가 구글을 켰는지({@code googleClientId})와, <b>이 기기가 그 길을
    갖고 있는지</b>({@code canSignInWithGoogle})는 다른 이야기입니다. 앱은
    빌드에 제 클라이언트 ID 가 박혀 있어야 하는데, 서버 쪽만 보고 있으면
    그것이 없는 앱에서 "또는" 만 덩그러니 남습니다.
  */
  if (!google && !kakao) {
    return null;
  }
  return (
    <View style={styles.social}>
      {/*
        가름 줄.

        <p>글자만 두었습니다. 그러면 「또는」이 위아래 어느 쪽에 붙은
        말인지가 안 보이고, 가운데 떠 있는 낱말 하나가 됩니다. 양쪽으로
        선을 뻗으면 그 줄이 <b>경계</b>라는 것이 모양으로 읽힙니다.
      */}
      <Row gap={Spacing.s3} style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>또는</Text>
        <View style={styles.orLine} />
      </Row>
      {/* 카카오가 위입니다. 이 앱을 쓰는 사람 대부분에게 더 가까운 계정입니다. */}
      {kakao ? <KakaoButton onPress={onKakao} /> : null}
      {google ? <GoogleButton onCredential={onDone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /*
    칸들.

    <p>Screen 이 자식 사이를 12 씌웁니다. 제목과 첫 칸 사이는 32 라야 제목이
    칸들의 머리로 읽히므로 20 을 더합니다. 아래 셋도 같은 셈입니다.
  */
  form: {
    marginTop: Spacing.s5,
    gap: Spacing.s4,
  },
  submit: {
    marginTop: Spacing.s3,
  },
  social: {
    marginTop: Spacing.s5,
    gap: Spacing.s4,
    alignItems: 'center',
  },
  orRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  orText: {
    ...Type.caption,
    color: Colors.textDisabled,
  },
  switch: {
    marginTop: Spacing.s4,
    alignItems: 'center',
    /* 글자만 있는 링크라 보이는 높이가 글자 한 줄입니다. 누르는 넓이는
       손가락이 닿을 만큼 채웁니다. */
    paddingVertical: Spacing.s3,
  },
  switchText: {
    ...Type.body2,
    color: Colors.textSecondary,
  },
  switchLink: {
    color: Colors.accentInk,
    fontWeight: Weight.semibold,
  },
});
