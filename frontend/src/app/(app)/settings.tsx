import Constants from 'expo-constants';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, API_BASE, ApiError, UNEXPECTED } from '@/api/client';
import { GoogleButton } from '@/components/google-button';
import { canSignInWithKakao, KakaoButton } from '@/components/kakao-button';
import { canNotify, notifyState, turnOff, turnOn } from '@/lib/notify';
import { shareLink } from '@/lib/share';
import { useAuth } from '@/auth/auth-provider';
import { USER_MARKS, markOf } from '@/constants/user-marks';
import { Colors, Radius, Spacing, Tap, Type } from '@/constants/theme';
import {
  Badge,
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  ChoiceTile,
  ConfirmDialog,
  ErrorNote,
  Field,
  Grow,
  Icon,
  ListRow,
  Row,
  Screen,
  SectionHeader,
  Switch,
  Title,
} from '@/ui';
import { LogoMark } from '@/ui/logo';
import { NavLeft } from '@/ui/nav';

const PASSWORD_MIN = 8;

/**
 * 내 계정.
 *
 * <h3>판 여섯 개가 쌓여 있었습니다</h3>
 *
 * <p>알림·지도 표식·구글 연결·비밀번호·로그아웃이 저마다 흰 판을 두르고,
 * 판마다 제목과 설명 두 줄과 단추가 들어 있었습니다. 설정 화면에서 하는
 * 일은 대개 <b>하나</b>인데, 그 하나를 찾으려고 설명문 다섯 덩어리를
 * 읽어 내려가야 했습니다.
 *
 * <p>줄 목록으로 바꿉니다. 한 줄에 이름과 지금 값만 적고, 고치는 일은
 * 눌렀을 때 판이 올라와서 받습니다. 그러면 화면을 열었을 때 <b>무엇을
 * 바꿀 수 있는지가 목록으로 한눈에</b> 보입니다 — 상용 앱의 설정이 거의
 * 다 이 모양인 까닭입니다.
 *
 * <p>묶음은 8픽셀 띠가 가릅니다. 띠마다 머리글을 두어 「알림」 · 「지도」 ·
 * 「계정」 을 나눕니다. 머리글은 이 화면이 만들지 않고 <b>구역 머리 부품</b>
 * (SectionHeader)이 씁니다 — 화면마다 손으로 만들던 머리글이 크기도 여백도
 * 달라서, 화면을 옮겨 다니면 같은 앱이 아닌 것처럼 보였습니다.
 *
 * <h3>제목이 상단바에서 본문으로 내려왔습니다</h3>
 *
 * <p>갈래에서 바로 열리는 다른 화면들은 큰 제목을 본문 맨 위에 두는데 이
 * 화면만 작은 제목을 막대 가운데에 두고 있었습니다. 같은 자리로 맞춥니다.
 * 돌아갈 길이 있어야 하는 화면이라 제목 왼쪽에 뒤로·처음 단추를 둡니다.
 */
export default function Settings() {
  const { user, logout, logoutAll } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);

  return (
    <Screen
      safeTop
      header={
        <Row gap={Spacing.s2}>
          <NavLeft navigation={navigation} up="/(app)/home" />
          <Grow>
            <Title>내 계정</Title>
          </Grow>
        </Row>
      }>
      {/* 큰 제목이 본문 위에 서므로 상단바는 걷습니다. 둘 다 두면 같은 말이
          한 화면에 두 번 적힙니다. */}
      <Stack.Screen options={{ headerShown: false }} />
      {/*
        누구로 들어와 있는지.

        <p>가입일·마지막 로그인까지 함께 담아 네 줄짜리 판이었습니다. 그 둘은
        하루에 한 번도 볼 일이 없는 값이라, 이름과 주소보다 아래에 있어야
        합니다 — 「계정」 묶음으로 내려보냅니다.
      */}
      <Row gap={Spacing.s4} style={styles.me}>
        <View style={styles.face}>
          {user?.mark ? (
            <Text style={styles.faceEmoji}>{markOf(user.mark)}</Text>
          ) : (
            <LogoMark size={29} />
          )}
        </View>
        <Grow gap={Spacing.s1}>
          <Row gap={Spacing.s2}>
            <Body strong numberOfLines={1}>
              {user?.name}
            </Body>
            {user?.role === 'ADMIN' ? <Badge label="운영자" tone="accent" /> : null}
          </Row>
          <Caption tone="secondary" numberOfLines={1}>
            {user?.email}
          </Caption>
        </Grow>
      </Row>

      {user?.role === 'ADMIN' ? (
        <Line label="운영 관리" last onPress={() => router.push('/admin')} />
      ) : null}

      <NotifyGroup />

      <MarkGroup />

      <CalendarGroup />

      <AccountGroup />

      <Band />

      {/* 나가는 일 둘. 하나는 되돌릴 수 있고 하나는 다른 기기까지 끊습니다 —
          그래서 아래쪽 것만 빨간 글씨입니다. */}
      <Line label="로그아웃" onPress={logout} />
      <Line label="모든 기기에서 로그아웃" danger last onPress={() => setLeaving(true)} />

      {/*
        몇 판인지.

        <p>이것이 없으면 「안 되는데요」 를 받았을 때 <b>어느 판에서</b> 안
        되는지를 물어봐야 합니다. 스스로 올라가는 앱(OTA)이라 사람마다 든
        판이 다를 수 있어서 더 그렇습니다.

        <p>맨 아래, 가장 작은 글자로 둡니다. 읽으라고 있는 것이 아니라
        물어볼 때 찾으려고 있는 것입니다.
      */}
      <Text style={styles.build}>FIT {Constants.expoConfig?.version ?? ""}</Text>

      <ConfirmDialog
        visible={leaving}
        title="모든 기기에서 나갈까요?"
        message="폰·PC에 로그인해 둔 것이 모두 풀려요. 다시 들어올 때는 비밀번호를 다시 적어야 해요."
        confirmLabel="전부 내보내기"
        danger
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          logoutAll();
        }}
      />
    </Screen>
  );
}

/**
 * 설정 한 줄.
 *
 * <h3>목록 줄 부품을 그대로 씁니다</h3>
 *
 * <p>전에는 이 화면이 줄을 직접 그렸습니다. {@code ListRow} 가 흰 판과
 * 모서리를 가지던 시절의 판단이었는데, 바닥이 흰색이 된 뒤로 그 판은
 * 사라졌습니다 — 지금 {@code ListRow} 는 <b>배경 없는 줄 + 아래 선</b>이라
 * 설정 줄이 바라던 모양 그대로입니다. 직접 그릴 이유가 없어졌습니다.
 *
 * <p>맞춰 쓰면 같은 일을 하는 줄이 보석함·가계부·모임과 같은 높이·여백·
 * 선으로 섭니다. 설정 화면만 줄 모양이 다르던 것이 「도화지에 아무거나
 * 올려 둔 느낌」 의 한 조각이었습니다.
 *
 * <h3>값만 적는 줄은 여전히 따로입니다</h3>
 *
 * <p>{@code ListRow} 는 누르는 줄이라 갈 곳이 반드시 있어야 합니다. 가입일
 * 처럼 값만 적는 줄은 누를 데가 없는데, 누르는 줄로 두면 눌러도 아무 일이
 * 안 일어나는 줄이 목록에 섞입니다. 그 줄만 높이와 선을 맞춘 제 모양으로
 * 둡니다.
 *
 * @param value 오른쪽에 적는 지금 값. 누르는 줄이면 뒤에 화살표가 섭니다
 * @param badge 값 대신 오른쪽에 서는 표. 「연결됨」 처럼 상태를 말할 때
 * @param last  묶음의 마지막 줄인지. 마지막에는 선을 안 긋습니다
 */
function Line({
  label,
  value,
  badge,
  danger,
  last,
  onPress,
}: {
  label: string;
  value?: string;
  badge?: React.ReactNode;
  /** 되돌리기 어려운 일. 글자만 빨갛게 둡니다 — 채운 단추는 과합니다. */
  danger?: boolean;
  last?: boolean;
  onPress?: () => void;
}) {
  if (!onPress) {
    return (
      <View style={[styles.fact, last ? null : styles.factLine]}>
        <Grow>
          <Body>{label}</Body>
        </Grow>
        {value ? (
          <Caption tone="secondary" numberOfLines={1}>
            {value}
          </Caption>
        ) : null}
      </View>
    );
  }

  return (
    <ListRow
      /* 빨간 줄은 글자를 바꿔 끼웁니다. 줄 제목의 굵기는 그대로 두고 색만
         갈아야 다른 줄들과 같은 무게로 섭니다. */
      title={
        danger ? (
          <Body strong tone="danger">
            {label}
          </Body>
        ) : (
          label
        )
      }
      last={last}
      right={
        <Row gap={Spacing.s2}>
          {badge}
          {value ? (
            <Caption tone="secondary" numberOfLines={1}>
              {value}
            </Caption>
          ) : null}
          <Icon name="chevron-right" size={20} tone="muted" />
        </Row>
      }
      onPress={onPress}
    />
  );
}

/**
 * 동행자가 고쳤을 때 알려 주기.
 *
 * <p>함께 짜는 일정인데 남이 고친 것은 그 화면을 다시 열어야만 알 수
 * 있었습니다. 출발 전날 동행자가 저녁 자리를 바꿔 놨는데 나는 옛 가게로
 * 가는 일이 생깁니다.
 *
 * <p>못 켜는 자리에서는 이 묶음을 아예 내지 않습니다. 앱은 아직 안 되고,
 * 아이폰 사파리는 홈 화면에 얹어야만 됩니다. 눌러서 안 되는 스위치를
 * 보여 주느니 없는 편이 낫습니다.
 *
 * <h3>단추에서 스위치로</h3>
 *
 * <p>「이 기기에서 알림 받기」 라는 채운 단추였습니다. 그런데 이것은 켜고
 * 끄는 것이고, 켜고 끄는 것의 생김새는 스위치입니다 — 단추는 <b>한 번
 * 하는 일</b>의 모양입니다. 지금 켜져 있는지를 단추 글자를 읽어서
 * 알아내야 했습니다.
 */
function NotifyGroup() {
  const [state, setState] = useState<'off' | 'on' | 'blocked'>('off');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    notifyState().then((got) => {
      if (alive) {
        setState(got);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!canNotify) {
    return null;
  }

  async function toggle() {
    if (busy) {
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      if (state === 'on') {
        await turnOff(api);
        setState('off');
        return;
      }
      const got = await turnOn(api);
      setState(got === 'failed' ? 'off' : got);
      if (got === 'failed') {
        setFailed('알림을 켜지 못했어요. 잠시 뒤 다시 눌러 주세요.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Band />
      <SectionHeader title="알림" tight />

      {state === 'blocked' ? (
        /* 우리가 할 수 있는 것이 없습니다. 어디서 푸는지만 알려 줍니다. */
        <View style={styles.fact}>
          <Caption tone="danger">
            이 브라우저에서 알림을 막아 뒀어요. 주소창 왼쪽의 자물쇠를 눌러 알림을 허용으로
            바꾸면 켤 수 있어요.
          </Caption>
        </View>
      ) : (
        <Switch
          label="이 기기에서 알림 받기"
          hint="동행자가 일정을 고치면 알려 드려요. 기기마다 따로 켜야 해요."
          value={state === 'on'}
          onChange={toggle}
        />
      )}

      {failed ? <ErrorNote message={failed} /> : null}
    </>
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
 *
 * <h3>고르는 칸을 판으로 내렸습니다</h3>
 *
 * <p>그림 아홉 개가 설정 화면에 늘 펼쳐져 있었습니다. 한 번 고르면 몇 달은
 * 안 바꾸는 것인데, 그 아홉 칸이 설정 화면의 가장 넓은 자리를 먹고 있었고
 * 그 아래 비밀번호·로그아웃은 늘 화면 밖에 있었습니다. 지금 고른 것만 줄에
 * 적고, 고르는 일은 눌렀을 때 올라오는 판이 받습니다.
 */
function MarkGroup() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
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
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  const now = user?.mark
    ? (USER_MARKS.find((m) => m.key === user.mark)?.label ?? markOf(user.mark))
    : '이름 첫 글자';

  return (
    <>
      <Band />
      <SectionHeader title="지도" tight />
      <Line label="지도에서 나" value={now} last onPress={() => setOpen(true)} />
      {error ? <ErrorNote message={error} /> : null}

      <BottomSheet visible={open} title="지도에서 나" onClose={() => setOpen(false)}>
        <Body small tone="secondary">
          동행자와 위치를 나눌 때 지도에 이 그림으로 찍혀요. 안 고르면 이름 첫 글자로
          찍혀요.
        </Body>
        <Row gap={Spacing.s2} style={styles.tiles}>
          <ChoiceTile
            label={user?.name?.slice(0, 1) ?? '나'}
            selected={!user?.mark}
            onPress={() => pick(null)}
            accessibilityLabel="그림 없이 이름 첫 글자"
          />
          {USER_MARKS.map((m) => (
            <ChoiceTile
              key={m.key}
              mark={m.emoji}
              selected={user?.mark === m.key}
              onPress={() => pick(m.key)}
              accessibilityLabel={m.label}
            />
          ))}
        </Row>
      </BottomSheet>
    </>
  );
}

/**
 * 내 폰 캘린더에 넣기 — 캘린더 구독(.ics).
 *
 * <p>앱 안 달력은 앱을 열어야 보이고, 이것은 폰 캘린더에 뜹니다. 회사 일정
 * 옆에 「제주 2박 3일」이 보여야 그 주에 다른 약속을 안 잡습니다.
 *
 * <p>주소는 만들 때 한 번만 보여 줍니다. 서버에는 해시만 있어서 다시 꺼낼
 * 수가 없습니다 — 잃어버렸으면 새로 만들고, 그러면 옛 주소는 죽습니다.
 */
function CalendarGroup() {
  const [on, setOn] = useState<boolean | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ on: boolean }>('/api/me/calendar')
      .then((got) => setOn(got.on))
      .catch(() => setOn(null));
  }, []);

  async function issue() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const got = await api.post<{ path: string }>('/api/me/calendar');
      /* 웹은 같은 주소에서 서버를 부르므로 API_BASE 가 비어 있습니다. */
      const origin =
        API_BASE || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
      setUrl(origin + got.path);
      setOn(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await api.delete('/api/me/calendar');
      setOn(false);
      setUrl(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  if (on === null) {
    return null;
  }
  return (
    <>
      <Band />
      <SectionHeader title="캘린더" tight />
      <Line
        label="내 폰 캘린더에 넣기"
        badge={on ? <Badge label="켜짐" tone="success" /> : null}
        last
        onPress={() => setOpen(true)}
      />

      <BottomSheet visible={open} title="내 폰 캘린더에 넣기" onClose={() => setOpen(false)}>
        <Body small tone="secondary">
          내가 가는 여행이 폰 캘린더에 하루 종일 일정으로 떠요. 「못 가요」라고 한 여행은 빠지고,
          가계부·위치·메모는 안 들어가요.
        </Body>
        {url ? (
          <>
            {/* 한 번만 보여 줍니다. 서버에는 해시만 있습니다. */}
            <Caption tone="warning">이 주소는 지금만 보여요. 아는 사람은 누구나 내 여행 일정을 볼 수 있으니 남에게 주지 마세요.</Caption>
            <Body small selectable>
              {url}
            </Body>
            <Button
              label="주소 보내기 · 복사"
              variant="secondary"
              onPress={async () => {
                const done = await shareLink(url, 'FIT 여행 캘린더');
                setNote(done === 'copied' ? '복사했어요. 캘린더 앱의 「URL로 구독」에 붙여 넣으세요.' : null);
              }}
            />
            <Button
              label="애플 캘린더로 열기"
              variant="ghost"
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.location.assign(url.replace(/^https?:/, 'webcal:'));
                }
              }}
            />
            {note ? <Caption tone="success">{note}</Caption> : null}
          </>
        ) : (
          <Button
            label={on ? '주소 새로 만들기' : '주소 만들기'}
            busy={busy}
            onPress={issue}
          />
        )}
        {on && !url ? (
          <Caption tone="muted">
            켜 둔 주소는 다시 볼 수 없어요. 잃어버렸으면 새로 만드세요 — 옛 주소는 그때 끊겨요.
          </Caption>
        ) : null}
        <Caption tone="muted">
          구글 캘린더는 몇 시간에 한 번 다시 읽어 가요. 고친 일정이 바로 안 보일 수 있어요.
        </Caption>
        {error ? <ErrorNote message={error} /> : null}
        {on ? <Button label="끄기" variant="dangerText" busy={busy} onPress={revoke} /> : null}
      </BottomSheet>
    </>
  );
}

/**
 * 계정 묶음 — 무엇으로 들어오는가, 그리고 언제부터인가.
 *
 * <p>구글 연결과 비밀번호가 각각 판 하나였습니다. 둘 다 「어떻게 들어오는가」
 * 한 가지를 말하는 것이라 한 묶음에 섭니다.
 */
function AccountGroup() {
  const { user, googleClientId, kakaoEnabled, refreshUser, changePassword } = useAuth();
  /* 카카오 잇기에서 돌아왔는데 안 됐으면 서버가 까닭을 주소에 싣습니다. */
  const { social_error: socialError } = useLocalSearchParams<{ social_error?: string }>();
  const [kakaoSheet, setKakaoSheet] = useState(false);
  const [providers, setProviders] = useState<string[] | null>(null);
  const [linking, setLinking] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const got = await api.get<{ providers?: string[] }>('/api/auth/me');
      setProviders(got.providers ?? []);
    } catch {
      /* 못 받아 왔으면 이 줄만 안 그립니다. 설정의 나머지는 멀쩡합니다. */
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const linked = (providers ?? []).includes('google');
  /* 서버가 구글을 안 켰으면 그 줄 자체가 뜻이 없습니다. */
  const showGoogle = !!googleClientId && providers !== null;
  const kakaoLinked = (providers ?? []).includes('kakao');
  const showKakao = kakaoEnabled && canSignInWithKakao && providers !== null;

  /*
    카카오 잇기.

    <p>구글과 달리 이 화면에서 끝나지 않습니다. 서버에서 갈 주소를 받아
    페이지째 카카오로 갔다가, 다 되면 서버가 이 화면으로 돌려보냅니다.
  */
  async function connectKakao() {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const got = await api.post<{ url: string }>('/api/auth/link/kakao');
      window.location.assign(got.url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
      setBusy(false);
    }
  }

  async function disconnectKakao() {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const got = await api.delete<{ providers: string[] }>('/api/auth/link/kakao');
      setProviders(got.providers);
      setKakaoSheet(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  async function connect(credential: string) {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const got = await api.post<{ providers: string[] }>('/api/auth/link/google', { credential });
      setProviders(got.providers);
      await refreshUser();
      setLinking(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const got = await api.delete<{ providers: string[] }>('/api/auth/link/google');
      setProviders(got.providers);
      setLinking(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Band />
      <SectionHeader title="계정" tight />

      {showGoogle ? (
        <Line
          label="구글로 로그인하기"
          badge={linked ? <Badge label="연결됨" tone="success" /> : null}
          onPress={() => setLinking(true)}
        />
      ) : null}

      {showKakao ? (
        <Line
          label="카카오로 로그인하기"
          badge={kakaoLinked ? <Badge label="연결됨" tone="success" /> : null}
          onPress={() => setKakaoSheet(true)}
        />
      ) : null}

      <Line label="비밀번호 바꾸기" onPress={() => setChanging(true)} />
      <Line label="가입" value={formatDate(user?.createdAt)} />
      <Line label="마지막 로그인" value={formatDate(user?.lastLoginAt)} last />

      {error ? <ErrorNote message={error} /> : null}
      {!error && socialError ? <ErrorNote message={socialError} /> : null}

      <BottomSheet
        visible={kakaoSheet}
        title="카카오로 로그인하기"
        onClose={() => setKakaoSheet(false)}>
        {kakaoLinked ? (
          <>
            <Body small tone="secondary">
              이어 뒀어요. 다음부터 카카오 단추 하나로 들어와요.
            </Body>
            <Button label="끊기" variant="secondary" onPress={disconnectKakao} busy={busy} />
          </>
        ) : (
          <>
            <Body small tone="secondary">
              이어 두면 비밀번호를 안 적고 들어와요. 카카오에 다녀온 뒤 이 화면으로 돌아와요.
            </Body>
            <KakaoButton label="카카오 잇기" onPress={connectKakao} />
          </>
        )}
      </BottomSheet>

      {/*
        구글 잇기.

        <p>비밀번호로 가입해 둔 사람이 <b>구글을 잇는 자리</b>입니다. 구글
        로그인 화면에서 "이미 가입된 주소입니다" 를 받은 사람이 올 곳이
        여기라, 없으면 그 사람은 갈 데가 없습니다.

        <p>끊기는 서버가 막습니다 — 비밀번호가 없고 이어 둔 것이 이것
        하나뿐이면 끊는 순간 자기 계정에서 잠깁니다.
      */}
      <BottomSheet
        visible={linking}
        title="구글로 로그인하기"
        onClose={() => setLinking(false)}>
        {linked ? (
          <>
            <Body small tone="secondary">
              이어 뒀어요. 다음부터 구글 단추 하나로 들어와요.
            </Body>
            <Button label="끊기" variant="secondary" onPress={disconnect} busy={busy} />
          </>
        ) : (
          <>
            <Body small tone="secondary">
              이어 두면 비밀번호를 안 적고 들어와요. 비밀번호는 그대로 남아요.
            </Body>
            <GoogleButton onCredential={connect} />
          </>
        )}
      </BottomSheet>

      <PasswordSheet
        visible={changing}
        onClose={() => setChanging(false)}
        changePassword={changePassword}
      />
    </>
  );
}

/** 비밀번호를 바꾸면 서버가 다른 기기를 모두 내보냅니다. 이 기기만 남습니다. */
function PasswordSheet({
  visible,
  onClose,
  changePassword,
}: {
  visible: boolean;
  onClose: () => void;
  changePassword: (current: string, next: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const nextError =
    next.length > 0 && next.length < PASSWORD_MIN ? `${PASSWORD_MIN}자 이상이어야 해요.` : undefined;
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
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="비밀번호 바꾸기"
      onClose={onClose}
      footer={<Button label="바꾸기" onPress={submit} busy={busy} disabled={!ready} />}>
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
        hint={`${PASSWORD_MIN}자 이상. 바꾸면 다른 기기는 모두 로그아웃돼요.`}
        error={nextError}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {error ? <ErrorNote message={error} /> : null}
      {done ? (
        <Body small tone="success" strong>
          바꿨어요. 다른 기기는 모두 로그아웃됐어요.
        </Body>
      ) : null}
    </BottomSheet>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) {
    return '없음';
  }
  return iso.slice(0, 10);
}

const styles = StyleSheet.create({
  /* 누구로 들어와 있는지. 줄이 아니라 머리 구역이라 조금 더 높습니다. */
  me: {
    minHeight: 88,
    alignItems: 'center',
  },
  face: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceEmoji: {
    fontSize: 30,
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
  /*
    값만 적는 줄.

    <p>누르는 줄({@code ListRow})과 높이·여백·선을 같게 둡니다. 한 묶음
    안에서 누르는 줄과 안 눌리는 줄이 나란히 서므로, 줄 높이가 어긋나면
    목록이 들쭉날쭉해 보입니다.
  */
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    minHeight: Tap.min + Spacing.s3,
    paddingVertical: Spacing.s3,
  },
  factLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  tiles: {
    flexWrap: 'wrap',
  },
  /* 몇 판인지. 가장 작은 단으로, 가운데에. */
  build: {
    ...Type.micro,
    color: Colors.textDisabled,
    textAlign: 'center',
    paddingTop: Spacing.s6,
  },
});
