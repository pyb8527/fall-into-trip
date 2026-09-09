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
        {/* 이름을 강조색으로 떼어 놓습니다. 한 덩어리로 두면 인사말이
            그냥 문장 하나로 흘러갑니다. */}
        <Title>
          {user?.name ? (
            <>
              <Caption tone="accent" strong>
                {user.name}
              </Caption>
              {' 님, 어디로 가볼까요?'}
            </>
          ) : (
            '어디로 가볼까요?'
          )}
        </Title>
        <Body tone="secondary">일정을 짜고, 동행자와 함께 고치고, 다녀온 것을 남깁니다.</Body>
      </View>

      {/* 카드가 한 번에 툭 나타나면 화면이 갈아 끼워진 것처럼 보입니다.
          위에서부터 조금씩 늦게 떠오르면 눈이 따라 내려갑니다. */}
      <Row gap={Spacing.md} style={styles.grid}>
        <Rise order={0} style={styles.half}>
          <MenuCard
            title="내 여행"
            caption="일정 짜고 동행자 부르기"
            onPress={() => router.push('/(app)/trips')}
          />
        </Rise>
        <Rise order={1} style={styles.half}>
          <MenuCard
            title="보관함"
            caption="담아 둔 곳 일정에 넣기"
            onPress={() => router.push('/(app)/saved')}
          />
        </Rise>
        <Rise order={2} style={styles.half}>
          <MenuCard
            title="여행 이야기"
            caption="다른 사람 일정 구경하고 가져오기"
            onPress={() => router.push('/community')}
          />
        </Rise>
        <Rise order={3} style={styles.half}>
          <MenuCard title="가계부" caption="쓴 돈 적고 나누기" soon />
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
