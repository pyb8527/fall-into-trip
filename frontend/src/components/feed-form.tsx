import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { FeedPost, TripSummary } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { OurPhoto } from '@/components/our-photo';
import { Spacing } from '@/constants/theme';
import { PickError, pickAndUpload } from '@/lib/pick-photo';
import {
  BottomSheet,
  Button,
  Caption,
  Chip,
  ErrorNote,
  Field,
  IconButton,
  Row,
} from '@/ui';

/**
 * 피드에 올리는 판.
 *
 * <h3>사진만 올려도, 글만 써도 됩니다</h3>
 *
 * <p>둘 다 비면 못 올립니다. 그 밖에는 아무것도 안 받습니다 — 제목도 지역도
 * 공개 범위도 없습니다. 올리는 데 드는 품이 사진 고르기 하나여야 합니다.
 *
 * <h3>태그는 적는 대로</h3>
 *
 * <p>고르는 목록을 두지 않습니다. 무엇으로 묶일지는 미리 알 수 없고, 목록을
 * 만들어 두면 거기 없는 이야기는 아무 데도 안 걸립니다.
 *
 * <h3>같은 판으로 고칩니다</h3>
 *
 * <p>칸이 두 벌이 되면 한쪽만 고치는 날이 옵니다.
 */

/** 서버 FeedService 의 한도와 같아야 합니다. */
const MAX_PHOTOS = 10;

/**
 * 고른 사진을 늘어놓는 네모의 한 변.
 *
 * <p>폭을 못 박습니다. {@link OurPhoto} 는 폭을 안 주면 100% 를 쓰는데, 폭이
 * 정해지지 않은 칸 안에서 100% 는 0 입니다 — 사진이 올라갔는데도 미리보기
 * 자리가 실오라기처럼 보였습니다.
 *
 * <p>네모로 둡니다. 가로세로가 제각각이면 줄이 들쭉날쭉해지고, 여기서 보려는
 * 것은 「무엇을 골랐나」이지 사진의 생김새가 아닙니다.
 */
const THUMB = 88;
const MAX_TEXT = 2000;
const MAX_TAGS = 5;

export function FeedForm({
  visible,
  /** 모임에 올리면 그 모임. 안 주면 내 피드입니다. */
  groupId,
  groupName,
  /** 고치는 중이면 그 글. 안 주면 새로 쓰는 것입니다. */
  post,
  onClose,
  onDone,
}: {
  visible: boolean;
  groupId?: string | null;
  groupName?: string | null;
  post?: FeedPost | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const editing = post != null;

  const [text, setText] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [tripId, setTripId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /*
    고를 수 있는 여행.

    <p>모임에 올리는 글이면 <b>그 모임의 여행만</b> 나옵니다. 안 그러면 모임
    사람들에게 그들이 못 보는 여행 이름이 글마다 붙어 뜹니다. 서버도 같은
    것을 봅니다.
  */
  const { data: tripData } = useAsync<{ trips: TripSummary[] }>(
    (signal) => (visible ? api.get('/api/trips', signal) : Promise.resolve({ trips: [] })),
    [visible],
  );
  const trips = (tripData?.trips ?? []).filter((t) =>
    groupId ? t.groupId === groupId : t.groupId == null,
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setText(post?.text ?? '');
    setPhotoIds(post?.photoIds ?? []);
    setTags(post?.tags ?? []);
    setTagDraft('');
    setTripId(post?.tripId ?? null);
    setError(null);
    setNotice(null);
    setBusy(false);
  }, [visible, post]);

  async function addPhotos() {
    const room = MAX_PHOTOS - photoIds.length;
    if (room <= 0) {
      setError(`사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요.`);
      return;
    }
    setPicking(true);
    setError(null);
    setNotice(null);
    try {
      const got = await pickAndUpload(room);
      if (got.ids.length > 0) {
        setPhotoIds([...photoIds, ...got.ids]);
      }
      /* 몇 장이 왜 안 들어갔는지 말해 줍니다 — 아홉 장을 골랐는데 일곱만
         뜨면, 말해 주지 않는 한 고른 사람은 모릅니다. */
      const said: string[] = [];
      if (got.skipped > 0) {
        said.push(`자리가 모자라 ${got.skipped}장은 안 올렸어요.`);
      }
      if (got.failed > 0) {
        said.push(`${got.failed}장은 올리다 실패했어요.`);
      }
      setNotice(said.length > 0 ? said.join(' ') : null);
    } catch (e) {
      setError(e instanceof PickError || e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setPicking(false);
    }
  }

  function addTag() {
    const clean = tagDraft.trim().replace(/^#+/, '').trim().toLowerCase();
    if (!clean) {
      return;
    }
    if (tags.includes(clean)) {
      setTagDraft('');
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setError(`태그는 ${MAX_TAGS}개까지예요.`);
      return;
    }
    setTags([...tags, clean]);
    setTagDraft('');
  }

  async function submit() {
    if (busy) {
      return;
    }
    if (!text.trim() && photoIds.length === 0) {
      setError('사진을 고르거나 한 줄 적어 주세요.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = { text: text.trim(), tags, photoIds, tripId: tripId ?? '' };
      if (editing) {
        await api.patch(`/api/feed/${encodeURIComponent(post.id)}`, body);
      } else {
        await api.post('/api/feed', { ...body, groupId: groupId ?? null });
      }
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  const where = editing ? '글 고치기' : groupName ? `${groupName}에 올리기` : '내 피드에 올리기';

  return (
    <BottomSheet
      visible={visible}
      title={where}
      onClose={onClose}
      footer={<Button label={editing ? '저장' : '올리기'} onPress={submit} busy={busy} />}>
      <Row gap={Spacing.s2} style={styles.wrap}>
        {photoIds.map((id) => (
          <View key={id} style={styles.shot}>
            <OurPhoto id={id} width={THUMB} height={THUMB} />
            <View style={styles.pull}>
              /* 사진 위에 얹히는 단추라 바탕 없이 둡니다 — 회색 네모를 두르면
                 그 네모가 사진의 일부처럼 보입니다. */
              <IconButton
                name="x"
                label="이 사진 빼기"
                tone="danger"
                bare
                onPress={() => setPhotoIds(photoIds.filter((x) => x !== id))}
              />
            </View>
          </View>
        ))}
      </Row>

      <Button
        label={photoIds.length > 0 ? `사진 더 고르기 (${photoIds.length}/${MAX_PHOTOS})` : '사진 고르기'}
        variant="secondary"
        busy={picking}
        onPress={addPhotos}
      />
      {notice ? <Caption tone="secondary">{notice}</Caption> : null}

      <Field
        label="무슨 일이 있었나요?"
        value={text}
        onChangeText={setText}
        placeholder="이번 오사카 진짜 좋았다"
        maxLength={MAX_TEXT}
        multiline
        hint="사진만 올려도 돼요."
      />

      <Caption strong tone="secondary">태그</Caption>
      {tags.length > 0 ? (
        <Row gap={Spacing.s2} style={styles.wrap}>
          {tags.map((t) => (
            <Chip key={t} label={`#${t}`} selected onPress={() => setTags(tags.filter((x) => x !== t))} />
          ))}
        </Row>
      ) : null}
      <Row gap={Spacing.s2}>
        <View style={styles.grow}>
          <Field
            label="태그 달기"
            value={tagDraft}
            onChangeText={setTagDraft}
            placeholder="라멘"
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={addTag}
          />
        </View>
        <Chip label="추가" selected={tagDraft.trim().length > 0} onPress={addTag} />
      </Row>

      {trips.length > 0 ? (
        <>
          <Caption tone="secondary">어느 여행 이야기예요? 안 골라도 돼요.</Caption>
          <Row gap={Spacing.s2} style={styles.wrap}>
            <Chip label="안 고름" selected={tripId === null} onPress={() => setTripId(null)} />
            {trips.map((t) => (
              <Chip
                key={t.id}
                label={t.title}
                selected={tripId === t.id}
                onPress={() => setTripId(tripId === t.id ? null : t.id)}
              />
            ))}
          </Row>
        </>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexWrap: 'wrap',
  },
  shot: {
    position: 'relative',
    width: THUMB,
    height: THUMB,
  },
  /* 빼는 단추는 사진 위 오른쪽. 사진마다 줄을 따로 두면 아홉 장에 아홉
     줄이 생깁니다. */
  pull: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
  },
});
