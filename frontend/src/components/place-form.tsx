import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError, UNEXPECTED } from '@/api/client';
import type { Place } from '@/api/types';
import { PlaceSearch } from '@/components/place-search';
import { IconPicker } from '@/components/icon-picker';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { COMMON, decimalsOf, unitsOf } from '@/lib/money';
import {
  Body,
  BottomSheet,
  Button,
  Caption,
  Chip,
  ErrorNote,
  Field,
  Icon,
  Press,
  Row,
} from '@/ui';

/**
 * 장소를 넣거나 고치는 판.
 *
 * <p>아래에서 올라옵니다. 화면을 갈아 끼우면 보고 있던 지도와 목록을 잃고,
 * 끝내고 나면 다시 찾아 들어와야 합니다.
 *
 * <p>좌표는 보여 주지 않습니다. 쓰는 사람이 위도·경도를 알 이유가 없습니다.
 * 이름으로 찾아 고르면 좌표는 뒤에서 채워지고, 화면에는 "어디를 골랐는지" 만
 * 남습니다. 검색을 쓸 수 없을 때만 직접 넣는 칸을 엽니다.
 */
export function PlaceForm({
  visible,
  dayId,
  place,
  onDone,
  onCancel,
}: {
  visible: boolean;
  dayId: string;
  /** 있으면 고치기, 없으면 새로 넣기. */
  place?: Place;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!place;

  const [name, setName] = useState(place?.name ?? '');
  const [lat, setLat] = useState(place ? String(place.lat) : '');
  const [lng, setLng] = useState(place ? String(place.lng) : '');
  /** 고른 곳이 어디인지 사람 말로. 좌표 대신 이것을 보여 줍니다. */
  const [picked, setPicked] = useState<string | null>(place?.ja ?? place?.en ?? null);
  /* 고른 곳이 구글의 어느 장소인지. 저장해 두면 나중에 영업시간을 물어볼 수
     있습니다. 좌표를 직접 넣으면 비어 있습니다. */
  const [placeId, setPlaceId] = useState<string | null>(place?.placeId ?? null);
  /* 지도에 찍힐 그림. 찾아서 고르면 서버가 구글 갈래로 미리 하나 찍어 줍니다. */
  const [icon, setIcon] = useState<string | null>(place?.icon ?? null);
  const [time, setTime] = useState(place?.time ?? '');
  const [cat, setCat] = useState(place?.cat ?? '');
  const [cost, setCost] = useState(place?.cost ?? '');
  /* 셈할 수 있는 비용. 통화는 늘 하나 골라 둡니다 — 안 고른 상태를 두면
     금액을 적고 통화를 안 고른 채로 저장하려다 거절당합니다. */
  const [costAmount, setCostAmount] = useState(
    place?.costAmount == null ? '' : String(place.costAmount / 10 ** decimalsOf(place.costCurrency ?? '')),
  );
  const [costCurrency, setCostCurrency] = useState(place?.costCurrency ?? COMMON[0]);
  const [note, setNote] = useState(place?.note ?? '');
  const [url, setUrl] = useState(place?.url ?? '');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
    판은 닫혀도 화면에서 사라지지 않습니다. 닫히는 동안 아래로 미끄러져
    내려가야 하기 때문입니다. 그래서 useState 가 처음 붙을 때 잡은 값이
    다음에 열 때도 그대로 남아, 새로 넣으려고 열면 지난번에 치던 것이
    들어 있고, 다른 장소를 고치려고 열면 앞엣것이 보입니다.

    열릴 때마다 다시 채웁니다. 여는 순간과 대상이 바뀔 때만 하므로, 열어
    놓고 치는 동안에는 건드리지 않습니다.
  */
  useEffect(() => {
    if (!visible) {
      return;
    }
    setName(place?.name ?? '');
    setLat(place ? String(place.lat) : '');
    setLng(place ? String(place.lng) : '');
    setPicked(place?.ja ?? place?.en ?? null);
    setPlaceId(place?.placeId ?? null);
    setIcon(place?.icon ?? null);
    setTime(place?.time ?? '');
    setCat(place?.cat ?? '');
    setCost(place?.cost ?? '');
    setCostAmount(
      place?.costAmount == null
        ? ''
        : String(place.costAmount / 10 ** decimalsOf(place.costCurrency ?? '')),
    );
    setCostCurrency(place?.costCurrency ?? COMMON[0]);
    setNote(place?.note ?? '');
    setUrl(place?.url ?? '');
    setError(null);
    setBusy(false);
    /* place 는 새로 고칠 때마다 다른 객체가 되지만 가리키는 곳은 같습니다.
       객체 자체를 보면 열어 놓고 치던 것이 지워집니다. id 만 봅니다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, place?.id]);

  const latNum = Number.parseFloat(lat);
  const lngNum = Number.parseFloat(lng);
  const hasSpot = Number.isFinite(latNum) && Number.isFinite(lngNum);

  async function submit() {
    if (busy) {
      return;
    }
    if (!name.trim()) {
      setError('이름이 있어야 합니다. 부르기 쉬운 것으로 넣어 주세요.');
      return;
    }
    if (!hasSpot) {
      setError('먼저 찾아서 골라 주세요. 지도에 찍을 자리가 있어야 합니다.');
      return;
    }
    /* 적어 둔 것이 숫자로 안 읽히면 여기서 멈춥니다. 서버로 보내 400 을
       받아 오면 무엇이 틀렸는지 한 박자 늦게 압니다. */
    const typed = costAmount.trim();
    const costUnits = typed === '' ? null : unitsOf(typed, decimalsOf(costCurrency));
    if (typed !== '' && costUnits === null) {
      setError('비용은 숫자로 넣어 주세요. 통화 기호는 옆에서 고릅니다.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const body = {
        dayId,
        name: name.trim(),
        lat: latNum,
        lng: lngNum,
        time: time.trim(),
        cat: cat.trim(),
        cost: cost.trim(),
        /* 금액 칸을 비우면 둘 다 지웁니다. 통화에 빈 문자열을 보내는 것이
           "없애라" 입니다 — null 은 "손대지 마라" 라서 한 번 적은 비용을
           도로 뺄 수가 없습니다. 그림 칸이 쓰는 방식과 같습니다. */
        costAmount: costUnits,
        costCurrency: costUnits === null ? '' : costCurrency,
        note: note.trim(),
        url: url.trim(),
        fit: place?.fit ?? true,
        placeId,
        /* 빈 문자열은 "그림 빼기" 입니다. null 은 "손대지 마라" 라서, 골라 둔
           것을 도로 뺄 수 있으려면 둘을 갈라야 합니다. */
        icon: icon ?? '',
        version: place?.version,
      };
      if (place) {
        await api.patch(`/api/places/${place.id}`, body);
      } else {
        await api.post('/api/places', body);
      }
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'STALE') {
        setError('동행자가 먼저 고쳤습니다. 화면을 새로 불러온 뒤 다시 저장해 주세요.');
      } else {
        setError(e instanceof ApiError ? e.message : UNEXPECTED);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={editing ? '장소 고치기' : '장소 넣기'}
      onClose={onCancel}
      footer={<Button label={editing ? '저장' : '넣기'} onPress={submit} busy={busy} />}>
      {/* 1. 어디인지 먼저 정합니다. */}
      <PlaceSearch
        onPick={(found) => {
          if (!name.trim()) {
            setName(found.name);
          }
          setPlaceId(found.placeId);
          /* 이미 골라 둔 것이 있으면 덮지 않습니다. 다른 곳을 다시 찾았다고
             일부러 바꿔 둔 그림이 사라지면 화가 납니다. */
          setIcon((prev) => prev ?? found.icon ?? null);
          setLat(String(found.lat));
          setLng(String(found.lng));
          setPicked(found.address || found.name);
          setError(null);
        }}
      />

      {hasSpot ? (
        <View style={styles.spot}>
          <Icon name="map-pin" tone="accent" />
          <View style={styles.spotText}>
            <Body small strong>
              지도에 찍을 자리를 잡았습니다
            </Body>
            {picked ? <Caption numberOfLines={2}>{picked}</Caption> : null}
          </View>
        </View>
      ) : null}

      {/* 2. 나머지는 부르고 싶은 대로. */}
      <Field
        label="이름"
        value={name}
        onChangeText={setName}
        placeholder="난바 파크스"
        maxLength={120}
        hint="찾은 이름 그대로도 좋고, 우리끼리 부르는 이름도 좋습니다."
      />

      {/*
        지도에 찍힐 그림.

        같은 모양 핀이 스무 개 꽂혀 있으면 지도는 그냥 점의 무리입니다.
        라멘집인지 온천인지가 핀만 보고 읽히면, 다 짜 놓은 지도를 한 장으로
        찍었을 때 그것이 곧 여행의 요약이 됩니다.
      */}
      <Body small strong>
        지도에 찍을 그림
      </Body>
      <IconPicker value={icon} onChange={setIcon} />

      <Row gap={Spacing.sm} style={styles.pair}>
        <View style={styles.half}>
          <Field label="시간" value={time} onChangeText={setTime} placeholder="13:30" />
        </View>
        <View style={styles.half}>
          <Field label="분류" value={cat} onChangeText={setCat} placeholder="식사 / 관광" />
        </View>
      </Row>

      {/*
        비용은 두 칸입니다.

        위는 셈할 수 있는 값입니다 — 금액과 통화. 이것만 가계부와 이어집니다.
        통화를 고르는 칸이 없던 동안 사람들이 "￥1,200"·"1200엔"·"1인 1200" 을
        손으로 쳐 넣었고, 그래서 같은 여행 안에서 값이 섞였습니다.

        아래는 그동안 쓰던 글자 칸을 그대로 둔 것입니다. "무료", "1인 2천엔"
        처럼 숫자로 못 읽는 것이 이미 적혀 있어서, 그것을 숫자로 옮기려 들면
        틀린 돈이 정산에 들어갑니다. 옮기지 않고 나란히 둡니다.
      */}
      <Field
        label="비용"
        value={costAmount}
        onChangeText={setCostAmount}
        placeholder={decimalsOf(costCurrency) > 0 ? '12.50' : '1200'}
        inputMode="decimal"
        hint={
          decimalsOf(costCurrency) > 0 ? '소수점 아래 두 자리까지 적을 수 있습니다.' : undefined
        }
      />
      <Row gap={Spacing.xs} style={styles.currencies}>
        {COMMON.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={costCurrency === c}
            onPress={() => setCostCurrency(c)}
          />
        ))}
      </Row>

      <Field
        label="비용 메모"
        value={cost}
        onChangeText={setCost}
        placeholder="1인 2천엔 / 무료"
        hint="여기 적은 글자는 가계부에 안 더해집니다."
      />

      <Field label="메모" value={note} onChangeText={setNote} multiline />
      <Field
        label="링크"
        value={url}
        onChangeText={setUrl}
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
        inputMode="url"
      />

      {error ? <ErrorNote message={error} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  /* 나란한 두 칸은 위쪽으로 맞춥니다. 한쪽에만 힌트가 붙어 키가 달라져도
     입력 상자끼리는 한 줄에 서야 합니다. */
  pair: {
    alignItems: 'flex-start',
  },
  spot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.accentSoft,
    borderRadius: Radius.none,
    padding: Spacing.lg,
  },
  spotText: {
    flex: 1,
    gap: 2,
  },
  currencies: {
    flexWrap: 'wrap',
  },
  half: {
    flexGrow: 1,
    flexBasis: 120,
  },
});
