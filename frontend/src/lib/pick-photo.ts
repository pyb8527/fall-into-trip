/**
 * 사진 고르기 (앱).
 *
 * <p>앱은 웹을 띄우는 껍데기라 이 화면들은 앱 묶음에 안 들어갑니다
 * (index.js 는 shell 하나만 실습니다). 그래도 파일이 있어야 합니다 —
 * Metro 는 불러오는 자리를 <b>실행하기 전에</b> 찾아 두므로, 짝이 없으면
 * 앱 묶음을 만드는 것 자체가 실패합니다.
 *
 * <p>언젠가 앱이 화면을 직접 그리게 되면 여기에 expo-image-picker 가
 * 들어옵니다.
 */
/* room 은 웹 쪽 짝과 모양을 맞추려고 받습니다. 여기서는 아무것도 안
   고르므로 쓸 일이 없습니다. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function pickAndUpload(room = 1): Promise<Pick> {
  return { ids: [], skipped: 0, failed: 0 };
}

/** 웹 쪽 {@link import('./pick-photo.web').Pick} 와 같은 모양이어야 합니다. */
export class PickError extends Error {}

export type Pick = {
  ids: string[];
  skipped: number;
  failed: number;
};
