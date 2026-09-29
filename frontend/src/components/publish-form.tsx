import { StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';

import { api, ApiError, UNEXPECTED } from '@/api/client';
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
  const [feedback, setFeedback] = useState(false);

  /*
    태그.

    <p>지역과 기간은 조건이지 주제가 아닙니다. 사람들이 실제로 찾는 것은
    "도쿄 3박" 보다 "아이랑", "혼자", "미술관", "비 올 때" 같은 것들입니다.

    <p>고르는 목록을 두지 않고 직접 적습니다 — 무엇으로 묶일지는 미리 알 수
    없고, 목록을 만들어 두면 거기 없는 여행은 아무 데도 안 걸립니다. 대신
    이미 쓰인 것을 아래 보여 주어 저절로 같은 말로 모이게 합니다.
  */
  const [tags, setTags] = useState<string[]>([]);
  const [tagging, setTagging] = useState('');

  const { data: tagList } = useAsync<{ tags: { tag: string; posts: number }[] }>(
    (signal) => api.get('/api/posts/tags', signal),
    [],
  );

  /** 적은 것을 태그로 만듭니다. 서버가 다듬는 것과 같은 규칙입니다. */
  function addTag(raw: string) {
    const clean = raw.trim().replace(/^#+/, '').trim().toLowerCase();
    if (!clean || clean.length > 20 || tags.includes(clean) || tags.length >= 8) {
      setTagging('');
      return;
    }
    setTags((was) => [...was, clean]);
    setTagging('');
  }
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
    setFeedback(false);
    setFailed(null);
    setBusy(false);
  }, [visible, tripTitle]);

  async function submit() {
    if (busy) {
      return;
    }
    if (!title.trim()) {
      setFailed('제목부터 지어 주세요. 목록에서 이것만 보입니다.');
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      const res = await api.post<{ postId: string }>(`/api/trips/${tripId}/publish`, {
        title: title.trim(),
        summary: summary.trim(),
        region,
        tags,
        feedback,
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

      {/*
        태그.

        <p>지역 아래에 둡니다. 어디를 다녀왔는지 다음에 오는 것이 무엇에
        대한 여행인지이고, 둘은 함께 적는 것이 자연스럽습니다.
      */}
      <Caption tone="secondary">무엇에 대한 여행인가요?</Caption>
      {tags.length > 0 ? (
        <Row gap={Spacing.xs} style={styles.wrap}>
          {tags.map((t) => (
            /* 누르면 뺍니다. 지우는 단추를 따로 두면 태그 하나가 두 칸이
               되어 여덟 개를 달면 줄이 넘칩니다. */
            <Chip key={t} label={`${t} ✕`} selected onPress={() => setTags((was) => was.filter((x) => x !== t))} />
          ))}
        </Row>
      ) : null}
      {tags.length < 8 ? (
        <Field
          label="태그"
          value={tagging}
          onChangeText={setTagging}
          placeholder="아이랑"
          hint="여덟 개까지. 엔터로 답니다."
          returnKeyType="done"
          onSubmitEditing={() => addTag(tagging)}
        />
      ) : null}
      {/* 이미 쓰인 것들. 누르면 그대로 달립니다 — 같은 뜻을 저마다 다르게
          적으면 어느 것으로도 다 안 걸립니다. */}
      {(tagList?.tags.length ?? 0) > 0 && tags.length < 8 ? (
        <Row gap={Spacing.xs} style={styles.wrap}>
          {tagList?.tags
            .filter((t) => !tags.includes(t.tag))
            .slice(0, 12)
            .map((t) => (
              <Chip key={t.tag} label={t.tag} selected={false} onPress={() => addTag(t.tag)} />
            ))}
        </Row>
      ) : null}

      {/* 구경만 하라고 올린 글에 훈수가 달리면 반갑지 않습니다. 열어 둘
          때만 댓글칸이 생깁니다. */}
      <Caption tone="secondary">댓글을 받을까요?</Caption>
      <Row gap={Spacing.xs}>
        <Chip label="안 받기" selected={!feedback} onPress={() => setFeedback(false)} />
        <Chip label="받기" selected={feedback} onPress={() => setFeedback(true)} />
      </Row>
      <Caption tone="secondary">
        받으면 다른 사람이 일정 전체에, 또는 장소 하나하나에 댓글을 달 수 있습니다.
      </Caption>

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
