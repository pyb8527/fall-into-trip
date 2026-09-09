import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Folder } from '@/api/types';
import { Spacing } from '@/constants/theme';
import {
  Badge,
  BottomSheet,
  Button,
  Caption,
  ConfirmDialog,
  Divider,
  ErrorNote,
  Field,
  IconButton,
  ListRow,
  Row,
} from '@/ui';

/**
 * 여행을 폴더에 넣습니다.
 *
 * <p>폴더는 여행이 아니라 <b>보는 사람</b>의 것입니다. 같이 간 사람도 각자
 * 자기 식대로 정리하므로, 여기서 고른 것은 나에게만 보입니다.
 *
 * <p>폴더를 만드는 것도 여기서 합니다. 넣으려는 순간에야 "그런 폴더가 없네"
 * 를 알게 되는데, 그때 다른 화면으로 보내면 하려던 일을 잃습니다.
 */
export function FolderSheet({
  visible,
  tripId,
  tripTitle,
  current,
  onClose,
  onChanged,
}: {
  visible: boolean;
  tripId: string;
  tripTitle: string;
  /** 지금 들어 있는 폴더. 없으면 null. */
  current: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [dropping, setDropping] = useState<Folder | null>(null);

  async function load() {
    try {
      const res = await api.get<{ folders: Folder[] }>('/api/folders');
      setFolders(res.folders);
    } catch {
      /* 목록을 못 받아도 판은 열려 있어야 합니다. 새로 만들기는 됩니다. */
    }
  }

  useEffect(() => {
    if (visible) {
      setName('');
      setFailed(null);
      load();
    }
  }, [visible]);

  /**
   * 서버에 한 번 다녀옵니다.
   *
   * <p>됐는지를 돌려줍니다. 적어 둔 글을 비우는 것은 성공했을 때뿐입니다 —
   * 실패에도 비우면 길게 쓴 것이 통째로 날아가고 다시 칠 수도 없습니다.
   */
  async function run(action: () => Promise<unknown>) {
    setFailed(null);
    setBusy(true);
    try {
      await action();
      await load();
      onChanged();
      return true;
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '처리하지 못했습니다.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  /* 엔터로도 단추로도 같은 일을 합니다. 둘이 갈리면 한쪽만 고쳐 놓고
     다른 쪽은 그대로 남습니다. */
  async function makeFolder() {
    if (busy || !name.trim()) {
      return;
    }
    if (await run(() => api.post('/api/folders', { name: name.trim() }))) {
      setName('');
    }
  }

  return (
    <BottomSheet visible={visible} title="폴더에 넣기" onClose={onClose}>
      <Caption tone="secondary">
        「{tripTitle}」 를 어디에 둘까요? 폴더는 나에게만 보입니다 — 같이 간 사람은 자기 식대로
        정리합니다.
      </Caption>

      <ListRow
        title="폴더 없음"
        subtitle="목록에 그대로 둡니다"
        right={current === null ? <Badge label="여기" tone="accent" /> : undefined}
        onPress={() =>
          run(() => api.put(`/api/trips/${tripId}/folder`, {}))
        }
      />

      {folders.map((folder) => (
        <Row key={folder.id} style={styles.row}>
          <View style={styles.grow}>
            <ListRow
              title={folder.name}
              subtitle={`여행 ${folder.tripCount}개`}
              right={current === folder.id ? <Badge label="여기" tone="accent" /> : undefined}
              onPress={() =>
                run(() => api.put(`/api/trips/${tripId}/folder`, { folderId: folder.id }))
              }
            />
          </View>
          <IconButton
            name="trash-2"
            label={`${folder.name} 폴더 지우기`}
            tone="danger"
            disabled={busy}
            onPress={() => setDropping(folder)}
          />
        </Row>
      ))}

      <Divider />

      {/* 넣으려는 순간에야 "그런 폴더가 없네" 를 알게 됩니다. 그때 다른 화면으로
          보내면 하려던 일을 잃습니다. */}
      <Field
        label="새 폴더"
        value={name}
        onChangeText={setName}
        placeholder="제주 갈 때마다"
        returnKeyType="done"
        onSubmitEditing={makeFolder}
      />
      <Button label="폴더 만들기" variant="secondary" busy={busy} disabled={!name.trim()} onPress={makeFolder} />

      {failed ? <ErrorNote message={failed} /> : null}

      <ConfirmDialog
        visible={dropping !== null}
        title="폴더를 지울까요?"
        message="안에 든 여행은 그대로 남습니다. 묶어 둔 표시만 풀립니다."
        confirmLabel="지우기"
        danger
        busy={busy}
        onCancel={() => setDropping(null)}
        onConfirm={() => {
          const target = dropping;
          setDropping(null);
          if (target) {
            run(() => api.delete(`/api/folders/${target.id}`));
          }
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
});
