import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * 그 사람 페이지로.
 *
 * <p>사람 이름과 얼굴이 앱 곳곳에 있었는데 어디서도 그 사람에게 갈 수
 * 없었습니다(plan-review H-2). 부르는 자리마다 주소를 적으면 언젠가 한 곳이
 * 다르게 적힙니다 — 여기 하나로 모읍니다.
 *
 * <p>나면 번호 없이 내 페이지입니다. 남이면 같은 화면에 번호를 실어 보냅니다.
 * 같은 모임이 아니면 서버가 404 로 막습니다 — 이름이 보이는 자리는 대개 같은
 * 모임 안이라 막힐 일이 드뭅니다.
 */
export function openPerson(router: Router, userId: string | null | undefined, meId?: string | null) {
  if (!userId) {
    return;
  }
  if (meId && userId === meId) {
    router.push('/(app)/me');
    return;
  }
  router.push({ pathname: '/(app)/me', params: { id: userId } });
}
