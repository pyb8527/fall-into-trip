import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { Body, Caption, IconButton, MenuCard, Rise, Row, Screen, Title } from '@/ui';
import { LogoMark } from '@/ui/logo';

/**
 * 첫 화면.
 *
 * <p>할 수 있는 일을 카드로 늘어놓습니다. 메뉴를 숨겨 두면 있는 줄도 모르고
 * 지나갑니다. 아직 만들지 않은 것도 "준비 중" 으로 함께 보여 줍니다 —
 * 없는 척하는 것보다 언제 오는지 아는 편이 낫습니다.
 *
 * <p>다만 "준비 중" 은 정말 없는 것에만 붙입니다. 지도와 동행자는 여행
 * 안에서 이미 되는데도 자리 채우기로 남아 있어, 되는 것을 안 된다고
 * 말하고 있었습니다. 뺐습니다.
 */
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <Screen safeTop>
      <View style={styles.head}>
        <Row style={styles.headTop}>
          <LogoMark size={26} />
          {/* 계정 설정은 늘 같은 자리(오른쪽 위)에 둡니다. 메뉴 사이에 끼워 두면
              쓸 일이 드문 것이 자주 쓰는 것들과 자리를 다툽니다. */}
          <IconButton
            name="settings"
            label="내 계정"
            onPress={() => router.push('/(app)/settings')}
          />
        </Row>
        {/* 이름을 강조색으로 떼어 놓습니다. 한 덩어리로 두면 인사말이 그냥
            문장 하나로 흘러갑니다.

            색만 다르고 크기는 같습니다. 작게 두었더니 정작 사람 이름이
            인사말보다 작아 곁다리처럼 보였습니다. */}
        <Title>
          {user?.name ? (
            <>
              <Title tone="accent">{user.name}</Title>
              {' 님, 오늘은 어디에 반해 볼까요?'}
            </>
          ) : (
            '오늘은 어디에 반해 볼까요?'
          )}
        </Title>
        <Body tone="secondary">함께 그리고, 주워 담고, 두고두고 꺼내 봅니다.</Body>
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
    </Screen>
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
});
