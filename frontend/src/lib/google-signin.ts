/**
 * 구글로 로그인하기 — 앱에서는 없습니다.
 *
 * <p>앱에서 구글 로그인을 하려면 네이티브 모듈이 붙고, 그것은
 * <code>expo-updates</code> 로 안 들어갑니다. EAS 재빌드가 필요하고 그건
 * 앱 작업 때 묶기로 한 것입니다.
 *
 * <p>그때까지 <b>단추를 아예 안 냅니다.</b> 눌러도 아무 일이 없는 단추를
 * 두는 것보다 없는 편이 낫습니다 — 미끄러질 자리를 안 만드는 것이
 * {@code lib/intent.ts} 가 예약 붙여넣기에 대해 이미 정한 규칙입니다.
 */

export const canSignInWithGoogle = false;

/** 웹에서만 뜹니다. 앱에서는 부를 일이 없습니다. */
export async function googleCredential(): Promise<string | null> {
  return null;
}
