import { useState } from 'react';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import { ConfirmDialog } from '@/ui';

/**
 * 「이 사람 차단」을 누르면 뜨는 창.
 *
 * <h3>왜 한 벌로 두나</h3>
 *
 * <p>막는 자리가 다섯입니다 — 피드 글 · 여행기 · 댓글 · 한 줄 팁 · 프로필.
 * 자리마다 창을 적으면 「무엇이 달라지는지」 말이 자리마다 조금씩 달라지고,
 * 그 말이 이 일의 전부입니다. 막기 전에 사람이 알아야 할 것은 셋입니다.
 *
 * <ul>
 *   <li>서로의 글이 안 보인다</li>
 *   <li><b>함께 쓰던 여행과 모임은 그대로</b>다 — 여행은 여럿이 함께 쓰는
 *       것이라 둘로 가르지 않습니다. 이것을 안 적으면 막고 나서 같은 일정
 *       안에서 그 사람을 보고 「안 막혔다」고 여깁니다</li>
 *   <li>상대에게 알리지 않는다 — 망설이는 까닭이 대개 이것입니다</li>
 * </ul>
 *
 * <p>브라우저의 확인 창을 쓰지 않습니다. 앱과 웹에서 모양이 다르고, 앱
 * 껍데기 안에서는 아예 안 뜨는 기기가 있습니다.
 *
 * @param person  막을 사람. 비어 있으면 창이 닫혀 있습니다
 * @param onDone  막은 뒤. 부른 쪽이 목록을 다시 읽거나 화면을 닫습니다
 * @param onFailed 서버가 거절했으면 그 말. 부른 쪽의 오류 자리에 적습니다
 */
export function BlockDialog({
  person,
  onCancel,
  onDone,
  onFailed,
}: {
  person: { id: string; name: string } | null;
  onCancel: () => void;
  onDone: () => void;
  onFailed: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function block(id: string) {
    setBusy(true);
    try {
      await api.post(`/api/users/${encodeURIComponent(id)}/block`, {});
      onDone();
    } catch (e) {
      onFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      visible={person !== null}
      title={person ? `${person.name} 님을 차단할까요?` : ''}
      message="서로의 글 · 댓글 · 한 줄이 안 보이고, 내가 만든 초대 링크로 들어오지 못해요. 함께 쓰던 여행과 모임은 그대로예요. 상대에게는 알리지 않아요."
      confirmLabel="차단"
      danger
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => {
        if (person) {
          block(person.id);
        }
      }}
    />
  );
}
