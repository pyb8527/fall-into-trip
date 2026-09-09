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
          title="보관함"
          caption="담아 둔 곳 일정에 넣기"
          onPress={() => router.push('/(app)/saved')}
        />
        <MenuCard
          title="여행 이야기"
          caption="남의 일정 구경하고 가져오기"
          onPress={() => router.push('/community')}
        />
        <MenuCard title="가계부" caption="쓴 돈 적고 정산하기" soon />
        {user?.role === 'ADMIN' ? (
          <MenuCard
            title="운영"
            caption="계정 관리·감사 로그"
            onPress={() => router.push('/admin')}
          />
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
});
