import { useState } from 'react';
import { View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { Place } from '@/api/types';
import { PlaceSearch } from '@/components/place-search';
import { Spacing } from '@/constants/theme';
import { Button, Card, Divider, ErrorNote, Field, Row, Subtitle } from '@/ui';

/**
 * 장소 하나를 넣거나 고치는 자리.
 *
 * <p>좌표는 서버가 반드시 요구합니다. 지도에 찍으려면 있어야 하고, 나중에
 * 채우게 두면 좌표 없는 장소가 쌓여 동선이 끊깁니다. 그래서 이름으로 찾아
 * 고르면 좌표가 저절로 채워지게 두고, 손으로 넣는 길도 함께 남깁니다.
 *
 * <p>고칠 때는 version 을 함께 보냅니다. 내가 화면을 열어 둔 사이 동행자가
 * 먼저 고쳤으면 서버가 409 로 되돌립니다. 조용히 덮어쓰면 앞사람이 쓴 것이
 * 흔적 없이 사라집니다.
 */
export function PlaceForm({
  dayId,
  place,
  onDone,
  onCancel,
}: {
  dayId: string;
  /** 있으면 고치기, 없으면 새로 넣기. */
  place?: Place;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(place?.name ?? '');
  const [lat, setLat] = useState(place ? String(place.lat) : '');
  const [lng, setLng] = useState(place ? String(place.lng) : '');
  const [time, setTime] = useState(place?.time ?? '');
  const [cat, setCat] = useState(place?.cat ?? '');
  const [cost, setCost] = useState(place?.cost ?? '');
  const [note, setNote] = useState(place?.note ?? '');
  const [url, setUrl] = useState(place?.url ?? '');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const latNum = Number.parseFloat(lat);
  const lngNum = Number.parseFloat(lng);
  const coordsOk = Number.isFinite(latNum) && Number.isFinite(lngNum);

  async function submit() {
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
    <Card>
      <Subtitle>{place ? '장소 고치기' : '장소 넣기'}</Subtitle>

      <PlaceSearch
        onPick={(found) => {
          /* 이름을 이미 적어 뒀으면 건드리지 않습니다. 찾은 이름이 늘
             쓰고 싶은 이름은 아닙니다("스타벅스 OO점"). */
          if (!name.trim()) {
            setName(found.name);
          }
          setLat(String(found.lat));
          setLng(String(found.lng));
        }}
      />
      <Divider />

      <Field label="이름" value={name} onChangeText={setName} placeholder="난바 파크스" maxLength={120} />

      <Row gap={Spacing.sm}>
        <View style={{ flexGrow: 1, flexBasis: 120 }}>
          <Field
            label="위도"
            value={lat}
            onChangeText={setLat}
            placeholder="34.6613"
            inputMode="decimal"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 120 }}>
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

      <Row gap={Spacing.sm}>
        <View style={{ flexGrow: 1, flexBasis: 100 }}>
          <Field label="시간" value={time} onChangeText={setTime} placeholder="13:30" hint="HH:MM" />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 100 }}>
          <Field label="분류" value={cat} onChangeText={setCat} placeholder="식사 / 관광 / 이동" />
        </View>
      </Row>

      <Field label="비용" value={cost} onChangeText={setCost} placeholder="￥1,200" />
      <Field label="메모" value={note} onChangeText={setNote} multiline numberOfLines={3} />
      <Field
        label="링크"
        value={url}
        onChangeText={setUrl}
        placeholder="https://…"
        autoCapitalize="none"
        inputMode="url"
      />

      {!coordsOk && (lat !== '' || lng !== '') ? (
        <ErrorNote message="위도·경도는 숫자로 넣어 주세요." />
      ) : null}
      {error ? <ErrorNote message={error} /> : null}

      <Row gap={Spacing.sm}>
        <Button
          label={place ? '저장' : '넣기'}
          onPress={submit}
          busy={busy}
          disabled={!name.trim() || !coordsOk}
        />
        <Button label="취소" variant="ghost" onPress={onCancel} />
      </Row>
    </Card>
  );
}
