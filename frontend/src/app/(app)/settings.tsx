import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import { GoogleButton } from '@/components/google-button';
import { canNotify, notifyState, turnOff, turnOn } from '@/lib/notify';
import { useAuth } from '@/auth/auth-provider';
import { USER_MARKS, markOf } from '@/constants/user-marks';
import {
  Colors,
  Gutter,
  Palette,
  Radius,
  Spacing,
  Tap,
  Type,
  Weight,
} from '@/constants/theme';
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
  Press,
  Row,
  Screen,
  Split,
  Switch,
} from '@/ui';
import { LogoMark } from '@/ui/logo';

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
 * <p>묶음은 8픽셀 띠가 가릅니다. 띠 위에 작은 머리글을 두어 「알림」 ·
 * 「지도」 · 「계정」 을 나눕니다.
 */
export default function Settings() {
  const { user, logout, logoutAll } = useAuth();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  return (
    <Screen>
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
        <Line label="운영 관리" onPress={() => router.push('/admin')} />
      ) : null}

      <NotifyGroup />

      <MarkGroup />

      <AccountGroup />

      <Band />

      {/* 나가는 일 둘. 하나는 되돌릴 수 있고 하나는 다른 기기까지 끊습니다 —
          그래서 아래쪽 것만 빨간 글씨입니다. */}
      <Line label="로그아웃" onPress={logout} />
      <Line label="모든 기기에서 로그아웃" danger onPress={() => setLeaving(true)} />

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
 * 묶음 하나의 머리글.
 *
 * <p>읽으라고 있는 것이 아니라 「여기서부터 다른 이야기」 라는 표시입니다.
 * 그래서 본문보다 작고 흐리되 굵습니다.
 */
function GroupHead({ label }: { label: string }) {
  return <Text style={styles.groupHead}>{label}</Text>;
}

/**
 * 설정 한 줄.
 *
 * <h3>왜 {@link ListRow} 가 아닌가</h3>
 *
 * <p>{@link ListRow} 는 <b>눌러서 들어가는 물건</b>의 줄입니다 — 제 판과
 * 모서리를 가집니다. 설정 줄은 물건이 아니고, 눌러도 어디로 가지 않는 줄
 * (가입일처럼 값만 적는 줄)도 섞여 있습니다. 그런 줄까지 판에 담으면
 * 누를 수 있는 것처럼 보입니다.
 *
 * @param value 오른쪽에 적는 지금 값. 누르는 줄이면 뒤에 화살표가 섭니다.
 */
function Line({
  label,
  value,
  danger,
  onPress,
}: {
  label: string;
  value?: string;
  /** 되돌리기 어려운 일. 글자만 빨갛게 둡니다 — 채운 단추는 과합니다. */
  danger?: boolean;
  onPress?: () => void;
}) {
  const inside = (
    <>
      <Grow>
        <Body tone={danger ? 'danger' : 'default'}>{label}</Body>
      </Grow>
      {value ? (
        <Caption tone="secondary" numberOfLines={1}>
          {value}
        </Caption>
      ) : null}
      {onPress ? <Icon name="chevron-right" size={20} tone="muted" /> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.line}>{inside}</View>;
  }
  return (
    <Press onPress={onPress} scale={1} accessibilityLabel={label} style={styles.line}>
      {inside}
    </Press>
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
      <GroupHead label="알림" />

      {state === 'blocked' ? (
        /* 우리가 할 수 있는 것이 없습니다. 어디서 푸는지만 알려 줍니다. */
        <View style={styles.line}>
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
      <GroupHead label="지도" />
      <Line label="지도에서 나" value={now} onPress={() => setOpen(true)} />
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
 * 계정 묶음 — 무엇으로 들어오는가, 그리고 언제부터인가.
 *
 * <p>구글 연결과 비밀번호가 각각 판 하나였습니다. 둘 다 「어떻게 들어오는가」
 * 한 가지를 말하는 것이라 한 묶음에 섭니다.
 */
function AccountGroup() {
  const { user, googleClientId, refreshUser, changePassword } = useAuth();
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
      <GroupHead label="계정" />

      {showGoogle ? (
        <Press
          onPress={() => setLinking(true)}
          scale={1}
          accessibilityLabel="구글로 로그인하기"
          style={styles.line}>
          <Grow>
            <Body>구글로 로그인하기</Body>
          </Grow>
          {linked ? <Badge label="연결됨" tone="success" /> : null}
          <Icon name="chevron-right" size={20} tone="muted" />
        </Press>
      ) : null}

      <Line label="비밀번호 바꾸기" onPress={() => setChanging(true)} />
      <Line label="가입" value={formatDate(user?.createdAt)} />
      <Line label="마지막 로그인" value={formatDate(user?.lastLoginAt)} />

      {error ? <ErrorNote message={error} /> : null}

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
  groupHead: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Palette.gray[500],
    paddingTop: Spacing.s6,
    paddingBottom: Spacing.s2,
  },
  /* 설정 한 줄. 손가락이 닿을 높이를 채웁니다. */
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    minHeight: Tap.min + Spacing.s3,
    paddingVertical: Spacing.s2,
  },
  tiles: {
    flexWrap: 'wrap',
  },
});
