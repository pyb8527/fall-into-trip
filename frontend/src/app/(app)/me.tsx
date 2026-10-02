import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Profile } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { FeedList } from '@/components/feed-list';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { markOf } from '@/constants/user-marks';
import {
  Band,
  Body,
  Caption,
  ErrorNote,
  Grow,
  Icon,
  ListRow,
  Loading,
  Row,
  Screen,
  SectionHeader,
  Tabs,
  Title,
} from '@/ui';
import { NavLeft } from '@/ui/nav';
import { LogoMark } from '@/ui/logo';

/** 어느 묶음을 보고 있나. */
type Lane = 'feed' | 'reviews';

/**
 * 마이페이지 (G-10).
 *
 * <h3>내 것과 남의 것이 같은 화면입니다</h3>
 *
 * <p>화면을 둘 두지 않습니다. 내 것에만 「내 계정」 줄이 붙고 나머지는
 * 같습니다 — 둘로 가르면 같은 묶음(피드·리뷰)을 두 군데서 그리게 되고,
 * 한쪽을 고칠 때 다른 쪽이 남습니다.
 *
 * <p>남의 것은 <b>같은 모임 사람에게만</b> 보입니다. 서버가 404 로 막고,
 * 화면은 그 404 를 그대로 보여 줍니다 — 「볼 수 없어요」라고 적으면
 * 「그런 사람이 있다」가 새어 나갑니다.
 *
 * <h3>내 피드가 여기 삽니다</h3>
 *
 * <p>그룹 없이 올린 글은 둘러보기에도 모임에도 안 섭니다. 그래서 올려 두고
 * 다시 볼 자리가 없었습니다 — 2단계에서 피드를 만들 때 비워 둔 자리입니다.
 */
export default function Me() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  /* 남의 것을 볼 때만 번호가 옵니다. 내 것은 번호 없이 들어옵니다. */
  const { id } = useLocalSearchParams<{ id?: string }>();
  const whose = typeof id === 'string' && id.length > 0 ? id : null;

  const profile = useAsync<Profile>(
    (signal) =>
      api.get(whose ? `/api/users/${encodeURIComponent(whose)}/profile` : '/api/me/profile', signal),
    [whose],
  );

  const [lane, setLane] = useState<Lane>('feed');
  const me = profile.data;

  return (
    <Screen
      safeTop
      header={
        <Row gap={Spacing.s2}>
          <NavLeft navigation={navigation} up="/(app)/home" />
          <Grow>
            <Title>{me?.mine === false ? (me.name ?? '프로필') : '내 페이지'}</Title>
          </Grow>
        </Row>
      }>
      <Stack.Screen options={{ headerShown: false }} />

      {profile.loading && !me ? <Loading /> : null}
      {profile.error ? <ErrorNote message={profile.error} onRetry={profile.reload} /> : null}

      {me ? (
        <>
          {/*
            누구인지.

            <p>표식을 골라 둔 사람은 그 이모지가, 안 고른 사람은 로고가
            섭니다. 이름의 첫 글자는 쓰지 않습니다 — 「박」이 든 동그라미는
            남의 얼굴과 구별이 안 됩니다.
          */}
          <Row gap={Spacing.s4} style={styles.who}>
            <View style={styles.face}>
              {me.mark ? (
                <Text style={styles.faceEmoji}>{markOf(me.mark)}</Text>
              ) : (
                <LogoMark size={29} />
              )}
            </View>
            <Grow gap={Spacing.s1}>
              <Title>{me.name}</Title>
              <Caption tone="secondary">{sinceOf(me.since)}부터</Caption>
            </Grow>
          </Row>

          {/*
            해 온 것.

            <p>네 숫자를 한 줄에 둡니다. 여행과 글은 「얼마나 다녔나」이고
            리뷰와 모임은 「얼마나 나눴나」입니다 — 둘씩 짝이라 넷을 고르게
            늘어놓습니다.
          */}
          <Row style={styles.counts}>
            <Tally n={me.counts.trips} what="여행" />
            <Tally n={me.counts.posts} what="글" />
            <Tally n={me.counts.reviews} what="리뷰" />
            <Tally n={me.counts.groups} what="모임" />
          </Row>

          <Band />

          <Tabs
            items={[
              { value: 'feed', label: me.mine ? '내 피드' : '피드' },
              { value: 'reviews', label: '리뷰' },
            ]}
            value={lane}
            onChange={setLane}
          />

          {lane === 'feed' ? (
            /*
              내 것일 때만 FeedList 를 씁니다.

              <p>그 부품은 「내 피드」(mine=true)를 받아 오고 글을 쓰는
              자리까지 들고 있습니다. 남의 피드를 보는 길은 서버에 아직
              없습니다 — 그룹 없이 올린 글은 올린 사람 것이고, 남에게
              보이려면 어느 모임을 통해 보이는지부터 정해야 합니다.
            */
            me.mine ? (
              <FeedList />
            ) : (
              <Caption tone="secondary">
                남의 피드는 아직 못 봐요. 같은 모임의 피드에서 볼 수 있어요.
              </Caption>
            )
          ) : (
            <MyReviews whose={whose} count={me.counts.reviews} />
          )}

          {/* 내 것에만 붙습니다. 남의 계정 설정을 열 수는 없습니다. */}
          {me.mine ? (
            <>
              <Band />
              <ListRow
                left={<Icon name="settings" size={24} tone="secondary" />}
                title="내 계정"
                subtitle={user?.email ?? undefined}
                right={<Icon name="chevron-right" size={20} tone="muted" />}
                last
                onPress={() => router.push('/(app)/settings')}
              />
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}


/** 숫자 하나. */
function Tally({ n, what }: { n: number; what: string }) {
  return (
    <View style={styles.tally}>
      <Text style={styles.tallyNum}>{n}</Text>
      <Caption tone="secondary">{what}</Caption>
    </View>
  );
}

/**
 * 남긴 리뷰들.
 *
 * <p>장소 이름을 여기서 알 수 없습니다. 리뷰는 <b>구글 장소 번호</b>에
 * 달려 있고(그래야 남의 일정에서도 쌓입니다), 그 번호를 이름으로 바꾸려면
 * 구글에 한 번 더 물어야 합니다 — 리뷰 열한 개면 열한 번입니다.
 *
 * <p>그래서 이름은 서버가 같이 보내 줄 때까지 번호를 안 보여 주고 별과 글만
 * 둡니다. 「어디였지」를 묻게 되는 자리라, 다음 묶음에서 장소 이름을 함께
 * 내려받게 고칩니다.
 */
function MyReviews({ whose, count }: { whose: string | null; count: number }) {
  if (whose) {
    return <Caption tone="secondary">남이 남긴 리뷰는 장소에서 볼 수 있어요.</Caption>;
  }
  return (
    <>
      <SectionHeader title="내가 남긴 것" tight note={`별점을 준 것 ${count}개`} />
      <Caption tone="secondary">
        장소 상세에서 남긴 별점과 한 줄이 여기 모여요. 장소 이름을 같이 보여 주는 일은 다음
        묶음입니다.
      </Caption>
    </>
  );
}

function sinceOf(iso: string) {
  const at = new Date(iso);
  return `${at.getFullYear()}년 ${at.getMonth() + 1}월`;
}

const styles = StyleSheet.create({
  who: {
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
  counts: {
    paddingVertical: Spacing.s3,
  },
  tally: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tallyNum: {
    ...Type.title3,
    color: Colors.text,
  },
});
