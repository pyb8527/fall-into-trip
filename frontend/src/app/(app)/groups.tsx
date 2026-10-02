import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Group, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { CountdownBadge } from '@/components/countdown-badge';
import { GroupForm } from '@/components/group-form';
import { OurPhoto } from '@/components/our-photo';
import { Colors, Radius, Spacing, Type, Weight } from '@/constants/theme';
import { faceOf } from '@/constants/user-marks';
import { countdownOf, formatSpan, type Countdown } from '@/lib/countdown';
import {
  Body,
  BottomSheet,
  Button,
  Caption,
  ErrorNote,
  Field,
  Grow,
  Icon,
  IconButton,
  ListRow,
  Mark,
  Press,
  Row,
  Screen,
  Skeleton,
} from '@/ui';
import { ScreenTop } from '@/ui/nav';
import { AppTabs } from '@/ui/tab-bar';

/** 모임 목록이 카드에 얹어 받는 것(GroupCards). */
type GroupCard = Group & {
  faces?: { name: string; mark?: string | null }[];
  activity?: { kind: 'feed.post' | 'group.join'; actorName: string; at: string } | null;
  photoIds?: string[];
  /** 마지막으로 소식함을 연 뒤에 남이 무언가를 했는지 */
  fresh?: boolean;
};

/**
 * 내 모임.
 *
 * <h3>한 줄 목록이 카드가 됐습니다</h3>
 *
 * <p>「이름 · 인원 · 여행 수」 한 줄씩이라 모임이 둘이면 화면이 텅 비었습니다.
 * 모임마다 카드 한 장 — 누가 있나(얼굴과 이름), 다음 여행, 최근에 무슨 일이
 * 있었나, 최근 사진. 그 위에 가장 가까운 모임 여행 하나, 아래에 사람을 부르고
 * 초대받는 자리를 둡니다. 모임이 둘이어도 한 화면이 찹니다.
 *
 * <h3>여행은 모임이 아니라 사람</h3>
 *
 * <p>여행은 일이고 모임은 사람입니다. 그래서 카드의 첫 줄은 얼굴입니다 —
 * 「2명」이라는 숫자로는 누구와의 모임인지 안 보입니다.
 *
 * <h3>만들기는 제목 오른쪽 +</h3>
 *
 * <p>갈래 화면에는 아래 띠가 이미 서 있어 그 위에 단추 판을 또 얹으면 목록이
 * 설 자리가 줄어듭니다. 비었을 때만 빈자리 아래에 채운 단추를 세웁니다.
 */
export default function Groups() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const { data, error, loading, reload } = useAsync<{ groups: GroupCard[] }>(
    (signal) => api.get('/api/groups', signal),
    [],
  );
  /* 다가오는 모임 여행과, 모임마다 다음 여행. 목록이 날짜와 모임 번호를 이미 줍니다. */
  const trips = useAsync<{ trips: TripSummary[] }>((signal) => api.get('/api/trips', signal), []);

  const groups = data?.groups ?? [];
  const blank = data != null && groups.length === 0;

  /** 모임 번호 → 그 모임의 다음 여행(여행 중이거나 다가오는 것 중 가장 이른 것). */
  const nextOf = useMemo(() => {
    const out = new Map<string, { trip: TripSummary; at: Countdown }>();
    const rows = (trips.data?.trips ?? [])
      .filter((t) => t.groupId != null)
      .map((trip) => ({ trip, at: countdownOf(trip.startIso, trip.endIso) }))
      .filter((r): r is { trip: TripSummary; at: Countdown } => r.at != null)
      .sort((a, b) => (a.trip.startIso ?? '').localeCompare(b.trip.startIso ?? ''));
    for (const r of rows) {
      if (!out.has(r.trip.groupId as string)) {
        out.set(r.trip.groupId as string, r);
      }
    }
    return out;
  }, [trips.data]);

  /* 맨 위 배너 — 모든 모임 여행 중 가장 가까운 것 하나. */
  const soonest = useMemo(
    () =>
      [...nextOf.values()].sort((a, b) =>
        (a.trip.startIso ?? '').localeCompare(b.trip.startIso ?? ''),
      )[0] ?? null,
    [nextOf],
  );

  return (
    <Screen
      safeTop
      tabs={<AppTabs />}
      /*
        맨 윗줄 — 새 모임 만들기.

        <h3>이름을 걷었습니다</h3>

        <p>「모임」이라고 큰 제목으로 적고 있었습니다. 그런데 지금 어디인지는
        <b>아래 갈래 띠가 이미 말합니다</b> — 「모임」 칸이 채워져 있는 채로
        위에 같은 말이 한 번 더 적혀 있었습니다.

        <p>다른 갈래 화면은 걷어낸 자리에 찾는 칸을 올렸는데, 여기는 올릴
        것이 없습니다 — 모임은 대개 몇 개뿐이라 찾을 것도 거를 것도 없습니다.
        단추만 줄 끝에 남습니다.

        <p>줄 높이는 {@link ScreenTop} 이 44 로 못박습니다. 전에는 모임이
        하나도 없으면 단추가 사라져 윗줄이 32 로 내려앉았고, 첫 모임을 만드는
        순간 화면이 한 번 들썩였습니다.
      */
      header={
        <ScreenTop
          right={
            blank ? null : (
              <IconButton name="plus" label="새 모임 만들기" bare onPress={() => setCreating(true)} />
            )
          }
        />
      }>
      <Stack.Screen options={{ headerShown: false }} />

      {/*
        처음 받는 동안 — 카드가 올 자리를 미리 세웁니다.

        <p>{@link Loading} 이 섰습니다. 모임이 둘뿐인 화면에서도 점 셋이 한 번
        돌고 나서 카드가 들어서니, 들어올 때마다 화면이 비었다 찼습니다.

        <p>둘입니다. 모임은 대개 하나나 둘이고, 넷을 세우면 받아 보니 하나인
        날에 화면이 거꾸로 짧아집니다 — 없던 것을 약속하는 자리입니다.

        <p>{@link Skeleton} 의 칸은 카드의 <b>첫 줄</b>(표식과 이름)만큼입니다.
        카드는 얼굴 줄과 소식 줄까지 더 깊어서 자리를 다 잡아 주지는
        못합니다 — 그 모양까지 맞추려면 카드 꼴의 칸이 따로 있어야 하고,
        그것은 {@link Skeleton} 쪽에서 낼 일입니다. 그래도 바닥에서 솟는
        것보다는 위에서 자라는 쪽이 눈에 덜 걸립니다.
      */}
      {loading && !data ? <Skeleton rows={2} /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {/*
        다가오는 일정.

        <p>모임 화면을 여는 가장 흔한 까닭이 「다음에 언제 가지」입니다. 모임
        카드 안에도 다음 여행이 있지만, 여러 모임 가운데 가장 가까운 하나는
        카드들을 훑지 않아도 맨 위에서 보여야 합니다.
      */}
      {soonest ? (
        <Press
          onPress={() => router.push({ pathname: '/trip/[id]', params: { id: soonest.trip.id } })}
          scale={0.99}
          accessibilityLabel={`${soonest.trip.title} 열기`}
          style={styles.banner}>
          <Grow gap={2}>
            <Caption tone="secondary" numberOfLines={1}>
              {soonest.trip.groupName ?? '모임'} · 다가오는 일정
            </Caption>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {soonest.trip.title}
            </Text>
            <Caption tone="secondary">{formatSpan(soonest.trip.startIso, soonest.trip.endIso)}</Caption>
          </Grow>
          <CountdownBadge at={soonest.at} />
        </Press>
      ) : null}

      {blank ? (
        <View style={styles.blank}>
          <Mark icon="users" />
          <Body strong>함께 여행할 사람들을 모아 보세요</Body>
          <Caption tone="secondary">
            모임을 만들면 그 안에서 짠 여행을 모두 함께 봐요.{'\n'}일정 · 가계부 · 가고 싶은 곳
            투표를 같이 써요.{'\n'}부르는 것은 링크 하나면 돼요.
          </Caption>
          <Button label="새 모임 만들기" onPress={() => setCreating(true)} />
        </View>
      ) : null}

      {groups.map((g) => (
        <GroupCardView
          key={g.id}
          group={g}
          next={nextOf.get(g.id) ?? null}
          onOpen={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
          onTrip={(id) => router.push({ pathname: '/trip/[id]', params: { id } })}
        />
      ))}

      {/*
        사람을 부르고, 초대받는 자리.

        <p>초대 링크를 만드는 자리는 모임 안(사람들 판)에 있었고, 받은 링크로
        들어가는 길은 링크를 누르는 것뿐이었습니다. 메신저로 받은 링크를 앱
        안에서 붙여 넣을 곳이 없었습니다.

        <p>이 자리는 카드마다 있는 단추가 아니라 <b>목록 아래 한 자리</b>라,
        어느 모임에 부르는지를 여기서 골라야 합니다. 그래서 모임 전체를
        넘깁니다 — 첫 모임 번호만 넘기던 때에는 카드가 고를 수 없어서 맨 앞
        모임으로 그냥 들어갔습니다.
      */}
      {data ? (
        <InviteCard
          groups={groups}
          onInvite={(id) => router.push({ pathname: '/group/[id]', params: { id, invite: '1' } })}
          onJoin={(token) => router.push({ pathname: '/invite/[token]', params: { token } })}
        />
      ) : null}

      <GroupForm
        visible={creating}
        onClose={() => setCreating(false)}
        onDone={(made) => {
          setCreating(false);
          router.push({ pathname: '/group/[id]', params: { id: made.id, invite: '1' } });
        }}
      />
    </Screen>
  );
}

/**
 * 모임 카드 한 장.
 *
 * <p>목록 카드라 모서리 12(plan-review Q1). 흰 바탕에 테두리 — 바닥이 흰
 * 종이라 테두리가 없으면 어디까지가 한 모임인지 안 보입니다.
 */
function GroupCardView({
  group,
  next,
  onOpen,
  onTrip,
}: {
  group: GroupCard;
  next: { trip: TripSummary; at: Countdown } | null;
  onOpen: () => void;
  onTrip: (tripId: string) => void;
}) {
  const faces = group.faces ?? [];
  const names = faces.map((f) => f.name).join(', ');
  const more = group.memberCount - faces.length;

  return (
    <View style={styles.card}>
      <Press onPress={onOpen} scale={0.99} accessibilityLabel={`${group.name} 열기`} style={styles.cardOpen}>
        <Row gap={Spacing.s3}>
          <Mark emoji={group.emoji ?? '🧳'} />
          <Grow>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {group.name}
            </Text>
          </Grow>
          {/* 새 소식 점. 숫자는 안 씁니다 — 「들어가 볼 것이 있다」면 됩니다. */}
          {group.fresh ? <View style={styles.dot} accessibilityLabel="새 소식" /> : null}
          <Icon name="chevron-right" size={18} tone="muted" />
        </Row>

        {/* 누가 있나 — 얼굴을 겹치고 이름을 적습니다. 「2명」으로는 누구와의
            모임인지 안 보입니다. */}
        <Row gap={Spacing.s2}>
          <Row>
            {faces.map((f, i) => (
              <View key={i} style={[styles.face, i > 0 ? styles.faceOver : null]}>
                <Text style={styles.faceText}>{faceOf(f.mark ?? null, f.name)}</Text>
              </View>
            ))}
          </Row>
          <Caption tone="secondary" numberOfLines={1}>
            {names}
            {more > 0 ? ` 외 ${more}명` : ''}
          </Caption>
        </Row>

        {group.activity ? (
          <Caption tone="muted" numberOfLines={1}>
            {group.activity.actorName} 님이{' '}
            {group.activity.kind === 'feed.post' ? '피드에 글을 올렸어요' : '모임에 들어왔어요'} ·{' '}
            {ago(group.activity.at)}
          </Caption>
        ) : null}

        {(group.photoIds ?? []).length > 0 ? (
          <Row gap={Spacing.s1}>
            {(group.photoIds ?? []).map((id) => (
              <OurPhoto key={id} id={id} width={72} height={72} style={styles.thumb} />
            ))}
          </Row>
        ) : null}
      </Press>

      {/* 다음 여행. 없으면 만들러 가는 길을 둡니다 — 모임 화면에서 만들면
          그 모임 것으로 만들어집니다. */}
      {next ? (
        <Press onPress={() => onTrip(next.trip.id)} scale={0.97} style={styles.nextChip}>
          <Icon name="calendar" size={16} tone="brand" />
          <Text style={styles.nextText} numberOfLines={1}>
            {next.trip.title}
          </Text>
          <CountdownBadge at={next.at} />
        </Press>
      ) : (
        <Press onPress={onOpen} scale={0.97} style={styles.nextChip}>
          <Caption tone="secondary">아직 여행이 없어요 · </Caption>
          <Caption tone="brand" strong>
            여행 만들기
          </Caption>
        </Press>
      )}
    </View>
  );
}

/**
 * 초대 카드 — 부르기와, 받은 링크 붙여 넣기.
 *
 * <p>받은 것은 링크 통째로 붙여 넣어도 되고 끝의 코드만 넣어도 됩니다. 링크의
 * 마지막 조각을 꺼내 초대 화면으로 보냅니다 — 어떤 모양으로 받았는지 사람이
 * 가릴 일이 아닙니다.
 *
 * <h3>어느 모임에 부를지는 사람이 고릅니다</h3>
 *
 * <p>이 카드는 모임 줄마다 달린 단추가 아니라 목록 아래 한 자리입니다. 그래서
 * 맨 앞 모임을 몰래 집어 그 모임의 사람들 판을 열고 있었습니다 — 모임이 둘만
 * 돼도 <b>내가 고르지 않은 모임</b>에 부르는 링크를 만들게 됩니다. 모임이
 * 여럿이면 판을 띄워 묻습니다.
 *
 * <p>모임이 하나일 때는 그냥 갑니다. 고를 것이 하나뿐인 판은 묻는 일이 아니라
 * 한 번 더 누르게 하는 일입니다. 모임이 없으면 부를 자리가 없어 단추 자체를
 * 안 냅니다.
 */
function InviteCard({
  groups,
  onInvite,
  onJoin,
}: {
  /** 내 모임들. 부를 모임을 이 안에서 고릅니다. */
  groups: GroupCard[];
  onInvite: (groupId: string) => void;
  onJoin: (token: string) => void;
}) {
  const [code, setCode] = useState('');
  const [picking, setPicking] = useState(false);
  const token = code.trim().split(/[/?#]/).filter(Boolean).pop() ?? '';

  return (
    <View style={styles.invite}>
      {groups.length > 0 ? (
        <>
          <Body strong>친구를 불러 같이 짜 보세요</Body>
          <Caption tone="secondary">링크 하나를 보내면 바로 들어와요.</Caption>
          <Button
            label="초대 링크 만들기"
            variant="secondary"
            onPress={() => (groups.length === 1 ? onInvite(groups[0].id) : setPicking(true))}
          />
        </>
      ) : null}
      <Field
        label="초대받았어요"
        value={code}
        onChangeText={setCode}
        placeholder="받은 초대 링크나 코드"
        autoCapitalize="none"
        returnKeyType="go"
        onSubmitEditing={() => (token ? onJoin(token) : undefined)}
        action={{ icon: 'chevron-right', label: '초대로 들어가기', disabled: !token, onPress: () => onJoin(token) }}
      />

      {/* 고르면 바로 그 모임의 사람들 판으로 갑니다 — 고른 뒤에 「다음」을 또
          누를 일이 없어 판에 바닥 단추를 안 둡니다. */}
      <BottomSheet visible={picking} title="어느 모임에 부를까요?" onClose={() => setPicking(false)}>
        <Caption tone="secondary">링크는 고른 모임 하나에만 써요.</Caption>
        {groups.map((g, i) => (
          <ListRow
            key={g.id}
            left={<Mark emoji={g.emoji ?? '🧳'} />}
            title={g.name}
            subtitle={`${g.memberCount}명`}
            last={i === groups.length - 1}
            onPress={() => {
              setPicking(false);
              onInvite(g.id);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

/** 「3시간 전」. 소식함과 같은 말씨입니다. */
function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) {
    return '방금';
  }
  if (min < 60) {
    return `${min}분 전`;
  }
  const h = Math.floor(min / 60);
  if (h < 24) {
    return `${h}시간 전`;
  }
  return `${Math.floor(h / 24)}일 전`;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    padding: Spacing.s4,
    borderRadius: 16,
    backgroundColor: Colors.accentSoft,
  },
  bannerTitle: {
    ...Type.headline,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  blank: {
    alignItems: 'center',
    gap: Spacing.s3,
    paddingVertical: Spacing.s6,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.s4,
    gap: Spacing.s3,
  },
  cardOpen: {
    gap: Spacing.s2,
  },
  cardTitle: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.danger,
  },
  face: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOver: {
    marginLeft: -8,
  },
  faceText: {
    fontSize: 13,
  },
  thumb: {
    borderRadius: Radius.r2,
  },
  nextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.s2,
    paddingHorizontal: Spacing.s3,
    borderRadius: Radius.full,
    backgroundColor: Colors.fill,
  },
  nextText: {
    ...Type.caption,
    fontWeight: Weight.semibold,
    color: Colors.text,
    flexShrink: 1,
  },
  invite: {
    gap: Spacing.s2,
    padding: Spacing.s4,
    borderRadius: 12,
    backgroundColor: Colors.fill,
  },
});
