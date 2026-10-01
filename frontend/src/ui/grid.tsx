import { Children } from 'react';
import { StyleSheet, View } from 'react-native';

import { CardGap, useCardColumns } from './layout';

/**
 * 카드를 여러 칸으로 늘어놓는 틀.
 *
 * <h3>카드 하나가 한 줄을 통째로 먹었습니다</h3>
 *
 * <p>폰 폭에 맞춰 짠 목록이 1280 짜리 창에서도 한 칸이었습니다. 글 카드
 * 하나가 960 픽셀 줄을 혼자 쓰고, 그 안의 제목은 왼쪽 끝에 몰리고, 한 화면에
 * 카드 둘이 겨우 들어갔습니다 — 넓은 화면에서 보는 것이 폰보다 적었습니다.
 *
 * <h3>칸을 재지 않고 나눕니다</h3>
 *
 * <p>폭을 재서 나누는 방법을 쓰지 않았습니다. 재는 쪽은 첫 그림에서 폭을
 * 모르므로, 한 번 그린 뒤 다시 그리게 되고 그 사이에 카드가 한 번 번쩍입니다.
 *
 * <p>대신 칸 수만큼 끊어 줄로 쌓고, 한 줄 안에서 {@code flex: 1} 로 나눠
 * 가집니다. 사이 간격까지 빼고 고르게 나누는 일은 flex 가 이미 합니다.
 * 마지막 줄이 덜 찼으면 빈 칸을 세워 둡니다 — 안 세우면 혼자 남은 카드가
 * 줄 전체로 늘어나, 위의 카드들과 다른 물건처럼 보입니다.
 *
 * <p>폰에서는 <b>아무것도 감싸지 않습니다.</b> 한 칸일 때 한 칸짜리 줄로
 * 쌓으면 화면이 가진 간격 위에 이 틀의 간격이 한 번 더 끼어, 폰에서 카드
 * 사이가 벌어집니다.
 */
export function CardGrid({
  children,
  /** 칸 수를 직접 정할 때. 안 주면 화면 단계가 정합니다(1 · 2 · 3). */
  columns,
}: {
  children: React.ReactNode;
  columns?: number;
}) {
  const auto = useCardColumns();
  const cols = Math.max(1, columns ?? auto);
  const items = Children.toArray(children);

  if (cols === 1 || items.length === 0) {
    return <>{children}</>;
  }

  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, at) => (
        <View key={at} style={styles.row}>
          {row.map((item, i) => (
            <View key={i} style={styles.cell}>
              {item}
            </View>
          ))}
          {/* 덜 찬 자리. 그릴 것은 없고 폭만 차지합니다. */}
          {Array.from({ length: cols - row.length }, (_, i) => (
            <View key={`gap-${i}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: CardGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: CardGap,
  },
  cell: {
    flex: 1,
    /* 안에 든 긴 제목이 칸을 밀어내지 않게 합니다. 안 주면 줄바꿈 없는
       긴 이름 하나가 제 칸을 넓히고 옆 칸을 찌그러뜨립니다. */
    minWidth: 0,
  },
});
