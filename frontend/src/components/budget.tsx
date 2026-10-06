import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { money } from '@/lib/money';
import { BottomSheet, Body, Button, Caption, ErrorNote, Field, Press, Row, Split } from '@/ui';

/**
 * 여행 예산 — 원화 한 줄과 막대 하나.
 *
 * <h3>왜 있는가</h3>
 *
 * <p>가계부는 「쓴 돈」만 적었습니다. 떠나기 전에 열면 빈 화면이었고, 다니는
 * 동안에도 「얼마나 썼나」는 보이는데 「얼마까지 쓸 생각이었나」가 없어서
 * 그 숫자가 많은지 적은지 알 수 없었습니다.
 *
 * <h3>원화로만 견줍니다</h3>
 *
 * <p>쓴 돈이 여러 통화면 적어 둔 환전 환율로 합친 원화(krwTotal)와 견줍니다.
 * 환율이 비어 원화로 못 합치면 막대를 안 그립니다 — 엔만 빠진 합계와
 * 견주면 실제보다 덜 쓴 것처럼 보입니다.
 */
export function BudgetLine({
  budget,
  spentKrw,
  onEdit,
}: {
  /** 예산(원). 없으면 「예산 정하기」 한 줄입니다. */
  budget: number | null | undefined;
  /** 원화로 합친 쓴 돈. 합칠 수 없으면 null. */
  spentKrw: number | null;
  onEdit: () => void;
}) {
  if (!budget) {
    return (
      <Press onPress={onEdit} style={styles.ask} accessibilityLabel="예산 정하기">
        <Body small tone="brand">
          예산을 정하면 얼마나 썼는지 견줘 봐요 ›
        </Body>
      </Press>
    );
  }
  const ratio = spentKrw == null ? null : spentKrw / budget;
  const over = ratio != null && ratio > 1;
  return (
    <Press onPress={onEdit} scale={1} style={styles.block} accessibilityLabel="예산 고치기">
      <Split>
        <Caption tone="secondary">{`예산 ${money(budget, 'KRW', 0)}`}</Caption>
        <Caption tone={over ? 'danger' : 'secondary'} strong={over}>
          {ratio == null
            ? '환율을 적으면 견줘 봐요'
            : over
              ? `${money((spentKrw ?? 0) - budget, 'KRW', 0)} 넘었어요`
              : `${money(budget - (spentKrw ?? 0), 'KRW', 0)} 남았어요`}
        </Caption>
      </Split>
      {ratio != null ? (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, Math.round(ratio * 100))}%` },
              over ? styles.fillOver : null,
            ]}
          />
        </View>
      ) : null}
    </Press>
  );
}

/** 예산을 적는 판. 비우고 저장하면 예산을 걷습니다. */
export function BudgetSheet({
  visible,
  tripId,
  budget,
  onClose,
  onDone,
}: {
  visible: boolean;
  tripId: string;
  budget: number | null | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText(budget ? String(budget) : '');
      setFailed(null);
    }
  }, [visible, budget]);

  /* 쉼표를 쳐도 받습니다. 「1,500,000」을 그대로 붙여 넣는 사람이 많습니다. */
  const digits = text.replace(/[,\s원]/g, '');
  const amount = digits === '' ? null : Number(digits);
  const bad = amount != null && (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000_000);

  async function save(next: number | null) {
    setBusy(true);
    setFailed(null);
    try {
      await api.put(`/api/trips/${encodeURIComponent(tripId)}/budget`, { amount: next });
      onDone();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : UNEXPECTED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="여행 예산"
      onClose={onClose}
      footer={
        <Row gap={Spacing.s2}>
          {budget ? (
            <View style={styles.grow}>
              <Button label="예산 걷기" variant="secondary" onPress={() => save(null)} disabled={busy} />
            </View>
          ) : null}
          <View style={styles.grow}>
            <Button label="저장" onPress={() => save(amount)} busy={busy} disabled={bad || amount == null} />
          </View>
        </Row>
      }>
      <Caption tone="secondary">
        원화로 적어요. 엔·달러로 쓴 돈은 적어 둔 환전 환율로 바꿔 견줘요. 같이 가는 사람 모두에게 보여요.
      </Caption>
      {failed ? <ErrorNote message={failed} /> : null}
      <Field
        label="예산"
        value={text}
        onChangeText={setText}
        placeholder="1,500,000"
        unit="원"
        keyboardType="number-pad"
        error={bad ? '0원에서 10억 원 사이 숫자로 적어 주세요' : undefined}
        hint={amount && !bad ? money(amount, 'KRW', 0) : undefined}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  ask: {
    paddingVertical: Spacing.s1,
  },
  block: {
    gap: Spacing.s1,
    paddingTop: Spacing.s2,
  },
  track: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  fillOver: {
    backgroundColor: Colors.danger,
  },
  grow: {
    flex: 1,
  },
});
