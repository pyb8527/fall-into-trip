import { Stack } from 'expo-router';

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
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '여행 둘러보기' }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
