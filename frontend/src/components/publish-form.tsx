import { StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import { useAsync } from '@/api/use-async';
import { PostFields, type PostShape } from '@/components/post-fields';
import { Spacing } from '@/constants/theme';
import { BottomSheet, Button, Caption, Chip, ErrorNote, Row } from '@/ui';

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
  /*
    겉에 적는 것들.

    <p>고치는 판과 같은 칸을 씁니다(components/post-fields) — 올릴 때 적는
    것과 고칠 때 적는 것이 같은데 두 군데에 적어 두면 한쪽만 고치는 날이
    옵니다.
  */
  const [shape, setShape] = useState<PostShape>({
    title: tripTitle,
    summary: '',
    region: null,
    tags: [],
    feedback: false,
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 고를 수 있는 지역은 서버가 정합니다. 여기 따로 적어 두면 언젠가 어긋나고,
     어긋나면 고른 값이 저장은 되는데 목록에서 아무것도 안 걸립니다. */
  /*
    어느 날을 올릴지.

    <p>올리는 것이 여행 전체뿐이었습니다. 그런데 닷새 중 하루만 잘 짜인
    날이 있고 나머지는 이동과 쉬는 날인 경우가 흔합니다. 그 하루를 보여
    주려고 닷새를 통째로 올리면 보는 사람은 나흘을 지나쳐야 합니다.

    <p>기본은 전부입니다 — 지금까지의 동작이고, 대개 그것이 맞습니다.
  */
  const [pickedDays, setPickedDays] = useState<string[]>([]);

  const { data: tripDays } = useAsync<{ days: { id: string; label: string; date: string | null }[] }>(
    (signal) =>
      api
        .get<{ days: { id: string; label: string; date: string | null }[] }>(
          `/api/trip?trip=${encodeURIComponent(tripId)}`,
          signal,
        )
        .then((t) => ({ days: t.days })),
    [tripId],
  );

  /* 판은 닫혀도 화면에 남아 있어 처음 잡은 값이 다음에 열 때도 그대로입니다. */
  useEffect(() => {
    if (!visible) {
      return;
    }
    setShape({ title: tripTitle, summary: '', region: null, tags: [], feedback: false });
    setFailed(null);
    setBusy(false);
  }, [visible, tripTitle]);

  async function submit() {
    if (busy) {
      return;
    }
    if (!shape.title.trim()) {
      setFailed('제목부터 지어 주세요. 목록에서 이것만 보여요.');
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      const res = await api.post<{ postId: string }>(`/api/trips/${tripId}/publish`, {
        title: shape.title.trim(),
        summary: shape.summary.trim(),
        region: shape.region,
        tags: shape.tags,
        days: pickedDays,
        feedback: shape.feedback,
      });
      onDone(res.postId);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="둘러보기에 내놓기"
      onClose={onCancel}
      footer={<Button label="내놓기" onPress={submit} busy={busy} />}>
      <Caption tone="secondary">
        지금 일정이 그대로 복사되어 올라가요. 나중에 일정을 고쳐도 올린 글은 바뀌지 않아요.
        고친 것을 보여 주려면 내리고 다시 올려 주세요.
      </Caption>
      <Caption tone="secondary">
        누가 다녀왔는지, 동행자가 누구인지는 올라가지 않아요. 날짜와 장소만 가요.
      </Caption>

      {/*
        어느 날을 올릴지.

        <p>날이 둘 이상일 때만 냅니다. 하루짜리 여행에 "전부" 와 "1일차" 를
        나란히 두면 고를 것이 없는 줄이 하나 생깁니다.
      */}
      {(tripDays?.days.length ?? 0) > 1 ? (
        <>
          <Caption tone="secondary">어느 날을 올릴까요?</Caption>
          <Row gap={Spacing.xs} style={styles.wrap}>
            <Chip
              label="전부"
              selected={pickedDays.length === 0}
              onPress={() => setPickedDays([])}
            />
            {tripDays?.days.map((d) => (
              <Chip
                key={d.id}
                label={d.date || d.label}
                selected={pickedDays.includes(d.id)}
                onPress={() =>
                  setPickedDays((was) =>
                    was.includes(d.id) ? was.filter((x) => x !== d.id) : [...was, d.id],
                  )
                }
              />
            ))}
          </Row>
        </>
      ) : null}

      <PostFields value={shape} onChange={setShape} />

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  /* 태그가 여덟이면 한 줄에 안 섭니다. 접히게 둡니다 — 옆으로 흘리면
     오른쪽에 뭐가 더 있는지 안 보입니다. */
  wrap: {
    flexWrap: 'wrap',
  },
});
