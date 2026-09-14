import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { News, Place, TripDetail, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import type { Countdown } from '@/lib/countdown';
import { countdownIsNear, countdownLabel, countdownOf, todayIso } from '@/lib/countdown';
import {
  Badge,
  Button,
  Caption,
  Card,
  IconButton,
  MenuCard,
  Press,
  Rise,
  Row,
  Screen,
  Subtitle,
  Title,
} from '@/ui';
import { LogoMark } from '@/ui/logo';

/**
 * 첫 화면.
 *
 * <p>할 수 있는 일을 카드로 늘어놓습니다. 메뉴를 숨겨 두면 있는 줄도 모르고
 * 지나갑니다.
 *
 * <p>한때는 아직 만들지 않은 것도 "준비 중" 으로 함께 두었습니다. 지금은
 * 하나도 없습니다 — 지도와 동행자는 여행 안에서 이미 되는데도 자리
 * 채우기로 남아, 되는 것을 안 된다고 말하고 있었습니다. 다시 붙일 일이
 * 생기면 정말 없는 것에만 붙입니다.
 *
 * <p>메뉴 아래에는 지금 이 사람에게 맞는 줄 하나가 옵니다. 여행이 하나도
 * 없으면 어디서 시작하는지를, 다가올 여행이 있으면 며칠 남았는지를
 * 말합니다. 둘은 함께 뜨지 않습니다 — 여행이 없으면 셀 날도 없습니다.
 */
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  /* 여행이 하나도 없는 사람에게는 메뉴만으로 부족합니다. 그 판단에 필요한
     것이 개수 하나뿐이라 목록을 그대로 받아 씁니다. */
  const { data: mine } = useAsync<{ trips: TripSummary[] }>(
    (signal) => api.get('/api/trips', signal),
    [],
  );

  /*
    소식이 와 있는지.

    숫자는 안 씁니다. 점 하나면 "들어가 볼 것이 있다" 는 말이 되고, 몇
    건인지는 열기 전에 할 일이 아닙니다.

    못 받아 와도 조용히 넘어갑니다 — 첫 화면이 소식 때문에 멈추면, 소식이
    없는 사람에게도 앱이 느려집니다.
  */
  const { data: news } = useAsync<News>((signal) => api.get('/api/news', signal), []);


  /*
    가장 가까운 여행 하나.

    사람들은 여행 전에 날짜를 셉니다. 앱이 없어도 하는 행동이라, 그 답이
    첫 화면에 있으면 그것만으로 열어 볼 이유가 됩니다. 목록에는 이미
    있었지만(trips.tsx) 여기까지 오려면 한 단 더 들어가야 했습니다.

    하나만 답니다. 둘 이상을 세로로 늘어놓으면 그것은 목록이고, 목록은
    「내 여행」 이 이미 하는 일입니다.

    시작일이 이른 것부터 봅니다 — 이미 떠난 여행이 아직 안 떠난 것보다
    앞서므로, 여행 중인 것이 저절로 먼저 잡힙니다.
  */
  const next = useMemo(() => {
    const rows = (mine?.trips ?? [])
      .map((trip) => ({ trip, at: countdownOf(trip.startIso, trip.endIso) }))
      .filter((row): row is { trip: TripSummary; at: Countdown } => row.at !== null);
    rows.sort((a, b) => (a.trip.startIso ?? '').localeCompare(b.trip.startIso ?? ''));
    return rows[0] ?? null;
  }, [mine]);

  /*
    길 위에 있으면 오늘이 어떻게 돼 가는지.

    <p>여행 중일 때만 한 번 더 부릅니다. 목록(`/api/trips`)에는 장소가 없고,
    여행 중인 사람은 하루에 여러 번 여는데 그때 알고 싶은 것이 정확히
    "다음 어디" 입니다. 여행 중이 아니면 한 번도 안 부릅니다.

    <p>실패해도 조용히 넘어갑니다. 이것 때문에 홈이 멈추면 여행 안 가는
    사람까지 느려집니다.
  */
  const goingId = next?.at.kind === 'going' ? next.trip.id : null;
  const { data: today } = useAsync<TripDetail | null>(
    (signal) =>
      goingId
        ? api.get(`/api/trip?trip=${encodeURIComponent(goingId)}`, signal)
        : Promise.resolve(null),
    [goingId],
  );

  /*
    오늘 남은 것.

    <p>여기서 세는 것은 <b>오늘 하루</b>입니다. 여행 전체의 진행률이 아닙니다 —
    길 위에서 궁금한 것은 "앞으로 며칠 남았나" 가 아니라 "이따 어디 가나"
    입니다.

    <p>오늘 날짜에 해당하는 날이 없으면(여행 사이에 빈 날) 비웁니다. 그때는
    카드가 지금까지처럼 제목만 말합니다.
  */
  const road = useMemo(() => {
    if (!today) {
      return null;
    }
    const iso = todayIso();
    const day = today.days.find((d) => d.iso === iso) ?? null;
    if (!day || day.places.length === 0) {
      return null;
    }
    const stamped = new Set(today.visited);
    const left = day.places.filter((p) => !stamped.has(p.id));
    return { next: left[0] ?? null, left: left.length, total: day.places.length };
  }, [today]);

  return (
    <Screen safeTop>
      <View style={styles.head}>
        <Row style={styles.headTop}>
          <LogoMark size={26} />
          {/* 오른쪽 위에 둘입니다.

              소식을 메뉴 카드로 만들면 넷이 다섯이 되어 2열 배치가
              흐트러집니다. 그리고 카드는 "들어가서 할 일" 인데 소식은
              "와 있는지 보는 것" 이라 성격이 다릅니다 — 점이 없으면 누를
              이유도 없습니다.

              계정 설정은 늘 같은 자리에 둡니다. 메뉴 사이에 끼워 두면
              쓸 일이 드문 것이 자주 쓰는 것들과 자리를 다툽니다. */}
          <Row gap={0}>
            <IconButton
              name="bell"
              label={news?.unseen ? `소식 ${news.unseen}건` : '소식'}
              dot={!!news?.unseen}
              onPress={() => router.push('/(app)/news')}
            />
            <IconButton
              name="settings"
              label="내 계정"
              onPress={() => router.push('/(app)/settings')}
            />
          </Row>
        </Row>
        {/* 이름을 강조색으로 떼어 놓습니다. 한 덩어리로 두면 인사말이 그냥
            문장 하나로 흘러갑니다.

            색만 다르고 크기는 같습니다. 작게 두었더니 정작 사람 이름이
            인사말보다 작아 곁다리처럼 보였습니다. */}
        <Title>
          {user?.name ? (
            <>
              <Title tone="accent">{user.name}</Title>
              {' 님, 어디로 떠나 볼까요?'}
            </>
          ) : (
            '어디로 떠나 볼까요?'
          )}
        </Title>
      </View>

      {/* 카드가 한 번에 툭 나타나면 화면이 갈아 끼워진 것처럼 보입니다.
          위에서부터 조금씩 늦게 떠오르면 눈이 따라 내려갑니다. */}
      <Row gap={Spacing.md} style={styles.grid}>
        <Rise order={0} style={styles.half}>
          <MenuCard
            title="내 여행"
            caption="짜고, 부르고, 같이 고치기"
            onPress={() => router.push('/(app)/trips')}
          />
        </Rise>
        <Rise order={1} style={styles.half}>
          <MenuCard
            title="보석함"
            caption="주워 둔 곳들"
            onPress={() => router.push('/(app)/saved')}
          />
        </Rise>
        <Rise order={2} style={styles.half}>
          <MenuCard
            title="여행 둘러보기"
            caption="남이 다녀온 길 구경하기"
            onPress={() => router.push('/community')}
          />
        </Rise>
        {/* 가계부는 여행 하나에 딸립니다. 먼저 어느 여행인지를 고르고,
            고르면 곧장 그 여행의 가계부로 갑니다 — 일정 화면을 거치지
            않습니다. */}
        <Rise order={3} style={styles.half}>
          <MenuCard
            title="가계부"
            caption="누가 얼마 냈는지"
            onPress={() => router.push('/(app)/trips?for=money')}
          />
        </Rise>
        {user?.role === 'ADMIN' ? (
          <Rise order={4} style={styles.wide}>
            <MenuCard
              title="운영"
              caption="계정 관리·감사 로그"
              wide
              onPress={() => router.push('/admin')}
            />
          </Rise>
        ) : null}
      </Row>

      {/*
        갓 가입한 사람의 홈은 텅 비어 있습니다. 메뉴 넷이 있지만 무엇부터
        눌러야 하는지는 말해 주지 않습니다.

        아래에 둡니다. 위에 두면 목록을 받아 온 순간 메뉴가 아래로 밀려
        내려가, 이미 손이 가 있던 카드가 달아납니다.

        여행 수를 서버에 따로 표시해 두지 않습니다. 개수가 0인지로 그냥
        알 수 있고, 표시를 만들면 그때부터 그 값이 진짜와 어긋납니다.
        덤으로 여행을 다 지운 사람에게도 맞는 안내가 됩니다.
      */}
      {mine && mine.trips.length === 0 ? <FirstSteps /> : null}
      {next ? <NextTrip trip={next.trip} at={next.at} road={road} /> : null}
    </Screen>
  );
}

/**
 * 다음 여행까지 며칠 — 그리고 길 위에 있으면, 지금 어떻게 돼 가는지.
 *
 * <p>세는 일은 <code>lib/countdown</code> 이 합니다. 여행 목록의 뱃지와
 * 같은 답을 써야 해서입니다 — 두 화면이 다른 날짜를 말하면 어느 쪽이
 * 맞는지 알 수 없습니다.
 *
 * <h3>여행이 시작되면 가는 곳이 달라집니다</h3>
 *
 * <p>전에는 이 줄이 "지금 그 길 위" 라고 <b>적어 놓고</b> 일정을 짜는
 * 화면을 열었습니다. 앱이 길 위인 것을 알면서 짜는 도구를 내민 셈입니다.
 *
 * <p>길 위에서 보라고 만든 화면이 이미 있습니다 —
 * <code>travel/[id].tsx</code>, 스탬프첩입니다. 지금 갈 곳 하나만 크게
 * 놓고 길찾기와 다녀옴만 남깁니다. 여행 중에는 그쪽을 엽니다.
 *
 * <p><b>짜는 화면을 막지는 않습니다.</b> 길 위에서도 일정은 고칩니다 — 비가
 * 와서 하나 빼는 일이 실제로 벌어집니다. 스탬프첩 오른쪽 위에 "일정 전체"
 * 가 늘 있습니다. 바뀌는 것은 <b>무엇이 먼저 열리는가</b>뿐입니다.
 *
 * @param road 오늘 남은 것. 여행 중이 아니거나 오늘에 해당하는 날이 없으면
 *             비어 있고, 그때는 지금까지처럼 제목만 말합니다
 */
function NextTrip({
  trip,
  at,
  road,
}: {
  trip: TripSummary;
  at: Countdown;
  road: { next: Place | null; left: number; total: number } | null;
}) {
  const router = useRouter();
  const going = at.kind === 'going';

  /* 길 위에서 궁금한 것은 "이따 어디 가나" 한 줄입니다. 다 찍었으면 그것도
     말해 줍니다 — 남은 것이 없다는 것도 답입니다. */
  const line = !road
    ? null
    : road.next
      ? `다음 · ${road.next.name}`
      : `오늘 ${road.total}곳 다 찍었습니다`;

  return (
    <Rise order={5}>
      <Press
        onPress={() =>
          going
            ? router.push({ pathname: '/travel/[id]', params: { id: trip.id } })
            : router.push(`/trip/${trip.id}`)
        }
        accessibilityLabel={`${trip.title} — ${countdownLabel(at)}${line ? `, ${line}` : ''}`}>
        <Card>
          <Row style={styles.nextRow}>
            <View style={styles.grow}>
              {/* 무엇에 대한 줄인지 먼저 말합니다. 제목만 있으면 이것이
                  다음 여행인지 방금 본 여행인지 알 수 없습니다. */}
              <Caption tone="secondary">{going ? '지금 그 길 위' : '다음 여행'}</Caption>
              <Subtitle>{trip.title}</Subtitle>
              {/* 아직 안 받아 왔으면 아무 줄도 안 둡니다. 자리만 잡아 두면
                  카드가 한 번 흔들립니다. */}
              {line ? <Caption>{line}</Caption> : null}
            </View>
            <Badge
              label={going && road ? `${road.left}곳 남음` : countdownLabel(at)}
              tone={going ? 'success' : countdownIsNear(at) ? 'accent' : 'muted'}
            />
          </Row>
        </Card>
      </Press>
    </Rise>
  );
}

/** 아직 아무것도 없는 사람에게, 어디서 시작하는지. */
function FirstSteps() {
  const router = useRouter();

  return (
    <Rise order={5}>
      <Card>
        <Subtitle>어디서 시작할까요?</Subtitle>

        <Row gap={Spacing.sm} style={styles.steps}>
          <View style={styles.grow}>
            <Button
              label="첫 여행 만들기"
              onPress={() => router.push('/(app)/trips?new=1')}
            />
          </View>
          <View style={styles.grow}>
            <Button
              label="남의 길 구경하기"
              variant="secondary"
              onPress={() => router.push('/community')}
            />
          </View>
        </Row>
      </Card>
    </Rise>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.md,
  },
  headTop: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grid: {
    alignItems: 'stretch',
  },
  /* 감싸는 층이 하나 늘었으므로 넓이를 여기서 잡습니다. 안쪽 카드는 이
     자리를 꽉 채웁니다. */
  half: {
    flexGrow: 1,
    flexBasis: '46%',
  },
  wide: {
    width: '100%',
  },
  steps: {
    flexWrap: 'nowrap',
  },
  nextRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
});
