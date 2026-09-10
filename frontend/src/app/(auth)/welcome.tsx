import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { Body, Button, Caption, Card, Rise, Row, Screen, Subtitle, Title } from '@/ui';
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
        <LogoLockup size={92} />
      </View>

      <View style={styles.head}>
        <Title>여행은 짜는 동안이 제일 깁니다</Title>
        <Body tone="secondary">
          같이 그리고, 주워 담고, 두고두고 꺼내 보는 곳. 구경은 가입하지 않아도 됩니다.
        </Body>
      </View>

      {POINTS.map((point, i) => (
        <Rise key={point.title} order={i}>
          <Card>
            <Row gap={Spacing.md} style={styles.point}>
              <View style={styles.mark}>
                <Body strong style={styles.markText}>
                  {point.mark}
                </Body>
              </View>
              <View style={styles.pointText}>
                <Subtitle>{point.title}</Subtitle>
                <Body small tone="secondary">
                  {point.body}
                </Body>
              </View>
            </Row>
          </Card>
        </Rise>
      ))}

      <Caption tone="secondary">
        올라온 일정과 거기 달린 이야기는 계정 없이 그대로 보입니다. 가져오거나 담거나 한마디
        보태려 할 때만 계정을 부릅니다.
      </Caption>
    </Screen>
  );
}

/**
 * 세 가지만 말합니다.
 *
 * <p>기능을 다 늘어놓으면 아무것도 안 읽힙니다. 이 앱에만 있는 것,
 * 그리고 처음 온 사람이 바로 그림이 그려지는 것으로 셋만 고릅니다.
 */
const POINTS = [
  {
    mark: '✎',
    title: '같이 그립니다',
    body: '한 일정을 여럿이 고칩니다. 동행자가 저녁 자리를 바꾸면 알림이 옵니다.',
  },
  {
    mark: '★',
    title: '주워 둡니다',
    body: '가고 싶은 곳을 보석함에 모아 두고, 다음 여행을 짤 때 지도에서 꺼내 씁니다.',
  },
  {
    mark: '↯',
    title: '남의 길을 가져옵니다',
    body: '남이 다녀온 일정을 통째로 복사해 내 날짜에 맞춥니다. 그다음은 마음대로입니다.',
  },
];

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  head: {
    gap: Spacing.sm,
  },
  point: {
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
  },
  /* 번호가 아니라 표식입니다. 셋 사이에 순서가 없어 1·2·3 을 붙이면
     차례대로 해야 하는 것처럼 읽힙니다. */
  mark: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentSoft,
  },
  markText: {
    color: Colors.accentInk,
  },
  pointText: {
    flex: 1,
    gap: 2,
  },
  grow: {
    flex: 1,
  },
  second: {
    flexWrap: 'nowrap',
  },
});
