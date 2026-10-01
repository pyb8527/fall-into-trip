import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import { OurPhoto } from '@/components/our-photo';
import { Radius, Spacing } from '@/constants/theme';
import { PickError, pickAndUpload } from '@/lib/pick-photo';
import { BottomSheet, Button, Caption, ErrorNote, Icon } from '@/ui';

/** 서버와 같은 수입니다(VisitService.MAX_PHOTOS). */
const MAX_PHOTOS = 5;

/**
 * 그리드 한 칸의 한 변.
 *
 * <p>못 박아 둡니다. 비율로 두면 {@link OurPhoto} 가 높이를 숫자로 받아야
 * 해서 네모가 안 되고, 재서 쓰면 판이 열릴 때 한 번 깜빡입니다.
 */
const CELL = 96;

/**
 * 다니면서 볼 사진.
 *
 * <h3>기록과 왜 가르는가</h3>
 *
 * <p>같은 장소에 붙는 사진이라도 둘은 전혀 다른 것입니다. 메뉴판 사진,
 * 예매 화면, 가는 길 지도는 <b>다니려고</b> 넣는 것이지 남에게 보이려고
 * 넣는 것이 아닙니다.
 *
 * <p>한 칸에 담아 두면 여행기를 올릴 때 따라갑니다 — 남이 읽는 글에 내
 * 예매 QR 이 실립니다. 그래서 칸을 가르고, 올릴 때는 기록 쪽만 싣습니다.
 *
 * <h3>도장과 상관없습니다</h3>
 *
 * <p>가기 <b>전에</b> 넣어 두는 것입니다. 다녀와야 넣을 수 있으면 쓸모가
 * 없습니다.
 */
export function RefSheet({
  place,
  now,
  onClose,
  onSaved,
}: {
  /** 챙겨 둘 곳. null 이면 판이 닫혀 있습니다. */
  place: { id: string; name: string } | null;
  /** 이미 챙겨 둔 것. */
  now?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 판은 닫혀도 화면에 남아 있습니다. 열 때마다 되돌려 놓지 않으면 앞
     장소에 넣은 것이 다음 장소에 그대로 뜹니다. */
  useEffect(() => {
    if (place) {
      setPhotoIds(now ?? []);
      setFailed(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id]);

  async function choose() {
    const room = MAX_PHOTOS - photoIds.length;
    if (room <= 0) {
      return;
    }
    setFailed(null);
    setPicking(true);
    try {
      const got = await pickAndUpload(room);
      if (got.ids.length > 0) {
        setPhotoIds((was) => [
          ...was,
          ...got.ids.filter((id) => !was.includes(id)).slice(0, MAX_PHOTOS - was.length),
        ]);
      }
      if (got.failed > 0) {
        setFailed(`${got.failed}장은 올리지 못했어요. 다시 해 보세요.`);
      } else if (got.skipped > 0) {
        setFailed(`한 곳에 ${MAX_PHOTOS}장까지라 ${got.skipped}장은 안 넣었어요.`);
      }
    } catch (e) {
      /* PickError 는 무엇을 하면 되는지까지 담은 말입니다. 뭉개면 그 말이
         사라지고 「사진을 올리지 못했어요」만 남습니다. */
      setFailed(
        e instanceof ApiError || e instanceof PickError
          ? e.message
          : '사진을 올리지 못했어요.',
      );
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
      /* 보낸 목록이 곧 이 장소의 참고 사진입니다. 뺀 것은 여기 없으니
         서버에서도 떨어집니다. */
      await api.put(`/api/visits/${place.id}/refs`, { photoIds });
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
      title={place ? `${place.name} — 챙겨 두기` : ''}
      onClose={onClose}
      footer={<Button label="챙겨 두기" onPress={save} busy={busy} strong />}>
      <Caption tone="secondary">
        메뉴판, 예매 화면, 가는 길 지도처럼 다니면서 볼 것을 넣어 두세요.
      </Caption>
      <Caption tone="muted">여행기에는 안 실려요. 여행 피드에서 꺼내 볼 수 있어요.</Caption>

      {/*
        그리드 세 칸.

        <p>한 장을 200 높이로 세로로 쌓고 있었습니다. 다섯 장이면 1000픽셀이라
        판을 끝까지 올려도 다 안 보이고, 무엇보다 <b>넣어 둔 것을 확인하는</b>
        자리인데 확인하려면 한참 굴려야 했습니다. 챙겨 둔 사진은 다니면서
        꺼내 볼 것이지 여기서 감상할 것이 아닙니다 — 작은 네모로 늘어놓으면
        무엇이 몇 장 들었는지가 한눈에 보입니다.
      */}
      {photoIds.length > 0 ? (
        <View style={styles.grid}>
          {photoIds.map((id, at) => (
            <View key={id} style={styles.shot}>
              <OurPhoto id={id} width={CELL} height={CELL} />
              <Pressable
                style={styles.drop}
                onPress={() => setPhotoIds((was) => was.filter((one) => one !== id))}
                accessibilityLabel={`${at + 1}번째 사진 빼기`}>
                <Icon name="x" size={18} tone="inverse" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {photoIds.length < MAX_PHOTOS ? (
        <Button
          label={
            photoIds.length === 0
              ? `사진 고르기 (${MAX_PHOTOS}장까지)`
              : `더 넣기 (${photoIds.length}/${MAX_PHOTOS})`
          }
          variant="secondary"
          busy={picking}
          onPress={choose}
        />
      ) : (
        <Caption tone="secondary">한 곳에 {MAX_PHOTOS}장까지예요.</Caption>
      )}

      {failed ? <ErrorNote message={failed} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  /* 세 칸씩. 가장 좁은 폰(360)에서도 판 안쪽 여백 20을 떼고 셋이 듭니다. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.s2,
  },
  shot: {
    position: 'relative',
  },
  drop: {
    position: 'absolute',
    top: Spacing.s1,
    right: Spacing.s1,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    /* 사진 위에 얹히므로 바탕을 깝니다. */
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
