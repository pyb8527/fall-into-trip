/**
 * 구글 단추 — 앱에서는 없습니다.
 *
 * <p>앱에서 구글 로그인을 하려면 네이티브 모듈이 붙고, 그것은
 * <code>expo-updates</code> 로 안 들어갑니다. EAS 재빌드가 필요하고 그건 앱
 * 작업 때 묶기로 한 것입니다.
 *
 * <p>그때까지 <b>아무것도 안 그립니다.</b> 눌러도 아무 일이 없는 단추를 두는
 * 것보다 없는 편이 낫습니다 — 예약 붙여넣기가 이미 같은 규칙을 씁니다.
 */
export function GoogleButton(_: { onCredential: (credential: string) => void }) {
  return null;
}
