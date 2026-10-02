/**
 * 얼굴 사진 한 장 고르기 (앱).
 *
 * <p>앱은 웹을 띄우는 껍데기라 이 화면들은 앱 묶음에 안 들어갑니다
 * (index.js 는 shell 하나만 실습니다). 그래도 파일이 있어야 합니다 —
 * Metro 는 불러오는 자리를 <b>실행하기 전에</b> 찾아 두므로, 짝이 없으면
 * 앱 묶음을 만드는 것 자체가 실패합니다({@code lib/pick-photo.ts} 와 같은
 * 자리입니다).
 *
 * <p>자르는 판을 띄우는 쪽은 {@code shell/pick-square.ts} 입니다. 웹이
 * 껍데기에게 부탁하면 그쪽이 expo-image-picker 를 엽니다 — 앱이 화면을
 * 직접 그리게 되는 날에는 그 함수를 여기서 그대로 부르면 됩니다.
 */
export async function pickFacePhoto(): Promise<string | null> {
  return null;
}

/** 웹 쪽 짝과 같은 모양이어야 합니다. */
export { PickError } from '@/lib/pick-photo';
