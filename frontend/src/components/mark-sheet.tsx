import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { PlaceMark } from '@/api/types';
import { OurPhoto } from '@/components/our-photo';
import { Spacing } from '@/constants/theme';
import { pickAndUpload } from '@/lib/pick-photo';
import { BottomSheet, Button, Caption, Chip, ErrorNote, Field, Row } from '@/ui';

/**
 * 그 자리에서 남기는 것.
 *
 * <h3>왜 찍자마자 여는가</h3>
 *
 * <p>여행기의 재료가 여기서 나옵니다. 그런데 따로 찾아 들어가게 하면 아무도
 * 안 남깁니다 — 도장은 길 위에서 걸으며 누르는 것이고, 그때 한 번 더 들어가라고
 * 하면 그걸로 끝입니다.
 *
 * <p>돌아와서 쓰라고 하면 더 안 씁니다. 그때는 무엇을 느꼈는지부터 다시
 * 떠올려야 하니까요.
 *
 * <h3>안 남기고 닫을 수 있습니다</h3>
 *
 * <p>남기는 것이 도장의 조건은 아닙니다. 그냥 찍고 지나가는 것이 여전히
 * 기본이고, 이 판은 "할 수 있다" 를 보여 줄 뿐입니다.
 */
export function MarkSheet({
  place,
  now,
  onClose,
  onSaved,
}: {
  /** 남길 곳. null 이면 판이 닫혀 있습니다. */
  place: { id: string; name: string } | null;
  /** 이미 남긴 것. 다시 열면 여기서 시작합니다. */
  now?: PlaceMark;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 판은 닫혀도 화면에 남아 있습니다. 열 때마다 지금 남아 있는 것으로
     되돌려 놓지 않으면, 앞 장소에 적은 것이 다음 장소에 그대로 뜹니다. */
  useEffect(() => {
    if (place) {
      setPhotoId(now?.photoId ?? null);
      setStars(now?.stars ?? 0);
      setNote(now?.note ?? '');
      setFailed(null);
    }
    /* place 가 바뀔 때만 봅니다 — now 는 새로 읽을 때마다 새 객체라 여기
       넣으면 적는 동안 계속 되돌려집니다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id]);

  async function choose() {
    setFailed(null);
    setPicking(true);
    try {
      const got = await pickAndUpload();
      if (got) {
        setPhotoId(got);
      }
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : '사진을 올리지 못했어요.');
    } finally {
      setPicking(false);
    }
  }

  async function save() {
    if (!place || busy) {
      return;
    }
    setFailed(null);
    setBusy(true);
    try {
      await api.put(`/api/visits/${place.id}`, {
        /* 빈 문자열과 0 이 지우기입니다. null 은 "그대로 두기" 라서, 지운
           것을 서버에 알리려면 빈 값을 보내야 합니다. */
        photoId: photoId ?? '',
        stars,
        note: note.trim(),
      });
      onSaved();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={place !== null}
      title={place ? `${place.name} 에 남기기` : ''}
      onClose={onClose}
      footer={<Button label="남기기" onPress={save} busy={busy} />}>
      <Caption tone="secondary">
        나중에 여행기로 옮겨져요. 안 남기고 닫아도 도장은 그대로예요.
      </Caption>

      {photoId ? (
        <OurPhoto id={photoId} height={200} />
      ) : null}
      <Row gap={Spacing.sm}>
        <Button
          label={photoId ? '사진 바꾸기' : '사진 고르기'}
          variant="secondary"
          compact
          busy={picking}
          onPress={choose}
        />
        {photoId ? (
          <Button label="사진 빼기" variant="ghost" compact onPress={() => setPhotoId(null)} />
        ) : null}
      </Row>

      {/*
        별.

        <p>누른 것을 다시 누르면 지워집니다. 지우는 길이 없으면 잘못 누른 것을
        되돌릴 수 없고, 그러면 안 매기느니만 못합니다.
      */}
      <Caption tone="secondary">어땠어요?</Caption>
      <Row gap={Spacing.xs} style={styles.wrap}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Chip
            key={n}
            label={'★'.repeat(n)}
            selected={stars === n}
            onPress={() => setStars(stars === n ? 0 : n)}
          />
        ))}
      </Row>

      <Field
        label="한 줄"
        value={note}
        onChangeText={setNote}
        placeholder="국물이 진해요"
        hint="200자까지. 비워도 돼요."
      />

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexWrap: 'wrap',
  },
});
