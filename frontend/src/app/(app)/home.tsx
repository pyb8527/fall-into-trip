import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { Body, IconButton, MenuCard, Row, Screen, Title } from '@/ui';
import { LogoMark } from '@/ui/logo';

/**
 * 첫 화면.
 *
 * <p>할 수 있는 일을 카드로 늘어놓습니다. 메뉴를 숨겨 두면 있는 줄도 모르고
 * 지나갑니다. 아직 만들지 않은 것도 "준비 중" 으로 함께 보여 줍니다 —
 * 없는 척하는 것보다 언제 오는지 아는 편이 낫습니다.
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
        <Title>{user?.name ? `${user.name} 님, 어디로 가볼까요?` : '어디로 가볼까요?'}</Title>
        <Body tone="secondary">일정을 짜고, 동행자와 함께 고치고, 쓴 돈을 나눕니다.</Body>
      </View>

      <Row gap={Spacing.md} style={styles.grid}>
        <MenuCard
          title="내 여행"
          caption="일정 짜고 동행자 부르기"
          onPress={() => router.push('/(app)/trips')}
        />
        <MenuCard
          title="가계부"
          caption="쓴 돈 적고 정산하기"
          soon
        />
        <MenuCard
          title="지도"
          caption="하루 동선 한눈에 보기"
          soon
        />
        {user?.role === 'ADMIN' ? (
          <MenuCard
            title="운영"
            caption="계정 관리·감사 로그"
            onPress={() => router.push('/admin')}
          />
        ) : (
          <MenuCard title="동행자" caption="함께 간 사람 모아 보기" soon />
        )}
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
});
