import { usePathname, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-provider';
import {
  Colors,
  Radius,
  Spacing,
  TabDock,
  Tap,
  Type,
  Weight,
} from '@/constants/theme';
import { Icon, type IconName, Mark, Press } from '@/ui';
import { SidebarWidth, useWide } from '@/ui/layout';
import { LogoMark, LogoSymbol } from '@/ui/logo';
import { faceOf } from '@/constants/user-marks';
import { WANT } from '@/constants/words';

/**
 * 화면 아래에 늘 붙어 있는 띠.
 *
 * <h3>왜 아래인가</h3>
 *
 * <p>할 수 있는 일들을 <b>첫 화면 한가운데</b>에 카드로 늘어놓고 있었습니다.
 * 그래서 보석함에 가려면 어느 화면에 있든 먼저 홈으로 돌아와야 했고, 홈은
 * 그 카드들 때문에 정작 여행 목록을 아래로 밀어냈습니다.
 *
 * <p>아래로 내립니다. 어느 화면에서든 한 번에 닿고, 폰을 한 손으로 쥐었을
 * 때 엄지가 가는 자리입니다. 홈은 메뉴판 노릇을 그만두고 내용만 답니다.
 *
 * <h3>두 층으로 씁니다</h3>
 *
 * <p>바깥에서는 앱 전체의 갈래({@link AppTabs})가 서고, 여행 하나에 들어가면
 * <b>그 여행에서 하는 일들</b>로 바뀝니다. 들어간 곳의 도구가 손에 잡히는
 * 것이 맞고, 그러지 않으면 여행 안에서 쓰는 것들이 다시 화면 어딘가로
 * 흩어집니다.
 *
 * <p>여행 쪽에는 왼쪽에 나가는 길을 답니다. 갈래가 통째로 바뀌었으므로
 * 어디서 빠져나가는지가 보여야 합니다.
 */
export type TabItem = {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  /* 지금 이 화면인지. 안 주면 눌린 적 없는 것으로 봅니다. */
  active?: boolean;
  /** 볼 것이 있다는 점. 숫자는 안 적습니다 — 열기 전에 셀 일이 아닙니다. */
  dot?: boolean;
};

export function TabBar({
  items,
  onBack,
  /**
   * 지금 들어와 있는 곳의 이름. 넓은 화면에서만 씁니다.
   *
   * <p>여행 안에서는 사이드바 위쪽에 「← 내 여행」과 이 이름이 섭니다.
   * 아래 띠에서는 쓰지 않습니다 — 띠에는 적을 자리가 없습니다.
   */
  title,
}: {
  items: TabItem[];
  onBack?: () => void;
  title?: string;
}) {
  const insets = useSafeAreaInsets();
  const wide = useWide();

  /* 넓은 화면에서는 아래 띠가 아니라 왼쪽 기둥입니다. 폰은 아래 그대로입니다. */
  if (wide) {
    return <Sidebar items={items} onBack={onBack} title={title} />;
  }

  return (
    <View
      /* 띠 바깥은 그대로 눌립니다. 안 그러면 띠를 감싼 빈 자리가 화면 아래
         전체를 덮어, 그 뒤에 있는 것을 못 누릅니다. */
      pointerEvents="box-none"
      style={[
        styles.dock,
        /*
          높이를 못박습니다.

          <p>minHeight 로 두면 <b>안에 든 것이 더 크면 띠가 그만큼 자랍니다.</b>
          그런데 판(DragSheet)은 TabDock 이라는 숫자만 믿고 그만큼 떠 있습니다.
          둘이 어긋나면 판 아래와 띠 위 사이에 틈이 생기고, 그 틈으로 지도가
          비칩니다.

          <p>높이를 정해 두면 어긋날 수가 없습니다. 안에 든 것이 TabDock 보다
          커지면 잘리는데, 그때는 TabDock 을 다시 재는 것이 맞습니다 —
          모르는 채로 틈이 벌어지는 것보다 낫습니다.
        */
        {
          /*
            안전영역은 <b>띠 안쪽</b>에 둡니다.

            <p>겉껍데기에 {@code paddingBottom} 으로 두고 있었습니다. 띠가
            떠 있는 알약이던 때는 그것이 맞았습니다 — 알약은 안전영역 위에
            앉고, 그 아래로 내용이 비쳐 보이는 것이 제 모습이었습니다.

            <p>띠를 바닥에 붙이고 나니 그 여백이 <b>흰 면 밖</b>에 남았습니다.
            띠 아래 한 자락(아이폰은 34픽셀)이 투명한 채로 남아서, 굴러 올라온
            내용이 그 틈으로 보였습니다 — 띠가 바닥에 붙은 것이 아니라 바닥에서
            조금 떠 있는 것처럼 됐습니다.

            <p>여백을 안쪽으로 옮깁니다. 흰 면이 화면 맨 아래까지 닿고, 갈래
            이름들은 그 안에서 안전영역 위에 앉습니다.
          */
          height: TabDock + Math.max(insets.bottom, Spacing.sm),
        },
      ]}>
      {/*
        나가는 화살표는 여기 없습니다.

        <p>띠 왼쪽에 동그란 화살표가 하나 더 서 있었습니다. 여행 안의 네
        화면(일정·가고 싶은 곳·가계부·요약)이 모두 위 막대에 <b>뒤로</b>를
        이미 가지고 있는데(app/_layout.tsx 의 stackHeader), 그 아래
        띠에도 같은 일을 하는 단추가 또 있었습니다 — 나가는 길이 한 화면에
        둘이면 어느 것이 맞는지 한 번 생각하게 됩니다.

        <p>넓은 화면의 기둥에는 그대로 있습니다. 거기서는 「← 내 여행」이
        기둥 위쪽에 서서 <b>지금 어느 여행 안인지</b>를 같이 말합니다 —
        막대의 뒤로와 하는 말이 다릅니다.
      */}
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        {items.map((item) => (
          <Press
            key={item.key}
            /*
              지금 이 화면이면 아무 일도 안 합니다.

              <p>칸마다 스스로 막게 두었더니 여행 쪽만 막고 바깥 갈래는
              안 막혔습니다. 그래서 「홈」에서 홈을 다시 누르면 같은 화면이
              한 겹 더 쌓이고, 뒤로가기가 한 번 헛돌았습니다 — 눌렀는데
              아무 일도 안 일어나는 것으로 보입니다.

              <p>여기서 한 번 막으면 칸을 더 만들어도 같이 지켜집니다.
            */
            onPress={item.active ? () => {} : item.onPress}
            accessibilityLabel={item.label}
            accessibilityState={{ selected: !!item.active }}
            scale={0.94}
            style={styles.tab}>
            <View>
              {/*
                켜지면 채우고 꺼지면 선으로 그립니다.

                <p>전에는 색 하나로만 갈랐습니다(진한 회색 ↔ 옅은 회색).
                페더에 채운 그림이 없어서였는데, 그러면 띠를 흘긋 봐서는
                어느 칸에 있는지 모릅니다. 색은 눈이 견주어야 읽히고 모양은
                바로 읽힙니다.
              */}
              <Icon
                name={item.icon}
                size={24}
                solid={!!item.active}
                tone={item.active ? 'accent' : 'off'}
              />
              {item.dot ? <View style={styles.dot} /> : null}
            </View>
            {/*
              글자를 답니다. 그림만 두면 책갈피가 보석함인지 읽던 자리인지,
              나침반이 둘러보기인지 지도인지 눌러 봐야 압니다 — 이 앱의
              갈래는 그림 하나로 뜻이 서는 것들이 아닙니다.
            */}
            <Text style={[styles.label, item.active ? styles.labelOn : null]} numberOfLines={1}>
              {item.label}
            </Text>
          </Press>
        ))}
      </View>
    </View>
  );
}

/**
 * 넓은 화면의 왼쪽 기둥.
 *
 * <h3>아래 띠가 모니터 밑에 깔려 있었습니다</h3>
 *
 * <p>같은 코드가 폰과 PC 브라우저를 다 그립니다. 그래서 1920 짜리 창에서도
 * 갈래가 <b>화면 맨 아래 가로 띠</b>로 섰습니다. 손가락이 가는 자리라서
 * 아래에 둔 것인데, 마우스를 쓰는 사람에게 화면 맨 아래는 가장 먼 자리입니다.
 * 게다가 띠가 화면 폭을 다 쓰면서 다섯 칸이 모니터 가운데에 띄엄띄엄
 * 흩어졌습니다.
 *
 * <p>세웁니다. 폭 240 흰 기둥에 로고와 갈래와 내 계정이 위에서 아래로 쌓이고,
 * 본문은 그 오른쪽에서 시작합니다 — 웹 앱이 거의 다 이 모양입니다.
 *
 * <h3>자리는 본문이 비켜 줍니다</h3>
 *
 * <p>기둥은 {@code fixed} 로 떠 있습니다. 굴려도 따라오지 않고, 안에 든
 * 내용이 길어도 창에 붙어 있어야 하기 때문입니다. 대신 기둥만큼을 비워 두는
 * 일은 본문 쪽이 합니다(각 화면의 {@code contentStyle}) — 떠 있는 것은
 * 자리를 차지하지 못하므로, 안 비켜 주면 본문 왼쪽이 기둥 뒤로 들어갑니다.
 */
function Sidebar({
  items,
  onBack,
  title,
}: {
  items: TabItem[];
  onBack?: () => void;
  title?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={styles.rail}>
      {/*
        맨 위는 로고입니다.

        <p>여행 안에 들어와 있어도 걷지 않습니다. 걷어 보았더니 기둥 맨 위가
        여행 이름으로 시작해서, 지금 보고 있는 것이 <b>이 앱인지</b>가 화면
        어디에도 안 적혀 있었습니다. 로고는 그대로 두고 여행 이름을 그 아래에
        답니다.
      */}
      <Press
        onPress={() => router.replace('/(app)/home')}
        scale={1}
        accessibilityLabel="처음으로"
        style={styles.railLogo}>
        <LogoSymbol size={24} />
        <LogoMark size={20} />
      </Press>

      {/*
        여행 안이면 나가는 길과 여행 이름.

        <p>폰에서는 띠 왼쪽의 동그란 화살표 하나였습니다. 그림만으로는 어디로
        나가는지 안 보였는데, 기둥에는 글자를 적을 자리가 있습니다.
      */}
      {onBack || title ? (
        <View style={styles.railTrip}>
          {/*
            적어 둔 대로 갑니다.

            <p>폰 띠의 화살표(onBack)를 그대로 쓰지 않습니다. 그쪽은 화면마다
            다른 데로 갑니다 — 일정에서는 여행 목록으로, 가계부·요약에서는
            일정으로. 그림 하나일 때는 「한 걸음 물러난다」로 읽혀 괜찮지만,
            여기는 글자가 「내 여행」이라고 적혀 있습니다. 적힌 데로 가야
            합니다.
          */}
          <Press
            onPress={() => router.replace('/(app)/trips')}
            scale={1}
            accessibilityLabel="내 여행으로"
            style={styles.railBack}>
            <Icon name="chevron-left" size={20} tone="muted" />
            <Text style={styles.railBackLabel}>내 여행</Text>
          </Press>
          {title ? (
            <Text style={styles.railTitle} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.railItems}>
        {items.map((item) => (
          <Press
            key={item.key}
            /* 지금 이 화면이면 아무 일도 안 합니다 — 아래 띠와 같은 규칙입니다.
               같은 곳을 다시 쌓으면 뒤로가기가 한 번 헛돕니다. */
            onPress={item.active ? () => {} : item.onPress}
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: !!item.active }}
            /* 줄은 크기가 안 변합니다. 240 짜리 줄이 쪼그라들면 아래 줄들이
               들썩이는 것처럼 보입니다 — 눌린 것은 바탕이 말합니다. */
            scale={1}
            style={[styles.railItem, item.active ? styles.railItemOn : null]}>
            <View>
              <Icon
                name={item.icon}
                size={24}
                solid={!!item.active}
                tone={item.active ? 'accent' : 'off'}
              />
              {item.dot ? <View style={styles.dot} /> : null}
            </View>
            <Text
              style={[styles.railLabel, item.active ? styles.railLabelOn : null]}
              numberOfLines={1}>
              {item.label}
            </Text>
          </Press>
        ))}
      </View>

      {/*
        내 계정은 맨 아래입니다.

        <p>폰에서는 홈 막대 오른쪽의 그림 단추였다가 홈의 맨 아래 줄로
        내려갔습니다. 하루에 한 번도 안 누르는 것이라 갈래 다섯과 같은 무게로
        둘 일이 아닙니다. 기둥에서도 갈래와 떨어진 맨 아래에 둡니다 — 이름이
        적혀 있으니 누가 로그인해 있는지도 여기서 보입니다.
      */}
      <View style={styles.railGrow} />
      <Press
        onPress={() => router.push(user ? '/(app)/settings' : '/(auth)/welcome')}
        scale={1}
        accessibilityLabel={user ? '내 계정' : '로그인'}
        style={styles.railMe}>
        <Mark emoji={faceOf(user?.mark, user?.name ?? '나')} fallback="🙂" />
        <View style={styles.railMeText}>
          <Text style={styles.railMeName} numberOfLines={1}>
            {user?.name ?? '로그인'}
          </Text>
          <Text style={styles.railMeNote} numberOfLines={1}>
            {user ? '내 계정' : '계정 만들기'}
          </Text>
        </View>
      </Press>
    </View>
  );
}

/**
 * 앱 전체의 갈래.
 *
 * <p>다섯입니다. 여섯을 넘기면 좁은 폰에서 글자가 잘리고, 넷이면 아래가
 * 휑합니다.
 *
 * <p>모임이 여기 있는 것은 <b>사람을 부르는 길이 모임 하나</b>이기
 * 때문입니다. 여행에 사람을 따로 부르는 길을 없앴으니, 같이 짤 사람을
 * 찾는 사람이 들어갈 자리가 띠에 있어야 합니다.
 */
export function AppTabs() {
  const router = useRouter();
  const here = usePathname();

  /*
    갈래를 옮기는 것은 쌓는 일이 아닙니다.

    <p>push 로 쌓고 있었습니다. 그래서 홈 → 내 여행 → 보석함 → 둘러보기로
    돌아다닌 뒤 뒤로가기를 누르면 지나온 갈래를 거꾸로 되밟아야 했고, 네 번을
    눌러야 갈래 밖으로 나갔습니다. 여행 안의 갈래(TripTabs)는 처음부터
    replace 였으니, 같은 몸짓이 <b>바깥과 속에서 다르게</b> 굴었습니다.

    <p>안 쌓습니다. 한 번 누르면 갈래 밖으로 나가고, 폰 어플에서 아래 띠가
    하는 일과 같아집니다.
  */
  const go = (path: string) => () => router.replace(path as never);

  return (
    <TabBar
      items={[
        {
          key: 'home',
          label: '홈',
          icon: 'home',
          active: here === '/home' || here === '/',
          onPress: go('/(app)/home'),
        },
        {
          key: 'trips',
          label: '내 여행',
          icon: 'calendar',
          active: here.startsWith('/trips'),
          onPress: go('/(app)/trips'),
        },
        {
          key: 'groups',
          label: '모임',
          icon: 'users',
          active: here.startsWith('/groups'),
          onPress: go('/(app)/groups'),
        },
        {
          /*
            한동안 「저장」이었습니다. 돌려놓습니다.

            <p>「보석함」은 처음 연 사람이 무엇이 들었는지 모른다 — 눌러 봐야
            「담아 둔 장소」라는 것을 안다 — 가 「저장」으로 바꾼 까닭이었습니다.
            띠의 칸 이름은 멋을 부리는 자리가 아니라 길 표지라는 것입니다.

            <p>그런데 「저장」은 <b>이 앱이 가장 많이 쓰는 낱말과 겹쳤습니다</b> —
            메모도 저장, 설정도 저장, 글도 저장입니다. 「저장에서 가져오기」라고
            적히면 어디에서 무엇을 가져오는 말인지 한 번 멈춥니다.

            <p>겹치지 않는 새 낱말을 고르는 길도 있었습니다. 그런데 <b>띠 하나를
            뺀 거의 모든 문구가 이미 「보석함」이라고 적고 있었습니다</b> —
            {@code constants/words.ts} 의 담기·담김·빼기 셋, 처음 만나는 화면의
            「가고 싶은 곳을 보석함에 모아 둬요」, 막는 판의 「보석함은 사람마다
            따로예요」까지 열 몇 군데입니다. 새 낱말을 세우면 그 전부를 따라
            고쳐야 하고, 그것은 이 앱의 말투를 바꾸는 일입니다.

            <p>그래서 <b>문구가 이미 쓰는 이름으로 띠를 맞춥니다.</b> 고칠 데가
            한 군데이고, 띠와 문구가 같은 말을 하게 됩니다. 「무엇이 들었는지
            모른다」는 그대로 남는 값인데, 그것은 이름이 아니라 처음 열었을 때
            무엇을 보여 주는지로 갚는 편이 낫습니다.
          */
          key: 'saved',
          label: '보석함',
          icon: 'bookmark',
          active: here.startsWith('/saved'),
          onPress: go('/(app)/saved'),
        },
        {
          key: 'community',
          label: '둘러보기',
          icon: 'compass',
          active: here.startsWith('/community'),
          onPress: go('/community'),
        },
      ]}
    />
  );
}

/** 여행 안에서 오갈 수 있는 곳들. 어느 화면에 있든 같은 순서로 섭니다. */
export type TripTabKey = 'plan' | 'vote' | 'money' | 'card';

/**
 * 여행 하나의 갈래.
 *
 * <h3>왜 여행마다 띠가 바뀌는가</h3>
 *
 * <p>여행에 들어오면 그 안에서 오가는 것이 대부분입니다. 바깥 갈래(홈·보석함…)
 * 를 그대로 두면 정작 자주 쓰는 것들이 다시 화면 어딘가로 흩어집니다.
 *
 * <h3>다섯 화면이 같은 띠를 나눠 씁니다</h3>
 *
 * <p>일정에만 달아 두었더니 「여행 중」으로 넘어가는 순간 띠가 사라져서,
 * 거기서 가계부로 가려면 뒤로 → 일정 → 가계부를 밟아야 했습니다. 갈래라고
 * 해 놓고 한 화면에서만 갈래인 셈이었습니다.
 *
 * <p>여기 한 벌만 두고 다섯이 같이 씁니다. 화면이 하나 늘어도 고칠 데는
 * 여기뿐입니다.
 *
 * @param active 지금 이 화면. 그 칸은 눌러도 아무 일이 없습니다 — 같은 곳을
 *               다시 쌓으면 뒤로가기가 한 번 헛돕니다
 */
export function TripTabs({
  tripId,
  active,
  onBack,
  title,
}: {
  tripId: string;
  active: TripTabKey;
  /** 나가는 길. 안 주면 일정 화면으로 돌아갑니다. */
  onBack?: () => void;
  /** 여행 이름. 넓은 화면의 기둥 위쪽에 섭니다. 아래 띠는 안 씁니다. */
  title?: string;
}) {
  const router = useRouter();

  /* replace 입니다. 갈래끼리 오가는 것은 <b>같은 층에서 자리를 옮기는
     일</b>이라, push 로 쌓으면 뒤로가기를 다섯 번 눌러야 여행 밖으로
     나갑니다. 지금 화면을 다시 누르는 것은 띠가 막습니다(TabBar). */
  const go = (path: string) => () =>
    router.replace({ pathname: path as never, params: { id: tripId } as never });

  return (
    <TabBar
      title={title}
      onBack={onBack ?? (() => router.replace({ pathname: '/trip/[id]', params: { id: tripId } }))}
      items={[
        {
          key: 'plan',
          label: '일정',
          icon: 'calendar',
          active: active === 'plan',
          onPress: go('/trip/[id]'),
        },
        {
          key: 'vote',
          label: WANT,
          icon: 'thumbs-up',
          active: active === 'vote',
          onPress: go('/vote/[id]'),
        },
        {
          key: 'money',
          label: '가계부',
          icon: 'credit-card',
          active: active === 'money',
          onPress: go('/money/[id]'),
        },
        {
          key: 'card',
          label: '요약',
          icon: 'book-open',
          active: active === 'card',
          onPress: go('/card/[id]'),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  /*
    띠가 앉는 자리.

    <h3>떠 있는 알약을 세 번 고쳤습니다</h3>

    <p>처음에는 회색 바탕을 깔고 그 위에 알약을 띄웠습니다. 일정 화면이
    지도를 바탕으로 쓰는데, 반투명 알약 뒤로 지도가 그대로 보여 지도에 얹힌
    조각처럼 보였기 때문입니다. 그런데 그것은 <b>화면 아래 한 자락을 통째로
    회색으로 막는</b> 일이라, 어느 화면에서든 내용이 그 선에서 끊겼습니다 —
    알약 하나를 살리려고 82픽셀을 버린 셈입니다.

    <p>그래서 바탕색만 걷고 알약은 그대로 뒀습니다. 반투명한 흰 판에 머리카락
    한 올 테두리와 그림자로, 알약 스스로 떠 있게 했습니다.

    <p>이제 알약을 걷었습니다. 알약의 전제는 <b>「회색 바닥에 흰 판을 얹어
    층을 만든다」</b>였는데, 개편에서 바닥이 흰색이 됐습니다. 흰 바닥 위에
    반투명한 흰 알약은 비치는 것도 흐리는 것도 아무 말을 안 하고, 그림자만
    남아 화면 아래가 들떠 보였습니다. 알약 양옆으로는 본문이 비집고 나왔습니다.

    <p>지금은 <b>바닥에 붙은 흰 띠</b>입니다. 위에 1px 선 하나로 「여기서부터
    띠」를 말하고, 그림자는 안 씁니다 — 떠 있을 이유가 없습니다. 흰 면은
    화면 맨 아래까지(안전영역 포함) 닿습니다. 그 여백을 겉껍데기에 두었더니
    띠 아래 한 자락이 투명하게 남아 내용이 비쳐 보였습니다.

    <p>자리를 없애지는 않습니다. 높이가 0 이 되면 판(DragSheet)이 믿고 있는
    TabDock 과 어긋나고, 굴러가는 화면의 마지막 줄이 띠 뒤로 들어가 아무리
    굴려도 안 보입니다.
  */
  dock: {
    backgroundColor: 'transparent',
    /*
      웹에서는 fixed 입니다.

      <p>absolute 는 <b>부모</b>의 바닥에 붙습니다. 부모가 화면과 꼭 같은
      높이일 때만 그것이 화면 바닥이고, 폰 브라우저에서는 주소창이 오르내리며
      그 전제가 깨집니다 — 띠가 바닥에서 한 자락 떠 있었습니다.

      <p>fixed 는 지금 보이는 화면에 붙습니다. 부모가 얼마나 크든 상관없이
      늘 맨 아래입니다. 앱에는 fixed 가 없으므로 그쪽은 absolute 그대로입니다.
    */
    position: 'absolute',
    ...Platform.select({ web: { position: 'fixed' as 'absolute' }, default: {} }),
    /*
      판(dragSheet)보다 한 칸 위입니다.

      <p>둘이 같은 층이었습니다. 판이 띠 높이만큼 떠 있어서 서로 안 겹쳤기
      때문인데, 지금은 판이 바닥까지 내려와 띠 뒤로 지나갑니다 — 띠 뒤에
      지도가 아니라 일정이 보이게 하려고 그렇게 했습니다.

      <p>겹치면 띠가 이겨야 합니다. 안 그러면 판의 마지막 줄이 띠를 덮어
      갈래를 누를 수가 없습니다.
    */
    zIndex: 3,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    /*
      띠가 겉껍데기를 꽉 채웁니다.

      <p>{@code 'flex-end'} 였습니다. 알약이 겉껍데기 바닥에 앉고 그 위는
      비워 두는 것이 제 모습이었기 때문인데, 바닥에 붙는 띠에 그것을 두면
      <b>띠가 제 내용만큼만 높아지고</b> 나머지가 투명하게 남습니다.
    */
    alignItems: 'stretch',
    /* 바닥에 붙습니다. 좌우로 12 띄워 알약을 떠 있게 두던 여백을
       걷습니다 — 그 여백이 있으면 띠 양옆으로 본문이 비집고 나옵니다. */
    gap: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  /*
    바닥에 붙은 흰 띠.

    <h3>떠 있는 알약이었습니다</h3>

    <p>좌우로 12 띄운 둥근 알약이었고, 속이 0.86 만큼 비치고 뒤엣것을
    흐리고(backdropFilter) 그림자로 떠 있었습니다. 까닭은 「회색 바닥에
    흰 판을 얹어 층을 만드는데, 아래를 흰 띠로 꽉 채우면 바닥과 띠가 한
    덩어리가 되어 층이 무너진다」였습니다.

    <p>그 전제가 사라졌습니다. <b>바닥이 흰색입니다.</b> 그래서 반투명 흰
    알약이 흰 바닥 위에 떠 있는 꼴이 되어, 비치는 것도 흐리는 것도 아무
    말을 안 하고 <b>그림자만 남아 화면 아래가 들떠</b> 보였습니다. 알약
    양옆으로는 본문이 비집고 나왔습니다.

    <p>바닥에 붙입니다. 흰 면에 위로 1px 선 하나 — 선이 「여기서부터 띠」를
    말하고, 그림자는 안 씁니다. 떠 있을 이유가 없습니다.

    <p>지도 위에 얹히는 화면에서도 그대로입니다. 지도는 띠 뒤로 지나가지
    않고 띠 위까지만 그려집니다.
  */
  bar: {
    flex: 1,
    flexDirection: 'row',
    /*
      칸들은 <b>안전영역 위</b>에서 가운데입니다.

      <p>{@code 'center'} 로 두면 안전영역까지 더한 높이의 가운데에 앉아서,
      아이폰에서 갈래 이름이 17픽셀쯤 아래로 처집니다. 위쪽을 기준으로 두고
      칸이 제 높이(TabDock)를 가지게 합니다.
    */
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  tab: {
    flex: 1,
    /* 띠 몸통 높이를 그대로 가집니다. 안전영역은 겉의 바가 들고 있습니다. */
    height: TabDock,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  /*
    갈래 이름.

    <p>micro 11/14 입니다. 14/18 이었는데, 그만하면 <b>목록의 메타 글자와
    같은 크기</b>입니다 — 띠의 이름은 읽으라고 있는 것이 아니라 아이콘이
    무엇인지 한 번 알려 주는 것이라, 그보다 작아야 띠가 얇아집니다.
    다섯 칸이 나란히 서므로 「가고 싶은 곳」 같은 긴 이름도 들어갑니다.
  */
  label: {
    ...Type.micro,
    /* 꺼진 칸용 회색입니다. 메타 글자색(textMuted)이 한 단 진해지면서
       켜진 칸과 구별이 흐려졌습니다 — 꺼진 것은 꺼진 것끼리 같은 값을
       봐야 합니다. */
    color: Colors.iconOff,
  },
  /* 켜진 것은 색이 아니라 굵기로 말합니다. 다섯 중 하나에만 색을 칠하면
     그 색이 이 화면에서 가장 진한 것이 되어, 정작 내용이 밀립니다. */
  labelOn: {
    color: Colors.text,
    fontWeight: Weight.semibold,
  },
  /* 안 읽은 것이 있다는 점. accent 였는데, 바이올렛은 이 앱에서 「눌러서
     하는 일」의 색이라 점이 켜진 칸처럼 보였습니다 — 꺼진 갈래에 붙어 있을
     때 특히요. 알림은 빨강입니다(§2-3). */
  dot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.danger,
    /* 아이콘 선 위에 겹치면 선 하나처럼 보입니다. 흰 테두리로 떼어 놓습니다. */
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  /* ------------------------------------------------ 넓은 화면의 왼쪽 기둥 */
  /*
    기둥.

    <p>떠 있지만 비치지 않습니다. 아래 띠는 지도 위에 얹히는 알약이라
    반투명했는데, 이것은 본문 옆에 붙은 <b>면</b>입니다. 비치면 뒤로 지나가는
    내용이 글자에 겹칩니다.
  */
  rail: {
    position: 'absolute',
    ...Platform.select({ web: { position: 'fixed' as 'absolute' }, default: {} }),
    /* 아래 띠와 같은 층입니다 — 본문 위, 판 위. */
    zIndex: 3,
    left: 0,
    top: 0,
    bottom: 0,
    width: SidebarWidth,
    backgroundColor: Colors.surface,
    /* 선 한 가닥. 그림자로 띄우지 않습니다 — 기둥은 본문 위에 뜬 것이
       아니라 본문 옆에 붙은 면입니다. */
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingHorizontal: Spacing.s3,
    paddingTop: Spacing.s5,
    paddingBottom: Spacing.s5,
    gap: Spacing.s4,
  },
  railLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
    height: Tap.min,
    paddingHorizontal: Spacing.s2,
  },
  railTrip: {
    gap: Spacing.s1,
    paddingHorizontal: Spacing.s2,
  },
  railBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s1,
    height: Tap.min,
    /* 화살표가 글자선보다 왼쪽으로 나가 앉습니다. 안 빼면 「내 여행」이
       아래 여행 이름보다 들여쓴 것처럼 보입니다. */
    marginLeft: -Spacing.s1,
  },
  railBackLabel: {
    ...Type.label,
    fontWeight: Weight.medium,
    color: Colors.textSecondary,
  },
  railTitle: {
    ...Type.title3,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  railItems: {
    gap: Spacing.s1,
  },
  /* 한 줄. 계획서가 정한 높이 44 · 모서리 8 입니다. */
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    height: Tap.min,
    paddingHorizontal: Spacing.s2,
    borderRadius: Radius.r2,
  },
  /* 켜진 줄은 바탕이 한 단 어둡습니다. 폰 띠에서는 칸이 다섯 나란히 서서
     굵기만으로 갈랐지만, 기둥에서는 줄이 위아래로 쌓이므로 바탕이 어디까지가
     그 줄인지까지 함께 말해 줍니다. */
  railItemOn: {
    backgroundColor: Colors.fill,
  },
  railLabel: {
    ...Type.body2,
    fontWeight: Weight.medium,
    /* 아래 띠의 꺼진 라벨과 같은 값입니다. */
    color: Colors.iconOff,
    flexShrink: 1,
  },
  railLabelOn: {
    color: Colors.text,
    fontWeight: Weight.semibold,
  },
  /* 갈래와 내 계정 사이를 벌립니다. 기둥 높이는 창 높이라 남는 자리를
     여기서 다 먹습니다. */
  railGrow: {
    flex: 1,
  },
  railMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    paddingHorizontal: Spacing.s2,
    paddingVertical: Spacing.s2,
    borderRadius: Radius.r2,
  },
  railMeText: {
    flex: 1,
  },
  railMeName: {
    ...Type.body2,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  railMeNote: {
    ...Type.caption,
    color: Colors.textMuted,
  },

  /* 나가는 길. 띠 바깥에 따로 둡니다 — 갈래 중 하나가 아니라 이 갈래
     전체에서 빠져나가는 것이라, 같은 줄 안에 두면 여섯 번째 갈래로
     읽힙니다. */
  /* 띠와 같은 재질입니다. 하나만 꽉 막힌 흰 동그라미면 둘이 다른 층에
     있는 것처럼 보입니다. */
});
