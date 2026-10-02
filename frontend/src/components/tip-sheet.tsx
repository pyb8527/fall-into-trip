import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { OurStars, Tip } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Colors, Gutter, Spacing } from '@/constants/theme';
import {
  Band,
  Body,
  BottomSheet,
  Button,
  Caption,
  ConfirmDialog,
  Empty,
  ErrorNote,
  Field,
  IconButton,
  Loading,
  Row,
  Stars,
  Split,
} from '@/ui';

/**
 * 장소에 달린 한 줄 팁.
 *
 * <p>"지금 대기 40분", "2번 출구로 나와야 함" 처럼 구글에는 없고 방금 다녀온
 * 사람만 아는 것들입니다.
 *
 * <p>여행이 아니라 그 가게에 달립니다. 같은 곳을 넣어 둔 사람이면 누구든 같은
 * 팁을 봅니다.
 *
 * <p>일주일 지난 것은 보여 주지 않습니다. "지금 대기 40분" 은 다음 날이면 이미
 * 쓸모가 없고, 두 달 전 것은 사람을 잘못 이끕니다.
 */
export function TipSheet({
  visible,
  placeId,
  placeName,
  onClose,
  onChanged,
}: {
  visible: boolean;
  placeId: string;
  placeName: string;
  onClose: () => void;
  /** 개수가 달라졌으니 부른 쪽이 다시 세어야 합니다. */
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [tips, setTips] = useState<Tip[] | null>(null);
  /* 내가 줄 별. 0 은 아직 안 고른 것입니다 — 서버에는 1~5 만 보냅니다. */
  const [mine, setMine] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Tip | null>(null);
  /* 이 장소의 우리 평균. 아직 아무도 안 줬으면 없습니다. */
  const [ours, setOurs] = useState<OurStars | null>(null);

  async function load() {
    try {
      const res = await api.get<{ tips: Tip[]; stars?: OurStars | null }>(
        `/api/places/${encodeURIComponent(placeId)}/tips`,
      );
      setTips(res.tips);
      setOurs(res.stars ?? null);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    }
  }

  useEffect(() => {
    if (visible) {
      setText('');
      setFailed(null);
      setTips(null);
      setOurs(null);
      setMine(0);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, placeId]);

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
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} title={`${placeName} 한 줄`} onClose={onClose}>
      <Caption tone="secondary">
        최근 일주일 안에 다녀온 사람들이 남긴 거예요. 대기 시간처럼 금방 달라지는 것은 적힌
        시각을 함께 보세요.
      </Caption>

      {/*
        우리 평점.

        <p>구글 평점은 장소 상세 위쪽에 이미 섰습니다. 여기 것은 <b>우리
        쪽</b>이라, 둘을 나란히 두면 다를 때 그것이 정보가 됩니다.

        <p>몇 명이 줬는지를 늘 함께 적습니다. 한 사람이 준 5.0 과 열한 명이
        준 4.6 은 같은 숫자가 아닌데, 평균만 띄우면 앞쪽이 더 좋아 보입니다.
      */}
      {ours ? (
        <Row gap={Spacing.s2}>
          <Stars value={ours.average} size={16} />
          <Body small strong>
            {ours.average.toFixed(1)}
          </Body>
          <Caption tone="secondary">우리 {ours.count}명</Caption>
        </Row>
      ) : null}

      {failed ? <ErrorNote message={failed} /> : null}
      {tips === null ? <Loading /> : null}
      {tips && tips.length === 0 ? (
        <Empty message="아직 아무도 안 남겼어요. 다녀오셨다면 첫 줄을 남겨 주세요." />
      ) : null}

      {/*
        한 줄 하나.

        <p>사이가 4픽셀이었습니다. 그러면 세 사람이 남긴 것이 한 사람이
        길게 적은 것으로 읽힙니다 — 누가 어디까지 말한 것인지는 선 한
        가닥이 말합니다. 댓글 목록과 같은 규칙입니다.
      */}
      {tips?.map((tip, i) => (
        <View key={tip.id} style={[styles.tip, i > 0 ? styles.tipEdge : null]}>
          {tip.stars ? <Stars value={tip.stars} size={14} /> : null}
          {/* 별만 주고 글은 안 남긴 사람이 있습니다. 빈 줄을 세우지
              않습니다. */}
          {tip.text ? <Body small>{tip.text}</Body> : null}
          <Split>
            <Caption tone="secondary">
              {tip.authorName} · {sinceOf(tip.createdAt)}
            </Caption>
            {tip.mine ? (
              <IconButton
                name="trash-2"
                label="내가 남긴 것 지우기"
                tone="danger"
                bare
                disabled={busy}
                onPress={() => run(() => api.delete(`/api/tips/${tip.id}`))}
              />
            ) : user ? (
              /* 댓글 목록과 같은 모양입니다. 한쪽은 글자 단추, 한쪽은
                 깃발이면 같은 일을 두 모양으로 하는 셈입니다. */
              <IconButton
                name="flag"
                label="이 한 줄 신고"
                bare
                onPress={() => setReporting(tip)}
              />
            ) : null}
          </Split>
        </View>
      ))}

      {user ? (
        <>
          <Band />

          {/*
            별 다섯이 먼저입니다.

            <p>적을 말은 없어도 「좋았다」는 있습니다. 글칸을 먼저 두면
            적을 말이 없는 사람은 아무것도 안 남기고 닫습니다 — 별 다섯은
            한 번 누르면 끝이라 문턱이 가장 낮습니다.
          */}
          <Caption tone="secondary">여기 어땠어요?</Caption>
          <Stars value={mine} onChange={setMine} size={32} label="별점" />

          <Field
            label="한 줄 남기기"
            value={text}
            onChangeText={setText}
            placeholder="지금 대기 40분, 2번 출구로 나와야 함"
            hint="200자까지. 같은 곳에는 하루 세 번까지 남길 수 있어요."
            limit={200}
            returnKeyType="done"
          />
          <Button
            label="남기기"
            busy={busy}
            /* 둘 중 하나만 있어도 남깁니다(G-11). 별만 준 사람도 있고
               할 말만 있는 사람도 있습니다. */
            disabled={!text.trim() && mine === 0}
            onPress={() =>
              run(() =>
                api.post(`/api/places/${encodeURIComponent(placeId)}/tips`, {
                  text: text.trim(),
                  stars: mine === 0 ? null : mine,
                }),
              ).then((done) => {
                if (done) {
                  setText('');
                  setMine(0);
                }
              })
            }
          />
        </>
      ) : (
        <Caption tone="secondary">로그인하면 한 줄 남길 수 있어요.</Caption>
      )}

      <ConfirmDialog
        visible={reporting !== null}
        title="이 한 줄을 신고할까요?"
        message="여러 사람이 신고하면 운영자가 확인할 때까지 자동으로 감춰져요."
        confirmLabel="신고"
        danger
        busy={busy}
        onCancel={() => setReporting(null)}
        onConfirm={() => {
          const target = reporting;
          setReporting(null);
          if (target) {
            run(() => api.post(`/api/tips/${target.id}/report`, {}));
          }
        }}
      />
    </BottomSheet>
  );
}

/**
 * 얼마나 지났는지.
 *
 * <p>날짜보다 "3시간 전" 이 낫습니다. 대기 시간 같은 것은 언제 적힌 것인지가
 * 내용만큼 중요합니다.
 */
function sinceOf(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) {
    return `${Math.max(1, minutes)}분 전`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : `${Math.round(hours / 24)}일 전`;
}

const styles = StyleSheet.create({
  tip: {
    gap: Spacing.s1,
    paddingVertical: Spacing.s3,
  },
  /* 첫 줄 위에는 안 긋습니다 — 위의 안내문과 사이가 선으로 막히면 그
     안내문이 첫 한 줄처럼 보입니다. */
  tipEdge: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
