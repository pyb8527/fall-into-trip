import { StyleSheet, View } from 'react-native';

import type { SavedPlace } from '@/api/types';
import { iconOf, labelOf } from '@/constants/place-icons';
import { Colors, Gutter, Spacing } from '@/constants/theme';
import { savedAgo } from '@/lib/saved';
import { Body, Button, Caption, Checkbox, Mark, Press } from '@/ui';

/** 그림을 아직 안 고른 곳. 지도에서도 별로 찍힙니다. */
const STAR = '⭐';

/**
 * 보석함의 한 줄.
 *
 * <h3>왜 한 곳에서만 그리는가</h3>
 *
 * <p>담아 둔 곳을 늘어놓는 자리가 둘입니다 — 보석함 화면과, 여행 상세에서
 * 하루에 꺼내 넣는 판. 같은 것을 두 군데서 따로 그리면 한쪽만 메모를 보여
 * 주고 다른 쪽은 이름만 보여 주는 식으로 갈립니다. 실제로 그랬습니다.
 *
 * <h3>이름만으로는 고를 수가 없습니다</h3>
 *
 * <p>줄에 이름 하나만 적혀 있었습니다. 두 달 전에 담은 "야키토리 토리키조쿠
 * 난바점" 이 무엇이었는지, 왜 담았는지, 지금 짜는 여행과 상관이 있는지가
 * 어디에도 안 적혀 있어 하나씩 눌러 봐야 했습니다.
 *
 * <p>그래서 아랫줄에 갈래와 메모를 답니다. 둘 다 없으면 <b>언제 담았는지</b>
 * 라도 답니다 — 보석함에 순서는 없지만 나이는 있고, 어제 담은 것과 재작년에
 * 담은 것은 지금 짜는 여행과의 거리가 다릅니다.
 *
 * <h3>판을 벗고 한 줄이 되었습니다</h3>
 *
 * <p>줄마다 흰 판을 두르고, 그 안을 다시 위아래로 갈라 아래쪽에 「자세히」를
 * 두었습니다. 그러면 한 곳이 <b>두 줄 높이</b>를 먹어서 스무 곳을 담아 둔
 * 사람은 화면에 네 곳만 보였습니다. 게다가 바닥이 흰색이 된 뒤로 그 판은
 * 보이지도 않으면서 글자를 안으로 밀어 넣는 일만 했습니다.
 *
 * <p>한 줄로 폅니다. 그림·이름·설명이 왼쪽에서 읽히고, 「자세히」는 같은
 * 줄 오른쪽 끝에 작은 단추로 섭니다.
 *
 * <h3>고르는 네모는 줄 앞입니다</h3>
 *
 * <p>오른쪽 끝에 있었습니다. 그러면 여러 곳을 고를 때 눈은 왼쪽 이름을
 * 읽고 손은 오른쪽 끝을 짚느라 줄마다 화면을 가로지릅니다. 네모가 앞에
 * 서면 짚는 자리가 한 줄로 가지런해져 <b>아래로만 내려가며</b> 고를 수
 * 있습니다.
 *
 * <h3>누르는 자리는 셋입니다</h3>
 *
 * <p>전에는 한 줄에 단추가 넷이었습니다 — 그림 바꾸기, 고르기, 길찾기,
 * 빼기. 스무 줄이면 단추가 여든 개라 목록이 아니라 단추밭입니다. 게다가
 * 웹에서는 큰 것 안의 작은 것이 함께 눌려, 그림을 바꾸려다 고르기까지
 * 됐습니다.
 *
 * <p>이제 줄을 누르면 <b>지도가 그리로 가고</b>, 「자세히」를 누르면
 * <b>들여다보고</b>, 네모를 누르면 <b>고릅니다</b>. 길찾기·빼기·그림
 * 바꾸기는 들여다보는 판 안으로 들어갔습니다 — 거기서는 무엇을 하는 것인지
 * 이름이 붙어 있습니다.
 *
 * <h3>지도로 보내기와 들여다보기를 갈랐습니다</h3>
 *
 * <p>한동안은 줄을 누르면 둘이 한꺼번에 일어났습니다. 지도가 그 자리로
 * 움직이고 동시에 들여다보는 판이 올라왔는데, <b>그 판이 지도를 덮어</b>
 * 움직인 것을 볼 수가 없었습니다. 둘 다 한 셈인데 하나는 헛일이었습니다.
 *
 * <p>가릅니다. 줄은 지도로 보내고, 들여다보는 것은 따로 누릅니다.
 */
export function SavedRow({
  place,
  selected,
  onToggle,
  onPress,
  onLook,
  lit,
}: {
  place: SavedPlace;
  /** 고른 상태. 고르는 자리가 아니면 null. */
  selected?: boolean | null;
  onToggle?: () => void;
  /**
   * 줄을 눌렀을 때. 대개 지도를 그 자리로 보냅니다.
   *
   * <p>없으면 줄을 눌러도 고르기만 합니다 — 꺼내 넣는 판처럼 지도가 없는
   * 자리에서는 보낼 데가 없습니다.
   */
  onPress?: () => void;
  /** 들여다보기. 주면 줄 끝에 작은 단추가 붙습니다. */
  onLook?: () => void;
  /** 지도에서 켜 둔 것. 목록의 그 줄도 함께 켜집니다. */
  lit?: boolean;
}) {
  const on = selected === true;
  const picking = selected !== null && selected !== undefined;

  /*
    아랫줄에 무엇을 적을지.

    갈래는 그림이 이미 말하고 있지만 그림은 짐작해야 읽힙니다 — ⛩️ 가
    명소인지 신사인지는 사람마다 다르게 봅니다. 글자로 한 번 더 답니다.

    같은 말을 두 번 적지 않습니다. 구글이 준 분류가 우리 갈래와 똑같이
    번역되는 일이 흔해서, 거르지 않으면 "디저트 · 디저트" 가 됩니다.
  */
  const kind = labelOf(place.icon);
  const said = place.note ?? (place.cat === kind ? null : place.cat) ?? savedAgo(place.createdAt);
  const about = [kind, said].filter(Boolean).join(' · ');

  return (
    <View style={[styles.row, on ? styles.rowOn : lit ? styles.rowLit : null]}>
      {picking ? (
        <Checkbox
          checked={on}
          onChange={onToggle ?? (() => {})}
          label={`${place.name} ${on ? '고르기 취소' : '고르기'}`}
        />
      ) : null}

      <Press
        onPress={onPress ?? onToggle}
        /* 줄은 크기가 안 변합니다. 목록에서 줄마다 쪼그라들면 아래 줄들이
           따라 들썩이는 것처럼 보입니다 — 눌린 것은 바탕이 말합니다. */
        scale={1}
        accessibilityLabel={
          onPress ? `${place.name} 지도에서 보기` : `${place.name} ${on ? '고르기 취소' : '고르기'}`
        }
        accessibilityState={picking ? { selected: on } : undefined}
        style={styles.body}>
        <Mark emoji={iconOf(place.icon)} fallback={STAR} active={on} />
        <View style={styles.text}>
          <Body strong numberOfLines={1}>
            {place.name}
          </Body>
          <Caption tone="secondary" numberOfLines={1}>
            {about}
          </Caption>
        </View>
      </Press>

      {/* 들여다보는 길. 줄 끝에 작은 단추로 섭니다 — 줄을 두 겹으로 쪼개지
          않습니다. */}
      {onLook ? <Button label="자세히" variant="ghost" compact onPress={onLook} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /*
    줄 하나.

    <p>고른 줄과 켜 둔 줄은 바탕으로 말합니다. 바탕은 좌우 여백을 뚫고
    나가야 <b>줄 전체</b>가 물든 것으로 읽힙니다 — 여백 안에서만 칠하면
    글자 뒤에 색 상자를 얹은 것처럼 보입니다.
  */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
    /* 썸네일이 드는 줄의 높이. */
    minHeight: 72,
    paddingVertical: Spacing.s2,
    marginHorizontal: -Gutter,
    paddingHorizontal: Gutter,
  },
  /* 고른 것. 글자로 적지 않고 바탕으로 말합니다. */
  rowOn: {
    backgroundColor: Colors.accentSoft,
  },
  /* 지도에서 핀만 누른 것. 고른 것과는 다르게, 회색으로 옅게. */
  rowLit: {
    backgroundColor: Colors.surfaceRaised,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s3,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
