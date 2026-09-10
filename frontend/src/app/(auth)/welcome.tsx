import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, query } from '@/api/client';
import type { PostCard, PostPage } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { PostMap } from '@/components/post-map';
import { Spacing } from '@/constants/theme';
import { Body, Button, Caption, Card, Rise, Row, Screen, Subtitle, Title } from '@/ui';
import { LogoLockup } from '@/ui/logo';

/**
 * 처음 온 사람이 보는 문.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>지금까지 로그아웃 상태로 들어오면 예외 없이 로그인 화면이 떴습니다.
 * 처음 온 사람에게 로그인 화면은 <b>아무것도 말해 주지 않는 화면</b>입니다.
 * 여기가 무엇을 하는 곳인지 모르는 채로 이메일부터 내라고 하는 셈이라,
 * 대부분 거기서 닫습니다.
 *
 * <h3>말하지 않고 보여 줍니다</h3>
 *
 * <p>처음에는 여기에 "함께 고칩니다 · 모아 둡니다 · 가져옵니다" 세 줄을
 * 적어 두었습니다. 셋 다 <b>말</b>이었습니다. 읽는 사람은 그 말이 참인지
 * 알 길이 없고, 그래서 아무것도 달라지지 않습니다.
 *
 * <p>그런데 그 셋을 증명할 진짜 물건이 이미 서버에 있고, 계정 없이
 * 열립니다. 남이 올린 일정입니다. 지도 한 장과 제목 한 줄이면 "여기가
 * 뭐 하는 곳인지" 를 설명할 필요가 없어집니다.
 *
 * <p>가장 큰 단추도 가입이 아니라 둘러보기입니다. 아직 무엇인지도 모르는
 * 것에 이메일을 내줄 이유가 없습니다. 계정은 가져가고 싶어졌을 때 그
 * 자리에서 부릅니다(SignUpGate).
 *
 * <h3>비어 있을 때를 대비합니다</h3>
 *
 * <p>올라온 글이 없거나 서버가 안 뜨는 판에서는 이 자리가 통째로 빕니다.
 * 문이 비어 있으면 고장 난 것으로 읽히므로, 그때만 예전의 세 줄로
 * 돌아갑니다.
 *
 * <h3>"본 적 있음" 을 기억하지 않습니다</h3>
 *
 * <p>다시 온 사람에게 이 화면을 건너뛰게 하려면 기기에 표시를 남겨야
 * 하는데, 앱에는 그럴 저장소가 없어 웹에서만 되는 장치가 됩니다. 게다가
 * 로그인이 살아 있으면 애초에 이 화면을 지나지도 않습니다. 여기까지 온
 * 사람에게 필요한 것은 화면 안의 로그인 단추 하나입니다.
 */

/**
 * 문에 세워 둘 개수.
 *
 * <p>셋이면 "여기 뭐가 쌓여 있다" 로 읽히고, 둘이면 "이것뿐이다" 로
 * 읽힙니다. 넷부터는 문이 아니라 목록이 됩니다.
 *
 * <p>한 장이 곧 구글 호출 한 번이라는 것도 셈에 넣습니다. 로그인 안 한
 * 사람이 가장 자주 여는 화면이라 늘릴 자리가 아닙니다.
 */
const SHOW = 3;

export default function Welcome() {
  const router = useRouter();

  /* 인기순으로 받아 옵니다. 최신순이면 방금 올라온 빈 일정이 문 앞에
     설 수 있습니다. 계정 없이 열리는 주소라 토큰이 없어도 됩니다. */
  const { data } = useAsync<PostPage>(
    (signal) => api.get(`/api/posts${query({ sort: 'hot', page: 0 })}`, signal),
    [],
  );

  const shown = data?.posts.slice(0, SHOW) ?? [];

  return (
    <Screen
      safeTop
      footer={
        <>
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

      {shown.length > 0 ? (
        <View style={styles.feed}>
          {shown.map((post, i) => (
            <Rise key={post.id} order={i}>
              <Peek post={post} onOpen={() => router.push(`/community/${post.id}`)} />
            </Rise>
          ))}
        </View>
      ) : (
        /* 아직 아무것도 안 올라왔거나 서버가 안 뜬 판. 문이 비면 고장 난
           것으로 읽히므로 말로라도 채웁니다. */
        <View style={styles.points}>
          {POINTS.map((point) => (
            <Body key={point} tone="secondary">
              {point}
            </Body>
          ))}
        </View>
      )}
    </Screen>
  );
}

/**
 * 남이 올린 일정 한 편, 문 앞에서 미리.
 *
 * <p>누르면 그 글로 곧장 갑니다. 문을 한 번 더 거치게 하면 구경하러 온
 * 사람이 문 앞에서 한 번 더 결심해야 합니다.
 */
function Peek({ post, onOpen }: { post: PostCard; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button">
      <Card>
        <PostMap postId={post.id} title={post.title} height={132} />
        <Subtitle>{post.title}</Subtitle>
        {/* 누가·며칠·몇 곳. 이 세 개면 어떤 일정인지 감이 옵니다. */}
        <Caption tone="secondary">
          {post.region ? `${post.region} · ` : ''}
          {post.authorName} · {post.dayCount}일 · {post.placeCount}곳
        </Caption>
      </Card>
    </Pressable>
  );
}

/** 보여 줄 것이 없을 때만 쓰는 말. 한 줄에 하나씩. */
const POINTS = [
  '한 일정을 여럿이 함께 고칩니다.',
  '가고 싶은 곳을 보석함에 모아 둡니다.',
  '남이 다녀온 길을 통째로 가져옵니다.',
];

const styles = StyleSheet.create({
  brand: {
    alignItems: 'flex-start',
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xl,
  },
  feed: {
    gap: Spacing.md,
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
