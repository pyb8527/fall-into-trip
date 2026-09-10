import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Body, Button, Row, Screen, Title } from '@/ui';
import { LogoLockup } from '@/ui/logo';

/**
 * 처음 온 사람이 보는 문.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>지금까지 로그아웃 상태로 들어오면 예외 없이 로그인 화면이 떴습니다.
 * 그런데 처음 온 사람에게 로그인 화면은 <b>아무것도 말해 주지 않는
 * 화면</b>입니다. 여기가 무엇을 하는 곳인지 모르는 채로 이메일부터 내라고
 * 하는 셈이라, 대부분 거기서 닫습니다.
 *
 * <p>둘러보기는 이미 계정 없이도 됩니다(서버가 글 읽기를 열어 두었습니다).
 * 없던 것은 기능이 아니라 거기로 가는 문이었습니다.
 *
 * <h3>구경을 앞에 둡니다</h3>
 *
 * <p>큰 단추는 가입이 아니라 둘러보기입니다. 남이 다녀온 일정을 한 번
 * 열어 보면 이 앱이 무엇인지 설명할 필요가 없어집니다. 가입은 가져오고
 * 싶어졌을 때 그 자리에서 부릅니다(SignUpGate).
 *
 * <h3>"본 적 있음" 을 기억하지 않습니다</h3>
 *
 * <p>다시 온 사람에게 이 화면을 건너뛰게 하려면 기기에 표시를 남겨야
 * 하는데, 앱에는 그럴 저장소가 없어 웹에서만 되는 장치가 됩니다. 게다가
 * 로그인이 살아 있으면 애초에 이 화면을 지나지도 않습니다. 여기까지 온
 * 사람에게 필요한 것은 화면 안의 로그인 단추 하나입니다.
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <Screen
      safeTop
      footer={
        <>
          {/* 가장 큰 자리는 구경입니다. 여기서 계정을 물으면 아직 무엇인지도
              모르는 것에 이메일을 내주는 일이 됩니다. */}
          <Button label="여행 둘러보기" onPress={() => router.push('/community')} />
          <Row gap={Spacing.sm} style={styles.second}>
            <View style={styles.grow}>
              <Button
                label="내 여행 시작하기"
                variant="secondary"
                onPress={() => router.push('/(auth)/register')}
              />
            </View>
            <View style={styles.grow}>
              <Button
                label="이미 계정이 있어요"
                variant="ghost"
                onPress={() => router.push('/(auth)/login')}
              />
            </View>
          </Row>
        </>
      }>
      <View style={styles.brand}>
        <LogoLockup size={88} />
      </View>

      <Title>여행은 짜는 동안이 제일 깁니다</Title>

      {/*
        카드 셋을 줄 셋으로 바꿨습니다.

        상자 안에 표식과 제목과 설명을 넣으니 처음 온 사람 눈에는 읽을
        것이 아홉 덩어리로 보였습니다. 어디부터 읽어야 하는지 모르면
        아무것도 안 읽습니다. 한 줄에 하나씩만 둡니다.
      */}
      <View style={styles.points}>
        {POINTS.map((point) => (
          <Body key={point} tone="secondary">
            {point}
          </Body>
        ))}
      </View>
    </Screen>
  );
}

/** 셋만, 한 줄씩. 넷째 줄부터는 읽히지 않습니다. */
const POINTS = [
  '한 일정을 여럿이 함께 고칩니다.',
  '가고 싶은 곳을 보석함에 모아 둡니다.',
  '남이 다녀온 길을 통째로 가져옵니다.',
];

const styles = StyleSheet.create({
  brand: {
    alignItems: 'flex-start',
    paddingTop: Spacing.huge,
    paddingBottom: Spacing.xxl,
  },
  points: {
    gap: Spacing.sm,
  },
  grow: {
    flex: 1,
  },
  second: {
    flexWrap: 'nowrap',
  },
});
