import { useEffect, useState } from 'react';

import { api, ApiError } from '@/api/client';
import { useAsync } from '@/api/use-async';
import { Spacing } from '@/constants/theme';
import { BottomSheet, Button, Caption, Chip, ErrorNote, Field, Row } from '@/ui';

/**
 * 내 일정을 게시판에 올립니다.
 *
 * <p>올리는 순간의 일정이 <b>사본</b>으로 떠집니다. 올린 뒤에 장소를 고치거나
 * 여행을 지워도 글은 그대로 남습니다. 반대로 고친 내용을 보여 주고 싶으면
 * 내리고 다시 올려야 합니다. 화면에 그렇게 적어 둡니다 — 안 적으면 고쳤는데
 * 왜 글이 그대로냐는 말이 나옵니다.
 */
export function PublishForm({
  visible,
  tripId,
  tripTitle,
  onDone,
  onCancel,
}: {
  visible: boolean;
  tripId: string;
  tripTitle: string;
  onDone: (postId: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(tripTitle);
  const [summary, setSummary] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 고를 수 있는 지역은 서버가 정합니다. 여기 따로 적어 두면 언젠가 어긋나고,
     어긋나면 고른 값이 저장은 되는데 목록에서 아무것도 안 걸립니다. */
  const { data: regionList } = useAsync<{ regions: string[] }>(
    (signal) => api.get('/api/posts/regions', signal),
    [],
  );

  /* 판은 닫혀도 화면에 남아 있어 처음 잡은 값이 다음에 열 때도 그대로입니다. */
  useEffect(() => {
    if (!visible) {
      return;
    }
    setTitle(tripTitle);
    setSummary('');
    setRegion(null);
    setFailed(null);
    setBusy(false);
  }, [visible, tripTitle]);

  async function submit() {
    if (busy) {
      return;
    }
    if (!title.trim()) {
      setFailed('제목을 넣어 주세요.');
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      const res = await api.post<{ postId: string }>(`/api/trips/${tripId}/publish`, {
        title: title.trim(),
        summary: summary.trim(),
        region,
      });
      onDone(res.postId);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '올리지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="게시판에 올리기"
      onClose={onCancel}
      footer={<Button label="올리기" onPress={submit} busy={busy} />}>
      <Caption tone="secondary">
        지금 일정이 그대로 복사되어 올라갑니다. 나중에 일정을 고쳐도 올린 글은 바뀌지 않습니다.
        고친 것을 보여 주려면 내리고 다시 올려 주세요.
      </Caption>
      <Caption tone="secondary">
        누가 다녀왔는지, 동행자가 누구인지는 올라가지 않습니다. 날짜와 장소만 갑니다.
      </Caption>

      <Field label="제목" value={title} onChangeText={setTitle} placeholder="도쿄 3박 4일" />
      <Field
        label="한 줄 소개"
        value={summary}
        onChangeText={setSummary}
        placeholder="먹으러만 다닌 일정입니다"
        hint="목록에서 이 줄이 보입니다. 비워도 됩니다."
      />

      {/* 지역은 안 골라도 올라갑니다. 다만 지역으로 거를 때 안 걸립니다. */}
      <Caption tone="secondary">어디로 다녀오셨나요?</Caption>
      <Row gap={Spacing.xs}>
        {regionList?.regions.map((r) => (
          <Chip
            key={r}
            label={r}
            selected={region === r}
            onPress={() => setRegion(region === r ? null : r)}
          />
        ))}
      </Row>

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}
