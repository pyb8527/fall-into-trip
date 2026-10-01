import { Stack } from 'expo-router';

import { useWide } from '@/ui/layout';
import { stackHeader } from '@/ui/nav';

/**
 * 게시판.
 *
 * <p>로그인을 요구하지 않습니다. 남의 일정을 구경하러 왔다가 가입하는
 * 흐름이라, 처음부터 막으면 아무도 들어오지 않습니다. 추천이나 복제처럼
 * 누가 했는지 세야 하는 것만 그때 로그인을 요구합니다.
 */

/**
 * 주소로 곧장 글 하나를 열었을 때 밑에 깔아 둘 화면.
 *
 * <p>공유 링크를 타고 들어오는 일이 잦은 화면이라, 없으면 뒤로 갈 데가
 * 없습니다.
 */
export const unstable_settings = { anchor: 'index' };

export default function CommunityLayout() {
  /* 둘 다 아래 갈래 띠를 답니다. 넓은 화면에서 그 띠가 왼쪽 기둥으로
     서므로 본문과 막대가 그만큼 비켜 앉습니다(ui/nav 의 rail). */
  const wide = useWide();

  return (
    <Stack>
      {/* 둘러보기는 계정 없이도 열립니다. 그래서 위층도 홈이 아니라
          둘러보기 목록입니다 — 글을 읽다가 뒤로를 눌렀는데 로그인 화면이
          뜨면 그게 막다른 길입니다. */}
      <Stack.Screen name="index" options={stackHeader('여행 둘러보기', { rail: wide })} />
      <Stack.Screen name="[id]" options={stackHeader('', { up: '/community', rail: wide })} />
    </Stack>
  );
}
