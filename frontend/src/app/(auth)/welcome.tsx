import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { api, query } from '@/api/client';
import type { PostCard, PostPage } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { PostMap } from '@/components/post-map';
import {
  Colors,
  Gutter,
  MaxContentWidth,
  Radius,
  Spacing,
  Tap,
  Type,
  Weight,
} from '@/constants/theme';
import { Body, Button, Caption, Screen } from '@/ui';
import { LogoMark } from '@/ui/logo';

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
 * <h3>단추를 셋에서 둘로 줄였습니다</h3>
 *
 * <p>「둘러보기 · 시작하기 · 이미 계정이 있어요」 셋이 아래에 쌓여 있었고,
 * 그중 가장 큰 것이 둘러보기였습니다 — 아직 무엇인지도 모르는 것에 이메일을
 * 내줄 이유가 없다는 이유였습니다.
 *
 * <p>그 판단이 반만 맞았습니다. 둘러보기는 이제 <b>화면 안에 이미 펼쳐져
 * 있습니다.</b> 아래 캐러셀의 카드가 곧 둘러보기이고, 누르면 그 글로 바로
 * 갑니다. 그 자리에 똑같은 일을 하는 가장 큰 단추를 또 두면, 화면에서 제일
 * 눈에 띄는 자리가 <b>이미 보이는 것을 한 번 더 가리키는 데</b> 쓰입니다.
 *
 * <p>주 동작은 하나입니다 — 시작하기. 둘러보기는 그 아래 글자 링크로
 * 남겨 둡니다(카드를 못 본 사람의 길). 로그인은 가입 화면 아래의 링크로
 * 잇습니다. 이미 계정이 있는 사람은 대개 쿠키가 살아 있어 이 화면까지
 * 오지도 않습니다.
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
 * 로그인이 살아 있으면 애초에 이 화면을 지나지도 않습니다.
 */

/**
 * 문에 세워 둘 개수.
 *
 * <p>셋이면 "여기 뭐가 쌓여 있다" 로 읽히고, 둘이면 "이것뿐이다" 로
 * 읽힙니다. 넷부터는 문이 아니라 목록이 됩니다.
 *
 * <p>가로로 눕히면서 하나를 더 받습니다. 옆으로 미는 줄은 <b>끝이 보이면
 * 밀 생각을 안 하므로</b>, 네 번째가 반쯤 걸쳐 있어야 손이 갑니다.
 *
 * <p>한 장이 곧 구글 호출 한 번이라는 것도 셈에 넣습니다. 로그인 안 한
 * 사람이 가장 자주 여는 화면이라 늘릴 자리가 아닙니다.
 */
const SHOW = 4;

/**
 * 카드 하나를 뺀 나머지 — 다음 카드가 걸쳐 보이는 폭.
 *
 * <p>좌우 여백 20씩과, 다음 카드가 28쯤 보이게 하는 값입니다. 딱 맞게
 * 끊으면 옆으로 밀 수 있다는 것을 아무도 모릅니다.
 */
const PEEK = 68;

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  /* 넓은 화면에서도 본문은 600 에서 멈춥니다(Screen). 카드 폭도 거기에
     맞춰야 캐러셀만 혼자 넓어지지 않습니다. */
  const card = Math.min(width, MaxContentWidth) - PEEK;

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
          <Button label="시작하기" onPress={() => router.push('/(auth)/register')} />
          <Button
            label="먼저 둘러볼게요"
            variant="ghost"
            onPress={() => router.push('/community')}
          />
        </>
      }>
      {/* 이름만 있는 줄입니다. 문에는 뒤로도 설정도 없습니다. */}
      <View style={styles.bar}>
        <LogoMark size={32} />
      </View>

      <View style={styles.pitch}>
        {/*
          두 줄로 끊어 둡니다.

          <p>한 줄로 두면 폰 폭에 따라 끊기는 자리가 달라져 「여행은 짜는
          동안이 제일」 까지 왔다가 넘어갑니다. 끊을 자리를 우리가 정합니다.
        */}
        <Text style={styles.headline}>
          여행은 짜는 동안이{'\n'}제일 즐거워야 하니까
        </Text>
        <Body small tone="secondary">
          일정 한 장을 여럿이 같이 고치고, 가고 싶은 곳을 모아 둬요.
        </Body>
      </View>

      {shown.length > 0 ? (
        /*
          옆으로 미는 줄입니다.

          <p>세로로 쌓아 두었습니다. 그러면 첫 장만 보이고 둘째 장부터는
          굴려야 나오는데, <b>문에서 굴리는 사람은 많지 않습니다.</b> 눕혀
          두면 한 화면에 하나 반이 보여 "더 있다" 가 그냥 보입니다.

          <p>좌우 여백만큼 밖으로 밀어 두고 그만큼을 안쪽 여백으로 돌려
          놓습니다 — 첫 카드는 글자와 같은 선에서 시작하고, 미는 카드는
          화면 끝까지 흘러갑니다.
        */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.railOut}
          contentContainerStyle={styles.rail}>
          {shown.map((post) => (
            <Peek
              key={post.id}
              post={post}
              width={card}
              onOpen={() => router.push(`/community/${post.id}`)}
            />
          ))}
        </ScrollView>
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
 *
 * <p>지도를 4:3 으로 눕힙니다. 폰에서 세로로 긴 그림은 한 장이 화면을
 * 다 먹어 "더 있다" 를 못 보여 줍니다.
 */
function Peek({
  post,
  width,
  onOpen,
}: {
  post: PostCard;
  width: number;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={{ width }}>
      {/* 지도가 안 받아지면 PostMap 이 아무것도 안 그립니다. 바탕을 깔아
          두어야 그때도 카드 모양이 남습니다. */}
      <View style={[styles.media, { height: Math.round((width * 3) / 4) }]}>
        <PostMap postId={post.id} title={post.title} height={Math.round((width * 3) / 4)} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {post.title}
      </Text>
      {/* 어디를 · 며칠. 이 둘이면 어떤 일정인지 감이 옵니다. */}
      <Caption tone="secondary" numberOfLines={1}>
        {post.region ? `${post.region} · ` : ''}
        {post.dayCount}일 · {post.placeCount}곳
      </Caption>
    </Pressable>
  );
}

/** 보여 줄 것이 없을 때만 쓰는 말. 한 줄에 하나씩. */
const POINTS = [
  '한 일정을 여럿이 함께 고쳐요.',
  '가고 싶은 곳을 보석함에 모아 둬요.',
  '남이 다녀온 길을 통째로 가져와요.',
];

const styles = StyleSheet.create({
  bar: {
    height: Tap.bar,
    justifyContent: 'center',
  },
  /* 이름 줄과 이야기 사이 24. Screen 이 자식 사이를 12 씌우므로 12 만 더합니다. */
  pitch: {
    marginTop: Spacing.s3,
    gap: Spacing.s3,
  },
  headline: {
    ...Type.display,
    fontWeight: Weight.bold,
    color: Colors.text,
  },
  /* 캐러셀 위 32 — 위와 같은 셈입니다(12 + 20). */
  railOut: {
    marginTop: Spacing.s5,
    marginHorizontal: -Gutter,
  },
  rail: {
    paddingHorizontal: Gutter,
    gap: Spacing.s3,
  },
  media: {
    width: '100%',
    borderRadius: Radius.r4,
    backgroundColor: Colors.fill,
    overflow: 'hidden',
    marginBottom: Spacing.s2,
  },
  cardTitle: {
    ...Type.headline,
    fontWeight: Weight.semibold,
    color: Colors.text,
  },
  points: {
    gap: Spacing.s2,
  },
});
