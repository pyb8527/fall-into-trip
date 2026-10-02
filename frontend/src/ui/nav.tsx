import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Colors, Spacing, Tap, Type, Weight } from '@/constants/theme';
import { IconButton, Row } from '@/ui';
import { SidebarWidth } from '@/ui/layout';

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
 * 아무 데도 데려가지 못합니다. 그때는 이 화면이 속한 자리로 돌려보냅니다.
 *
 * <p>그 자리를 <b>한 군데로 못박아 두고 있었습니다</b> — 「내 여행」이었습니다.
 * 그래서 여행기를 읽다가 뒤로를 누르면 둘러보기가 아니라 내 여행 목록이
 * 떴고, 보석함에서도 운영 화면에서도 마찬가지였습니다. 어디에 있었든 한
 * 군데로 튀니까 <b>처음으로 밀려난 것처럼</b> 느껴집니다.
 *
 * <p>화면마다 위층을 적어 줍니다(stackHeader 의 up). 여행에 딸린 화면이면
 * 그 여행의 일정, 여행기면 둘러보기, 운영 화면이면 운영 첫 장입니다. 안
 * 적으면 처음(홈)입니다.
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
  /**
   * 돌아갈 데가 없을 때 갈 위층.
   *
   * <p>안 주면 처음(홈)입니다. toTrip 이 있으면 그쪽이 먼저입니다 — 여행에
   * 딸린 화면의 위층은 늘 그 여행입니다.
   */
  up,
  /**
   * 이 화면 왼쪽에 기둥(사이드바)이 서 있는지.
   *
   * <h3>화살표가 기둥 뒤에 깔렸습니다</h3>
   *
   * <p>넓은 화면에서 갈래가 왼쪽 기둥으로 섭니다(ui/tab-bar). 기둥은 창에
   * 붙어 떠 있어서 <b>위 막대까지 덮습니다.</b> 막대는 화면 폭을 다 쓰고
   * 그 왼쪽 끝에 화살표가 있으니, 뒤로가기가 기둥 밑으로 들어가 눌리지
   * 않았습니다.
   *
   * <p>기둥만큼 비켜 앉습니다. 본문이 이미 같은 만큼 비켜 있으므로(각
   * 화면의 contentStyle), 화살표도 본문과 같은 선에서 시작합니다.
   */
  rail = false,
}: {
  navigation: { canGoBack: () => boolean; goBack: () => void };
  route?: { params?: object };
  toTrip?: boolean;
  up?: string;
  rail?: boolean;
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
    /* 계정이 없는 사람을 로그인 뒤에만 열리는 곳으로 보내면 로그인 화면이
       뜹니다. 그럴 때는 문으로 보냅니다 — 둘러보기는 계정 없이도 열립니다. */
    if (up && (user || up === '/community')) {
      router.replace(up as never);
      return;
    }
    router.replace(user ? '/(app)/home' : '/(auth)/welcome');
  }

  /*
    뒤로 하나만 섭니다.

    <h3>집 그림이 자리를 먹고 있었습니다</h3>

    <p>뒤로와 「처음으로」 둘이 나란히 섰습니다. 그런데 처음으로 가는 길은
    <b>아래 갈래 띠의 「홈」</b>이 이미 가지고 있습니다 — 같은 일을 하는
    길이 한 화면에 둘이면, 둘 중 어느 것이 맞는지 한 번 생각하게 됩니다.

    <p>무엇보다 막대 왼쪽을 88 이나 먹었습니다. 그 바람에 가운데 제목이
    좁아져서, 여행 이름이 긴 것은 한두 글자만 남고 말줄임이 됐습니다.
  */
  return (
    <Row gap={Spacing.s1} style={rail ? navStyles.railGap : null}>
      <IconButton name="chevron-left" label="뒤로" onPress={back} />
    </Row>
  );
}

/**
 * 화면이 스스로 세우는 맨 윗줄.
 *
 * <h3>돋보기가 있는 화면만 높이가 달랐습니다</h3>
 *
 * <p>줄 높이를 화면마다 <b>그 안에 든 것</b>이 정하고 있었습니다. 큰 제목
 * 하나면 글줄 높이 32 고, 오른쪽에 그림 단추가 서면 {@link Tap.min} 44 입니다.
 * 그래서 「내 여행」은 여행이 넷을 넘는 순간 — 그때 돋보기가 생깁니다 — 윗줄이
 * 12 자랐고, 「모임」은 모임이 하나도 없을 때만 12 낮았습니다. 같은 갈래
 * 띠로 오가는데 윗줄이 화면마다, 심지어 같은 화면에서도 위아래로 뛰었습니다.
 *
 * <p>높이를 여기 한 자리에서 못박습니다. 44 입니다 — 지금 가장 높은 꼴(그림
 * 단추가 선 줄)이고, {@code SearchField} 의 칸도 같은 44 라 <b>돋보기가 있든
 * 없든, 검색칸이 섰든 안 섰든</b> 줄은 같은 높이입니다.
 *
 * <p>한 번 세운 화면은 <b>안에 둘 것이 없는 날에도</b> 그대로 세웁니다.
 * 「내 여행」의 찾는 칸은 여행이 넷 아래면 안 나오는데, 그때 줄째 걷으면 이
 * 화면만 첫 줄이 위로 올라붙고 다섯째 여행이 생기는 날 화면이 한 번
 * 들썩입니다. 애초에 윗줄이 아예 없는 화면(설정·내 페이지)은 {@code Screen}
 * 에 {@code header} 를 안 넘깁니다 — 그것은 높이가 어긋나는 것과 다릅니다.
 *
 * @param left  이 화면이 그 자리에서 실제로 필요한 것 — 검색칸, 고르는 칸,
 *              또는 홈의 로고. 남는 자리를 다 먹습니다
 * @param right 줄 끝에 붙는 동작. 제 크기만 씁니다
 */
export function ScreenTop({
  left,
  right,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={topStyles.row}>
      <View style={topStyles.lead}>{left}</View>
      {right}
    </View>
  );
}

const topStyles = StyleSheet.create({
  /* 높이는 못박습니다. minHeight 로 두면 안에 든 것이 다시 높이를 정하게
     되어, 고치려던 들쭉날쭉함이 그대로 돌아옵니다. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
    height: Tap.min,
  },
  /* 왼쪽이 늘어납니다. 검색칸이 한 줄을 다 쓰고 오른쪽 단추는 제 크기만
     쓰게 하려면 늘어나는 쪽이 왼쪽이어야 합니다. */
  lead: {
    flex: 1,
  },
});

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

const navStyles = StyleSheet.create({
  /* 기둥만큼 비켜 앉습니다. 막대는 창 왼쪽 끝에서 시작하므로, 그만큼
     밀어야 기둥 오른쪽에 섭니다. */
  railGap: {
    marginLeft: SidebarWidth,
  },
});

/*
  무엇이 크게 서야 하는가.

  <h3>뒤집었습니다</h3>

  <p>위에 작은 「도쿄 여행」, 아래에 큰 「가계부」였습니다. 네 화면이 모두
  여행 이름만 달고 있던 것을 고치려다 그렇게 됐는데, 이제 <b>어느 화면인지는
  아래 갈래 띠가 말합니다</b> — 여행 안에서는 일정·가계부·요약이 띠에 서고
  켜진 칸이 채워집니다. 막대가 그것을 한 번 더 적으면 같은 말이 두 번이고,
  그 두 번째가 더 크게 적혀 있었습니다.

  <p>막대가 말해야 하는 것은 <b>어느 여행인지</b>입니다. 여행 이름을 올리고
  화면 이름을 그 아래 작게 둡니다.

  <p>가운데 정렬도 걷습니다. 가운데에 두려면 좌우로 같은 자리를 비워 둬야
  해서 폭이 220 밖에 안 남았고, 긴 여행 이름이 거기서 잘렸습니다. 왼쪽
  글자선에 맞추면 단추 하나만큼만 비키면 됩니다.
*/
const pathStyles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    flexShrink: 1,
  },
  /* 여행 이름. 읽어야 하는 것입니다. */
  parent: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  /* 화면 이름. 아래 띠가 이미 말하고 있으므로 거드는 한 줄입니다. */
  title: {
    ...Type.caption,
    color: Colors.textMuted,
  },
});

/**
 * 스택 화면 하나의 위 막대.
 *
 * <p>화살표를 직접 그립니다. 네비게이션이 만들어 주는 것을 쓰면 그 옆에
 * 무언가를 나란히 둘 수가 없습니다.
 */
export function stackHeader(
  title: string,
  opts?: {
    toTrip?: boolean;
    parent?: string;
    /** 돌아갈 데가 없을 때 갈 위층. 안 주면 처음(홈)입니다. */
    up?: string;
    /**
     * 넓은 화면에서 이 화면 왼쪽에 기둥(사이드바)이 서는지.
     *
     * <p>기둥을 세우는 것은 화면 자신입니다(아래 갈래 띠를 다는 화면이
     * 넓은 화면에서는 기둥을 답니다). 그런데 기둥은 떠 있어서 자리를
     * 차지하지 못하므로, <b>비워 두는 일은 이 막대와 본문</b>이 합니다.
     *
     * <p>층을 짜는 쪽(각 _layout)이 {@code useWide()} 를 보고 넘겨 줍니다.
     * 여기서 직접 물을 수는 없습니다 — 이 함수가 돌려주는 것은 부품이
     * 아니라 설정 덩이라, 그 안에서 훅을 부를 자리가 없습니다.
     */
    rail?: boolean;
  },
) {
  return ({
    navigation,
    route,
  }: {
    navigation: { canGoBack: () => boolean; goBack: () => void };
    route?: { params?: object };
  }) => ({
    title,
    /* 기둥이 서면 본문이 그만큼 비켜 앉습니다. 안 비키면 왼쪽 20 선에 맞춰
       둔 글자들이 기둥 뒤로 들어갑니다. */
    contentStyle: opts?.rail
      ? { paddingLeft: SidebarWidth, backgroundColor: Colors.background }
      : undefined,
    /* 온 곳이 있으면 제목 위에 적습니다. 없으면 지금까지처럼 한 줄입니다. */
    headerTitle: opts?.parent
      ? () => <PathTitle parent={opts.parent as string} title={title} />
      : undefined,
    headerLeft: () => (
      <NavLeft
        navigation={navigation}
        route={route}
        toTrip={opts?.toTrip}
        up={opts?.up}
        rail={opts?.rail}
      />
    ),
  });
}
