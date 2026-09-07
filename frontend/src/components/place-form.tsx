import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Place } from '@/api/types';
import { hasPlaceSearch, PlaceSearch } from '@/components/place-search';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  Badge,
  Body,
  BottomSheet,
  Button,
  Caption,
  ErrorNote,
  Field,
  Icon,
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
  const [time, setTime] = useState(place?.time ?? '');
  const [cat, setCat] = useState(place?.cat ?? '');
  const [cost, setCost] = useState(place?.cost ?? '');
  const [note, setNote] = useState(place?.note ?? '');
  const [url, setUrl] = useState(place?.url ?? '');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const latNum = Number.parseFloat(lat);
  const lngNum = Number.parseFloat(lng);
  const hasSpot = Number.isFinite(latNum) && Number.isFinite(lngNum);

  async function submit() {
    if (busy) {
      return;
    }
    if (!name.trim()) {
      setError('장소 이름을 넣어 주세요.');
      return;
    }
    if (!hasSpot) {
      setError('장소를 찾아서 골라 주세요. 지도에 찍을 자리가 필요합니다.');
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
        note: note.trim(),
        url: url.trim(),
        fit: place?.fit ?? true,
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
        setError(e instanceof ApiError ? e.message : '저장하지 못했습니다.');
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
          <Badge label="완료" tone="accent" />
        </View>
      ) : null}

      {/* 검색을 쓸 수 없을 때만 직접 넣습니다. */}
      {hasPlaceSearch() ? null : (
        <Row gap={Spacing.sm}>
          <View style={styles.half}>
            <Field
              label="위도"
              value={lat}
              onChangeText={setLat}
              placeholder="34.6613"
              inputMode="decimal"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.half}>
            <Field
              label="경도"
              value={lng}
              onChangeText={setLng}
              placeholder="135.5023"
              inputMode="decimal"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </Row>
      )}

      {/* 2. 나머지는 부르고 싶은 대로. */}
      <Field
        label="이름"
        value={name}
        onChangeText={setName}
        placeholder="난바 파크스"
        maxLength={120}
        hint="찾은 이름을 그대로 써도 되고, 부르기 쉽게 바꿔도 됩니다."
      />

      <Row gap={Spacing.sm}>
        <View style={styles.half}>
          <Field label="시간" value={time} onChangeText={setTime} placeholder="13:30" hint="HH:MM" />
        </View>
        <View style={styles.half}>
          <Field label="분류" value={cat} onChangeText={setCat} placeholder="식사 / 관광" />
        </View>
      </Row>

      <Field label="비용" value={cost} onChangeText={setCost} placeholder="￥1,200" />
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
  spot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.accentSoft,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  spotText: {
    flex: 1,
    gap: 2,
  },
  half: {
    flexGrow: 1,
    flexBasis: 120,
  },
});
