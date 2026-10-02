import { useEffect, useState } from 'react';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Group } from '@/api/types';
import { FacePicker, type FaceMark } from '@/components/face-picker';
import { BottomSheet, Button, Caption, Divider, ErrorNote, Field } from '@/ui';

/**
 * 모임을 만들거나 고치는 판.
 *
 * <h3>이름 하나로 끝나야 합니다</h3>
 *
 * <p>사람을 부르는 길이 이제 모임 하나입니다. 그래서 「이번 여행만 같이 짜는
 * 동료」에게도 모임을 만들어야 하고, 그러려면 만드는 일이 가벼워야 합니다.
 * 설명과 표식은 안 적어도 됩니다.
 *
 * <p>같은 판으로 고칩니다. 만들기와 고치기에 다른 판을 두면 칸이 두 벌이
 * 되고, 한쪽만 고치는 날이 옵니다.
 */

/** 서버 GroupService 의 이름 길이와 같아야 합니다. */
const MAX_NAME = 40;
const MAX_ABOUT = 200;

/**
 * 고를 수 있는 표식.
 *
 * <p>자판을 열어 이모지를 찾게 하면 대개 안 고릅니다. 모임에 어울릴 만한
 * 것 몇 개만 늘어놓고, 거기 없으면 안 답니다 — 표식은 목록에서 모임을
 * 가리기 위한 것이고, 그 일은 이 정도로 됩니다.
 *
 * <p>서버에 가는 값이 이모지 그대로입니다. 사람 쪽은 짧은 이름("rabbit")만
 * 저장하고 그림은 화면이 정하는데({@code user-marks}), 모임 표식은 목록이
 * 열 개라 그 가름까지 둘 값이 아닙니다. 그래서 {@code key} 와 {@code glyph}
 * 가 같습니다.
 */
const EMOJIS = ['🧳', '🥾', '🏕️', '🍜', '📚', '🎞️', '🚲', '🎿', '⛰️', '🏖️'];

const MARKS: FaceMark[] = EMOJIS.map((one) => ({
  key: one,
  glyph: one,
  label: `표식 ${one}`,
}));

export function GroupForm({
  visible,
  /** 고치는 중이면 그 모임. 안 주면 새로 만드는 것입니다. */
  group,
  onClose,
  onDone,
  onDelete,
}: {
  visible: boolean;
  group?: Group | null;
  onClose: () => void;
  onDone: (group: Group) => void;
  /**
   * 모임 지우기. 만든 사람이 고칠 때만 줍니다.
   *
   * <p>모임 화면 맨 아래에 빨간 줄로 서 있었습니다. 지우는 것은 모임을
   * 다루는 일이라 편집 판 맨 아래, 선 하나 건너에 둡니다. 빨강은 「정말
   * 지울까요」의 확인 단추에만 남습니다.
   */
  onDelete?: () => void;
}) {
  const editing = group != null;

  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* 판은 닫혀도 미끄러져 내려가는 동안 화면에 남아 있어, 처음 적은 값이
     다음에 열 때도 그대로입니다. 열릴 때마다 맞춰 둡니다. */
  useEffect(() => {
    if (!visible) {
      return;
    }
    setName(group?.name ?? '');
    setAbout(group?.about ?? '');
    setEmoji(group?.emoji ?? null);
    setPhotoId(group?.coverPhotoId ?? null);
    setError(null);
    setBusy(false);
  }, [visible, group]);

  async function submit() {
    const clean = name.trim();
    if (busy) {
      return;
    }
    if (!clean) {
      setError('모임 이름부터 지어 주세요. 나중에 바꿔도 돼요.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      /* 비우는 것은 빈 글입니다. null 을 보내면 서버가 「손대지 않음」으로
         읽어, 적어 둔 설명을 지울 길이 없습니다. */
      const body = {
        name: clean,
        about: about.trim(),
        emoji: emoji ?? '',
        coverPhotoId: photoId ?? '',
      };
      let made: Group;
      if (editing) {
        made = (await api.patch<{ group: Group }>(`/api/groups/${group.id}`, body)).group;
      } else {
        made = (await api.post<{ group: Group }>('/api/groups', body)).group;
        /*
          만들 때는 얼굴을 한 번 더 보냅니다.

          <p>{@code POST /api/groups} 가 이름·설명·표식만 받습니다
          (GroupController.CreateRequest). 서버가 그 자리에 얼굴을 받게 되면
          이 두 번째 부름은 지웁니다 — 그때까지 모임 하나 만드는 데 두
          번 다녀오는 것이, 사진을 골라 놓고 조용히 버려지는 것보다
          낫습니다.
        */
        if (photoId) {
          made = (await api.patch<{ group: Group }>(`/api/groups/${made.id}`, body)).group;
        }
      }

      /*
        바꿔 끼운 뒤에 옛 장을 지웁니다.

        <p>얼굴 사진도 사람당 1000장에 들어갑니다. 얼굴은 바꾸는 것이라
        그대로 두면 바꾼 횟수만큼 묵은 장이 쌓입니다.

        <p><b>저장이 끝난 뒤에</b> 지웁니다. 고르는 자리에서 바로 지우면
        판을 저장 안 하고 닫은 사람의 모임 얼굴이 깨집니다 — 서버는 아직
        옛 장을 가리키고 있는데 그 장이 없어진 상태입니다.

        <p>실패해도 그냥 둡니다. 지우지 못한 한 장은 그 사람 몫 하나를
        먹는 것이 전부이고, 저장은 이미 끝났습니다.
      */
      const dropped = group?.coverPhotoId;
      if (dropped && dropped !== photoId) {
        api.delete(`/api/photos/${dropped}`).catch(() => {});
      }

      onDone(made);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={editing ? '모임 고치기' : '새 모임'}
      onClose={onClose}
      footer={<Button label={editing ? '저장' : '만들기'} onPress={submit} busy={busy} />}>
      {editing ? null : (
        <Caption tone="secondary">
          여행은 모임 안에서 만들어요. 모임 사람이면 누구나 일정을 고칠 수 있어요.
        </Caption>
      )}

      <Field
        label="이름"
        value={name}
        onChangeText={setName}
        placeholder="토요일 등산"
        maxLength={MAX_NAME}
      />

      <Field
        label="어떤 모임인지"
        value={about}
        onChangeText={setAbout}
        placeholder="매주 토요일 아침에 가까운 산"
        maxLength={MAX_ABOUT}
        multiline
        hint="안 적어도 돼요."
      />

      {/*
        얼굴.

        <p>표식만 고르는 자리였습니다. 칩으로 늘어놓고 있다가 네모 타일로
        바꿨는데 — 칩은 <b>글자</b>를 고르는 모양이라 이모지 하나만 든 칩은
        좌우 여백 14가 그림보다 넓어 「무엇을 고르는 것인지」가 안 읽혔습니다 —
        이제 사진도 받습니다.

        <p>고르는 판은 사람 얼굴과 <b>같은 것</b>을 씁니다
        ({@link FacePicker}). 목록만 다르고 하는 일이 같아서, 둘로 두면
        사진이 깨졌을 때의 말과 사진을 뺄 길이 한쪽만 고쳐집니다.
      */}
      <FacePicker
        photoId={photoId}
        onPhoto={setPhotoId}
        mark={emoji}
        onMark={setEmoji}
        marks={MARKS}
        what="모임 얼굴"
      />

      {error ? <ErrorNote message={error} /> : null}

      {editing && onDelete ? (
        <>
          <Divider />
          <Button label="모임 지우기" variant="ghost" onPress={onDelete} />
        </>
      ) : null}
    </BottomSheet>
  );
}
