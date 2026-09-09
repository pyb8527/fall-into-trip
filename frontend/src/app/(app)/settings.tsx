import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import { canNotify, notifyState, turnOff, turnOn } from '@/lib/notify';
import { useAuth } from '@/auth/auth-provider';
import { USER_MARKS, markOf } from '@/constants/user-marks';
import { Colors, Radius, Spacing } from '@/constants/theme';
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
  Press,
  Row,
  Screen,
  Subtitle,
} from '@/ui';
import { LogoMark } from '@/ui/logo';

const PASSWORD_MIN = 8;

export default function Settings() {
  const { user, logout, logoutAll } = useAuth();
  const router = useRouter();

  return (
    <Screen safeTop>

      <Card>
        <Row gap={Spacing.lg}>
          {user?.mark ? (
            <Body style={styles.markEmoji}>{markOf(user.mark)}</Body>
          ) : (
            <LogoMark size={22} />
          )}
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

      <NotifyCard />

      <MarkCard />

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

/**
 * 동행자가 고쳤을 때 알려 주기.
 *
 * <p>함께 짜는 일정인데 남이 고친 것은 그 화면을 다시 열어야만 알 수
 * 있었습니다. 출발 전날 동행자가 저녁 자리를 바꿔 놨는데 나는 옛 가게로
 * 가는 일이 생깁니다.
 *
 * <p>못 켜는 자리에서는 이 판을 아예 내지 않습니다. 앱은 아직 안 되고,
 * 아이폰 사파리는 홈 화면에 얹어야만 됩니다. 눌러서 안 되는 스위치를
 * 보여 주느니 없는 편이 낫습니다.
 */
function NotifyCard() {
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
        setFailed('알림을 켜지 못했습니다. 잠시 뒤 다시 눌러 주세요.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Subtitle>알림</Subtitle>
      <Body small tone="secondary">
        동행자가 일정을 고치면 이 기기로 알려 드립니다. 한 번 고칠 때마다 울리지는 않고, 한동안
        고친 것을 묶어 한 번만 옵니다.
      </Body>

      {state === 'blocked' ? (
        /* 우리가 할 수 있는 것이 없습니다. 어디서 푸는지만 알려 줍니다. */
        <Caption tone="danger">
          이 브라우저에서 알림을 막아 두었습니다. 주소창 왼쪽의 자물쇠를 눌러 알림을 허용으로
          바꾸면 켤 수 있습니다.
        </Caption>
      ) : (
        <Button
          label={state === 'on' ? '이 기기에서 알림 끄기' : '이 기기에서 알림 받기'}
          variant={state === 'on' ? 'secondary' : 'primary'}
          busy={busy}
          onPress={toggle}
        />
      )}

      {state === 'on' ? (
        <Caption tone="success">켜 두었습니다. 기기마다 따로 켜야 합니다.</Caption>
      ) : null}
      {failed ? <ErrorNote message={failed} /> : null}
    </Card>
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
 */
function MarkCard() {
  const { user, refreshUser } = useAuth();
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

  return (
    <Card>
      <Subtitle>지도에서 나</Subtitle>
      <Body small tone="secondary">
        동행자와 위치를 나눌 때 지도에 이 그림으로 찍힙니다. 안 고르면 이름 첫 글자로
        찍힙니다.
      </Body>

      <Row gap={Spacing.xs}>
        <Press
          onPress={() => pick(null)}
          scale={0.9}
          accessibilityLabel="그림 없이 이름 첫 글자"
          accessibilityState={{ selected: !user?.mark }}
          style={[styles.mark, !user?.mark ? styles.markOn : null]}>
          <Body small strong tone={!user?.mark ? 'accent' : 'secondary'}>
            {user?.name?.slice(0, 1) ?? '나'}
          </Body>
        </Press>
        {USER_MARKS.map((m) => {
          const on = user?.mark === m.key;
          return (
            <Press
              key={m.key}
              onPress={() => pick(m.key)}
              scale={0.9}
              accessibilityLabel={m.label}
              accessibilityState={{ selected: on }}
              style={[styles.mark, on ? styles.markOn : null]}>
              <Body style={styles.markEmoji}>{m.emoji}</Body>
            </Press>
          );
        })}
      </Row>

      {error ? <ErrorNote message={error} /> : null}
    </Card>
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
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
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
  mark: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  markEmoji: {
    /* 이모지는 글꼴이 제 높이를 갖고 있어, 줄 높이를 두면 아래로 처집니다. */
    lineHeight: undefined,
  },
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
