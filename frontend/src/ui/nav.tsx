import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Colors, Spacing, Type, Weight } from '@/constants/theme';
import { IconButton, Row } from '@/ui';

/**
 * 위 막대 왼쪽에 서는 것들.
 *
 * <h3>왜 집으로 가는 단추가 따로 필요한가</h3>
 *
 * <p>화살표는 한 걸음씩만 물러납니다. 여행 → 일정 → 여행 카드 → 댓글까지
 * 들어갔다가 처음으로 돌아가려면 네 번을 눌러야 했습니다. 폰에서는 그
 * 네 번이 꽤 깁니다.
 *
 * <p>집 그림 하나면 어디서든 한 번입니다. 화살표 바로 옆에 둡니다 — 둘 다
 * "돌아가는" 일이라 한자리에 모여 있는 편이 찾기 쉽습니다.
 *
 * <h3>돌아갈 데가 없을 때</h3>
 *
 * <p>주소를 새로고침하거나 링크로 곧장 들어오면 밑에 쌓인 것이 없어 화살표가
 * 아무 데도 데려가지 못합니다. 그때는 이 화면이 속한 자리로 돌려보냅니다 —
 * 여행에 딸린 화면이면 그 일정으로, 아니면 처음으로.
 *
 * <h3>"처음" 은 사람마다 다릅니다</h3>
 *
 * <p>둘러보기는 계정 없이도 열립니다. 그런데 집 그림이 늘 /(app)/home 을
 * 가리키면, 구경하던 사람이 그것을 누르는 순간 로그인 화면이 뜹니다.
 * 방금 없앤 막다른 길이 헤더에 그대로 남아 있는 셈입니다.
 *
 * <p>로그인하지 않았으면 문(welcome)으로 보냅니다. 거기에는 다시
 * 둘러보기로 들어가는 길과 로그인 단추가 함께 있습니다.
 */
export function NavLeft({
  navigation,
  route,
  /** 돌아갈 데가 없을 때 이 화면이 딸린 여행의 일정으로 보낼지. */
  toTrip = false,
}: {
  navigation: { canGoBack: () => boolean; goBack: () => void };
  route?: { params?: object };
  toTrip?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const params = route?.params as { id?: unknown } | undefined;
  const tripId = typeof params?.id === 'string' ? params.id : null;

  /** 이 사람에게 "처음" 은 어디인가. */
  const start = user ? '/(app)/home' : '/(auth)/welcome';

  function back() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (toTrip && tripId) {
      router.replace({ pathname: '/trip/[id]', params: { id: tripId } });
      return;
    }
    /* 계정이 없는 사람을 내 여행으로 보내면 로그인 화면이 뜹니다. */
    router.replace(user ? '/(app)/trips' : '/(auth)/welcome');
  }

  return (
    <Row gap={Spacing.xs}>
      <IconButton name="chevron-left" label="뒤로" bare onPress={back} />
      <IconButton name="home" label="처음으로" bare onPress={() => router.replace(start)} />
    </Row>
  );
}

/**
 * 어디에서 들어온 화면인지를 제목 위에 적습니다.
 *
 * <h3>제목만으로는 어디인지 몰랐습니다</h3>
 *
 * <p>일정·여행 중·가계부·요약이 모두 <b>여행 이름</b>을 제목으로 달고
 * 있었습니다. 「도쿄 여행」 이라고만 적혀 있으니 지금 보고 있는 것이 일정인지
 * 가계부인지는 화면 안을 봐야 알았고, 네 화면을 오가면 막대는 한 번도 안
 * 바뀌었습니다.
 *
 * <p>위에 작게 온 곳을, 아래에 굵게 지금을 적습니다. 두 줄이지만 위쪽은
 * 아주 작아서 막대가 높아지지 않습니다.
 */
export function PathTitle({ parent, title }: { parent: string; title: string }) {
  return (
    <View style={pathStyles.wrap}>
      <Text style={pathStyles.parent} numberOfLines={1}>
        {parent}
      </Text>
      <Text style={pathStyles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const pathStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    /* 막대 가운데에 섭니다. 좌우에 단추가 서므로 그만큼 비켜 둡니다. */
    maxWidth: 220,
  },
  parent: {
    ...Type.caption,
    fontSize: 11,
    color: Colors.textMuted,
  },
  title: {
    ...Type.body,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
});

/**
 * 스택 화면 하나의 위 막대.
 *
 * <p>화살표를 직접 그립니다. 네비게이션이 만들어 주는 것을 쓰면 그 옆에
 * 무언가를 나란히 둘 수가 없습니다.
 */
export function stackHeader(title: string, opts?: { toTrip?: boolean; parent?: string }) {
  return ({
    navigation,
    route,
  }: {
    navigation: { canGoBack: () => boolean; goBack: () => void };
    route?: { params?: object };
  }) => ({
    title,
    /* 온 곳이 있으면 제목 위에 적습니다. 없으면 지금까지처럼 한 줄입니다. */
    headerTitle: opts?.parent
      ? () => <PathTitle parent={opts.parent as string} title={title} />
      : undefined,
    headerLeft: () => <NavLeft navigation={navigation} route={route} toTrip={opts?.toTrip} />,
  });
}
