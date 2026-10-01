import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Group } from '@/api/types';
import { Spacing } from '@/constants/theme';
import { Body, BottomSheet, Button, Caption, ChoiceTile, ErrorNote, Field, Row } from '@/ui';

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
 */
const EMOJIS = ['🧳', '🥾', '🏕️', '🍜', '📚', '🎞️', '🚲', '🎿', '⛰️', '🏖️'];

export function GroupForm({
  visible,
  /** 고치는 중이면 그 모임. 안 주면 새로 만드는 것입니다. */
  group,
  onClose,
  onDone,
}: {
  visible: boolean;
  group?: Group | null;
  onClose: () => void;
  onDone: (group: Group) => void;
}) {
  const editing = group != null;

  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
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
      const body = { name: clean, about: about.trim(), emoji: emoji ?? '' };
      const res = editing
        ? await api.patch<{ group: Group }>(`/api/groups/${group.id}`, body)
        : await api.post<{ group: Group }>('/api/groups', body);
      onDone(res.group);
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
        표식.

        <p>칩으로 늘어놓고 있었습니다. 칩은 <b>글자</b>를 고르는 모양이라,
        이모지 하나만 든 칩은 좌우 여백 14가 그림보다 넓어 「무엇을 고르는
        것인지」가 안 읽혔습니다. 그림을 고르는 자리는 네모 타일입니다 —
        칸이 고르게 서서 그리드로 읽힙니다.
      */}
      <Body small strong>
        표식
      </Body>
      <Row gap={Spacing.s2} style={styles.tiles}>
        {EMOJIS.map((one) => (
          <ChoiceTile
            key={one}
            mark={one}
            selected={emoji === one}
            accessibilityLabel={`표식 ${one}`}
            /* 고른 것을 다시 누르면 뺍니다. 뺄 길이 없으면 한 번 달면 끝입니다. */
            onPress={() => setEmoji(emoji === one ? null : one)}
          />
        ))}
      </Row>

      {error ? <ErrorNote message={error} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexWrap: 'wrap',
  },
});
