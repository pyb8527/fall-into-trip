import { Share } from 'react-native';

/**
 * 링크를 남에게 보냅니다.
 *
 * <p>앱에서는 운영체제의 공유 판을 엽니다. 어디로 보낼지는 그쪽이 정하므로
 * 우리가 메신저 목록을 들고 있을 필요가 없습니다.
 *
 * <p>웹에서는 share.web.ts 가 잡혀 브라우저 공유나 클립보드로 갑니다.
 */
export type ShareResult = 'sent' | 'copied' | 'failed';

export async function shareLink(url: string, title: string): Promise<ShareResult> {
  try {
    await Share.share({ message: url, title });
    /* 사용자가 중간에 닫았는지까지는 묻지 않습니다. 링크는 화면에도 띄워
       두므로 어느 쪽이든 다시 보낼 수 있습니다. */
    return 'sent';
  } catch {
    return 'failed';
  }
}
