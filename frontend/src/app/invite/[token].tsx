import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { InvitePreview } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { Body, Button, Caption, Card, ErrorNote, Loading, Screen, Title } from '@/ui';
import { LogoLockup } from '@/ui/logo';
import { formatInstant } from '@/lib/countdown';

/**
 * 초대 링크를 눌렀을 때.
 *
 * <p>이 화면은 로그인 없이도 열립니다. 어떤 모임에 불렸는지 먼저 보여 주고
 * 나서 들어갈지 묻는 편이, 무엇인지도 모르고 가입부터 하라는 것보다 낫기
 * 때문입니다. 서버도 미리보기만 열어 두었습니다.
 *
 * <p>아는 이름을 함께 냅니다. 모임 이름만으로는 어떤 모임인지 모르는 일이
 * 흔한데, 아는 이름이 하나라도 보이면 들어갈지를 바로 정할 수 있습니다.
 *
 * <p>들어가는 것은 로그인해야 합니다. 로그인하고 나면 여기로 돌아와야 하므로
 * 어디서 왔는지를 주소에 실어 보냅니다.
 */
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { ready, user } = useAuth();

  const { data, error, loading } = useAsync<{ invite: InvitePreview }>(
    (signal) => api.get(`/api/group-invites/${encodeURIComponent(token)}/preview`, signal),
    [token],
  );

  const [joining, setJoining] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function join() {
    setFailed(null);
    setJoining(true);
    try {
      const res = await api.post<{ groupId: string }>(
        `/api/group-invites/${encodeURIComponent(token)}/accept`,
      );
      /* 들어왔으면 초대 화면은 뒤로 가기에 남기지 않습니다. */
      router.replace({ pathname: '/group/[id]', params: { id: res.groupId } });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      setJoining(false);
    }
  }

  const invite = data?.invite;

  return (
    <Screen safeTop>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.brand}>
        <LogoLockup size={83} />
      </View>

      {loading ? <Loading /> : null}

      {error ? (
        <>
          <ErrorNote message={error} />
          <Caption tone="secondary">
            기한이 지났거나 닫힌 링크일 수 있어요. 부른 사람에게 새로 받아 주세요.
          </Caption>
        </>
      ) : null}

      {invite ? (
        <>
          <View style={styles.head}>
            <Title>
              {invite.emoji ? `${invite.emoji} ` : ''}
              {invite.name}
            </Title>
            <Body tone="secondary">
              {invite.someNames.length > 0
                ? `${invite.someNames.join(', ')} 님이 있는 모임이에요.`
                : '모임에 초대를 받았어요.'}
            </Body>
          </View>

          <Card>
            {invite.about ? <Caption tone="secondary">{invite.about}</Caption> : null}
            <Caption tone="secondary">
              지금 {invite.memberCount}명이 있어요. 들어오면 이 모임의 여행이 보이고,
              일정을 함께 고칠 수 있어요.
            </Caption>
            <Caption tone="secondary">
              {invite.expiresAt
                ? `${formatInstant(invite.expiresAt)}까지 쓸 수 있는 링크예요.`
                : '기한이 없는 링크예요.'}
            </Caption>
          </Card>

          {failed ? <ErrorNote message={failed} /> : null}

          {!ready ? (
            <Loading />
          ) : user ? (
            <Button label="모임에 들어가기" onPress={join} busy={joining} />
          ) : (
            <>
              <Button
                label="로그인하고 함께하기"
                onPress={() =>
                  router.push(`/(auth)/login?next=${encodeURIComponent(`/invite/${token}`)}`)
                }
              />
              <Caption tone="secondary">
                계정이 없어도 돼요. 로그인 화면에서 바로 만들 수 있어요.
              </Caption>
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
    paddingBottom: Spacing.md,
  },
  head: {
    gap: Spacing.xs,
  },
});
