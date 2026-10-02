import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { TripNotice } from '@/api/types';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Body, Button, Caption, ErrorNote, Field, Icon, Press, Row } from '@/ui';

/**
 * 여행 안내판 — 여행 전체에 걸린 것을 적어 두는 글 한 장.
 *
 * <h3>접어 둡니다</h3>
 *
 * <p>일정 판 맨 위에 섭니다. 펼쳐 두면 도어락 번호 넉 줄이 일정을 아래로
 * 밀어냅니다 — 안내판은 필요할 때 여는 것이고, 일정은 늘 보는 것입니다.
 * 접힌 줄에는 첫 줄만 보입니다.
 *
 * <h3>답글도 읽음 표시도 없습니다</h3>
 *
 * <p>답글이 붙으면 채팅이 되고, 「누가 읽었나」는 안 읽은 사람을 드러냅니다.
 * 누가 마지막으로 고쳤는지만 적습니다.
 */
export function NoticeBox({
  tripId,
  notice,
  onSaved,
}: {
  tripId: string;
  notice: TripNotice;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notice.text ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const first = (notice.text ?? '').split('\n')[0];

  async function save() {
    setBusy(true);
    setFailed(null);
    try {
      await api.put(`/api/trips/${encodeURIComponent(tripId)}/notice`, {
        text: draft,
        version: notice.version,
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      /* 그 사이에 누가 고쳤으면 409 입니다. 합치지 않습니다 — 새로 받아 오게
         하고, 쓴 글은 칸에 남겨 둬서 다시 옮겨 적을 수 있게 합니다. */
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      if (e instanceof ApiError && e.status === 409) {
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.box}>
      <Press
        onPress={() => setOpen(!open)}
        accessibilityLabel={open ? '안내판 접기' : '안내판 펼치기'}
        scale={1}
        style={styles.head}>
        <Icon name="clipboard" size={18} tone="secondary" />
        <View style={styles.grow}>
          <Body strong small>
            안내판
          </Body>
          {!open ? (
            <Caption tone="secondary" numberOfLines={1}>
              {first || '숙소 도어락, 모이는 곳처럼 여행 내내 볼 것을 적어 두세요.'}
            </Caption>
          ) : null}
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} tone="muted" />
      </Press>

      {open ? (
        editing ? (
          <>
            <Field
              label="안내판"
              value={draft}
              onChangeText={setDraft}
              multiline
              limit={4000}
              placeholder={'숙소 도어락 1234*\n둘째 날 9시 호텔 로비에서 모여요'}
            />
            {/* 늘 보이게 둡니다. 한 번 읽고 지나가는 안내로는 모자랍니다. */}
            <Caption tone="warning">여권 번호·카드 번호는 적지 마세요. 모임 사람 모두가 봐요.</Caption>
            {failed ? <ErrorNote message={failed} /> : null}
            <Row gap={Spacing.s2}>
              <Button label="저장" compact busy={busy} onPress={save} />
              <Button
                label="그만두기"
                variant="ghost"
                compact
                onPress={() => {
                  setDraft(notice.text ?? '');
                  setFailed(null);
                  setEditing(false);
                }}
              />
            </Row>
          </>
        ) : (
          <>
            {notice.text ? (
              <Body selectable>{notice.text}</Body>
            ) : (
              <Caption tone="secondary">
                아직 비어 있어요. 숙소 도어락, 모이는 곳, 비상 연락처처럼 날짜에 안 묶이는 것을
                적어 두세요.
              </Caption>
            )}
            {notice.byName && notice.at ? (
              <Caption tone="muted">{notice.byName} 님이 마지막으로 고쳤어요.</Caption>
            ) : null}
            <Button
              label={notice.text ? '고치기' : '적기'}
              variant="secondary"
              compact
              onPress={() => {
                setDraft(notice.text ?? '');
                setEditing(true);
              }}
            />
          </>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.s2,
    padding: Spacing.s3,
    borderRadius: Radius.md,
    backgroundColor: Colors.fill,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s2,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
});
