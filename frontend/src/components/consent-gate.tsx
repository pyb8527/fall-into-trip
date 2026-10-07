import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError, UNEXPECTED } from '@/api/client';
import { useAuth } from '@/auth/auth-provider';
import { agreedAll, ConsentChecks, NO_CONSENT } from '@/components/consent-checks';
import { Colors, Radius, Spacing, Type, Weight } from '@/constants/theme';
import { inShell } from '@/lib/shell-bridge.web';
import { Body, Button, Caption, ErrorNote, Row, Screen, Subtitle, Title } from '@/ui';
import { LogoSymbol } from '@/ui/logo';

/**
 * 동의 화면을 띄우지 않는 주소.
 *
 * <ul>
 *   <li><b>/account/delete</b> — 동의하지 않겠다는 사람도 계정을 지울 수
 *       있어야 합니다. 동의해야 탈퇴할 수 있으면, 동의를 거절한 사람의
 *       정보를 거절한 채로 붙들고 있게 됩니다.</li>
 *   <li><b>/view/…</b> — 여행 주인이 바깥에 건넨 보기 전용 링크입니다.
 *       로그인 없이도 열리는 자리라, 로그인해 있다는 이유로 막을 까닭이
 *       없습니다.</li>
 * </ul>
 *
 * <p>/info · /terms · /privacy · /location-terms 는 앱 밖의 정적 문서라
 * 이 화면이 아예 안 뜹니다.
 */
function exempt(path: string): boolean {
  return path === '/account/delete' || path.startsWith('/view/');
}

/**
 * 동의 화면 — 지금 판의 약관에 아직 동의하지 않은 사람에게만.
 *
 * <h3>왜 들어온 뒤에 묻는가</h3>
 *
 * <p>비밀번호로 가입하는 사람은 가입 화면에서 이미 동의합니다. 그런데 구글 ·
 * 카카오로 처음 들어오는 사람은 우리 가입 화면을 거치지 않습니다 — 소셜
 * 동의 화면은 그 회사의 약관이지 우리 약관이 아닙니다. 이 칸이 생기기 전에
 * 가입한 사람, 약관을 고쳐 판이 바뀐 뒤에 들어온 사람도 같습니다. 그래서
 * 서버가 {@code user.needsConsent} 를 내려보내고, 켜져 있으면 여기서 묻습니다.
 *
 * <h3>왜 화면을 덮는가</h3>
 *
 * <p>(app) 층 하나에서만 막으면 그 밖에 있는 여행 상세 · 가계부 · 모임 ·
 * 피드 글로 곧장 들어온 사람이 그대로 지나갑니다. 그래서 가장 바깥 층
 * ({@code app/_layout})에서 <b>길(Stack)은 그대로 두고 그 위를 덮습니다.</b>
 * 길을 걷어 내고 이 화면만 그리면 주소가 갈 데를 잃어, 동의한 뒤에 원래
 * 열려던 화면으로 못 돌아갑니다. 덮어 두면 동의하는 순간 걷히고 밑에 있던
 * 화면이 그대로 있습니다.
 *
 * <p>서버는 동의 전에도 다른 요청을 받습니다. 여기서 막는 것은 화면 흐름이고,
 * 동의 기록은 서버가 {@code POST /api/auth/agree} 로 남깁니다.
 */
export function ConsentGate() {
  const { ready, user } = useAuth();
  const path = usePathname();

  if (!ready || !user?.needsConsent || exempt(path)) {
    return null;
  }
  return (
    <View style={styles.cover}>
      <ConsentScreen />
    </View>
  );
}

function ConsentScreen() {
  const { agree, logout } = useAuth();
  const router = useRouter();
  const [consent, setConsent] = useState(NO_CONSENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = agreedAll(consent);

  async function submit() {
    if (busy || !ok) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await agree(consent);
      /* 걷히는 일은 ConsentGate 가 합니다 — needsConsent 가 꺼지면 덮개가 사라집니다. */
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen safeTop>
      <LogoSymbol size={56} />

      <Title>시작하기 전에 확인해 주세요</Title>
      <Body tone="secondary">
        fit 을 쓰려면 아래 세 가지에 동의해야 해요. 「보기」를 누르면 문서를 열어 볼 수 있어요.
      </Body>

      <View style={styles.checks}>
        <ConsentChecks value={consent} onChange={setConsent} />
      </View>

      {/*
        앱 접근권한 안내.

        <p>앱(껍데기) 안에서만 보입니다. 권한은 폰이 묻는 것이라 브라우저로
        쓰는 사람에게는 해당이 없습니다. 정보통신망법 제22조의2 가 「필수와
        선택을 나눠 무엇에 쓰는지」 알리게 합니다 — 필수가 없다는 것도 알릴
        말입니다.
      */}
      {inShell ? (
        <View style={styles.perms}>
          <Subtitle>앱 접근권한 안내</Subtitle>
          <Body small>필수 권한: 없어요.</Body>
          <Caption tone="secondary">
            선택 권한은 쓰는 순간에 물어요. 거부해도 나머지는 그대로 써요.
          </Caption>
          <View style={styles.permList}>
            <Perm name="위치" use="지도에 내 위치 · 지금 여기" />
            <Perm name="사진" use="여행 사진 · 프로필 올리기" />
            <Perm name="알림" use="새 글 · 댓글 · 여행 알림" />
            <Perm name="캘린더" use="여행을 폰 캘린더에 넣기" />
          </View>
        </View>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      <View style={styles.submit}>
        <Button label="동의하고 시작하기" onPress={submit} busy={busy} disabled={!ok} />
      </View>

      {/*
        나가는 길 둘.

        <p>동의하지 않을 사람이 갇히면 안 됩니다. 로그아웃은 그냥 나가는 것이고,
        탈퇴는 이미 만들어진 계정을 지우는 것입니다 — 구글 · 카카오로 한 번
        들어오는 순간 계정이 생기므로, 동의를 거절한 사람에게는 이 길이
        있어야 합니다. 탈퇴 화면은 이 덮개가 안 뜨는 자리입니다(exempt).
      */}
      <Row gap={Spacing.s4} style={styles.leave}>
        <Pressable accessibilityRole="button" onPress={logout} style={styles.leaveTap}>
          <Text style={styles.leaveText}>로그아웃</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/account/delete')}
          style={styles.leaveTap}>
          <Text style={styles.leaveText}>회원 탈퇴</Text>
        </Pressable>
      </Row>
    </Screen>
  );
}

/** 권한 한 줄 — 이름은 굵게, 쓰는 곳은 옅게. */
function Perm({ name, use }: { name: string; use: string }) {
  return (
    <Text style={styles.perm}>
      <Text style={styles.permName}>{name}</Text>
      {'  '}
      {use}
    </Text>
  );
}

const styles = StyleSheet.create({
  /* 밑의 길(Stack)을 통째로 덮습니다. 바탕을 칠해야 밑의 화면이 비쳐 보이지 않습니다. */
  cover: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    backgroundColor: Colors.background,
  },
  /* 가입 화면(auth-panel)과 같은 셈입니다 — 제목 아래 32 가 되게 20 을 더합니다. */
  checks: {
    marginTop: Spacing.s5,
  },
  perms: {
    marginTop: Spacing.s4,
    padding: Spacing.s4,
    gap: Spacing.s2,
    borderRadius: Radius.r3,
    backgroundColor: Colors.fill,
  },
  permList: {
    gap: Spacing.s1,
    marginTop: Spacing.s1,
  },
  perm: {
    ...Type.body2,
    color: Colors.textSecondary,
  },
  permName: {
    color: Colors.text,
    fontWeight: Weight.semibold,
  },
  submit: {
    marginTop: Spacing.s3,
  },
  leave: {
    marginTop: Spacing.s4,
    justifyContent: 'center',
  },
  leaveTap: {
    /* 글자만 있는 단추라 누르는 넓이를 손가락만큼 채웁니다. */
    paddingVertical: Spacing.s3,
    paddingHorizontal: Spacing.s2,
  },
  leaveText: {
    ...Type.body2,
    color: Colors.textSecondary,
  },
});
