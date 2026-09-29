import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { api } from '@/api/client';
import { useAsync } from '@/api/use-async';
import { Spacing } from '@/constants/theme';
import { Caption, Chip, Field, Row } from '@/ui';

/**
 * 글의 겉.
 *
 * <h3>왜 따로 빼는가</h3>
 *
 * <p>올릴 때 적는 것과 고칠 때 적는 것이 같습니다 — 제목, 한 줄 소개, 지역,
 * 태그, 댓글을 받을지. 두 판에 따로 적어 두면 태그 상한을 여덟에서 열로
 * 늘리는 것 같은 일을 두 군데에서 해야 하고, 한 군데를 잊으면 올릴 때는 열
 * 개가 되는데 고칠 때는 여덟 개에서 막힙니다.
 *
 * <p>일정 자체(어느 날을 올릴지)는 여기 없습니다. 그것은 <b>올릴 때만</b>
 * 고르는 것이고, 올린 뒤에는 날을 골라 다시 싣는 것이 아니라 장소를 하나씩
 * 빼는 일이 됩니다.
 *
 * <h3>값은 부르는 쪽이 들고 있습니다</h3>
 *
 * <p>이 칸들은 제 값을 갖지 않습니다. 올릴 때는 여행 제목에서 시작하고 고칠
 * 때는 이미 올린 값에서 시작하는데, 어디서 시작하는지를 이 안에서 정하려고
 * 하면 "어느 판에서 열렸는지" 를 알아야 합니다. 받아서 보여 주고 바뀐 것을
 * 돌려줍니다.
 */
export type PostShape = {
  title: string;
  summary: string;
  /** 고른 지역. 안 골라도 올라갑니다 — 다만 지역으로 거를 때 안 걸립니다. */
  region: string | null;
  tags: string[];
  /** 댓글을 받을지. */
  feedback: boolean;
};

/** 글 하나에 달 수 있는 태그 수. 서버와 같은 값입니다(PostService.MAX_TAGS). */
export const MAX_TAGS = 8;

/** 태그 하나의 길이. 문장을 태그로 다는 것을 막습니다. */
export const MAX_TAG_LENGTH = 20;

/**
 * 적은 것을 태그로 만듭니다.
 *
 * <p>서버가 다듬는 것과 같은 규칙입니다(PostService.tagOf) — 앞의 #을 떼고,
 * 앞뒤 빈칸을 버리고, 소문자로 맞춥니다. 화면에서 안 맞춰 주면 "#온천" 과
 * "온천" 이 다른 태그처럼 보이다가 저장하고 나면 하나가 됩니다.
 *
 * @return 쓸 수 없는 것이면 null
 */
export function tagOf(raw: string): string | null {
  const clean = raw.trim().replace(/^#+/, '').trim().toLowerCase();
  if (!clean || clean.length > MAX_TAG_LENGTH) {
    return null;
  }
  return clean;
}

export function PostFields({
  value,
  onChange,
}: {
  value: PostShape;
  onChange: (next: PostShape) => void;
}) {
  /** 지금 치고 있는 태그. 아직 달리지 않은 것이라 밖으로 안 내보냅니다. */
  const [typing, setTyping] = useState('');

  /* 고를 수 있는 지역은 서버가 정합니다. 여기 따로 적어 두면 언젠가 어긋나고,
     어긋나면 고른 값이 저장은 되는데 목록에서 아무것도 안 걸립니다. */
  const { data: regionList } = useAsync<{ regions: string[] }>(
    (signal) => api.get('/api/posts/regions', signal),
    [],
  );

  const { data: tagList } = useAsync<{ tags: { tag: string; posts: number }[] }>(
    (signal) => api.get('/api/posts/tags', signal),
    [],
  );

  const set = <K extends keyof PostShape>(key: K, next: PostShape[K]) =>
    onChange({ ...value, [key]: next });

  function addTag(raw: string) {
    setTyping('');
    const clean = tagOf(raw);
    if (!clean || value.tags.includes(clean) || value.tags.length >= MAX_TAGS) {
      return;
    }
    set('tags', [...value.tags, clean]);
  }

  return (
    <>
      <Field
        label="제목"
        value={value.title}
        onChangeText={(next) => set('title', next)}
        placeholder="도쿄 3박 4일"
      />
      <Field
        label="한 줄 소개"
        value={value.summary}
        onChangeText={(next) => set('summary', next)}
        placeholder="먹으러만 다닌 일정이에요"
        hint="목록에서 이 줄이 보여요. 비워도 돼요."
      />

      {/* 지역은 안 골라도 올라갑니다. 다만 지역으로 거를 때 안 걸립니다. */}
      <Caption tone="secondary">어디로 다녀오셨나요?</Caption>
      <Row gap={Spacing.xs} style={styles.wrap}>
        {regionList?.regions.map((r) => (
          <Chip
            key={r}
            label={r}
            selected={value.region === r}
            onPress={() => set('region', value.region === r ? null : r)}
          />
        ))}
      </Row>

      {/*
        태그.

        <p>지역 아래에 둡니다. 어디를 다녀왔는지 다음에 오는 것이 무엇에
        대한 여행인지이고, 둘은 함께 적는 것이 자연스럽습니다.

        <p>고르는 목록을 두지 않고 직접 적습니다 — 무엇으로 묶일지는 미리 알 수
        없고, 목록을 만들어 두면 거기 없는 여행은 아무 데도 안 걸립니다. 대신
        이미 쓰인 것을 아래 보여 주어 저절로 같은 말로 모이게 합니다.
      */}
      <Caption tone="secondary">무엇에 대한 여행인가요?</Caption>
      {value.tags.length > 0 ? (
        <Row gap={Spacing.xs} style={styles.wrap}>
          {value.tags.map((t) => (
            /* 누르면 뺍니다. 지우는 단추를 따로 두면 태그 하나가 두 칸이
               되어 여덟 개를 달면 줄이 넘칩니다. */
            <Chip
              key={t}
              label={`${t} ✕`}
              selected
              onPress={() =>
                set(
                  'tags',
                  value.tags.filter((x) => x !== t),
                )
              }
            />
          ))}
        </Row>
      ) : null}
      {value.tags.length < MAX_TAGS ? (
        <Field
          label="태그"
          value={typing}
          onChangeText={setTyping}
          placeholder="아이랑"
          hint={`${MAX_TAGS}개까지. 엔터로 달아요.`}
          returnKeyType="done"
          onSubmitEditing={() => addTag(typing)}
        />
      ) : null}
      {/* 이미 쓰인 것들. 누르면 그대로 달립니다 — 같은 뜻을 저마다 다르게
          적으면 어느 것으로도 다 안 걸립니다. */}
      {(tagList?.tags.length ?? 0) > 0 && value.tags.length < MAX_TAGS ? (
        <Row gap={Spacing.xs} style={styles.wrap}>
          {tagList?.tags
            .filter((t) => !value.tags.includes(t.tag))
            .slice(0, 12)
            .map((t) => (
              <Chip key={t.tag} label={t.tag} selected={false} onPress={() => addTag(t.tag)} />
            ))}
        </Row>
      ) : null}

      {/* 구경만 하라고 올린 글에 훈수가 달리면 반갑지 않습니다. 열어 둘
          때만 댓글칸이 생깁니다. */}
      <Caption tone="secondary">댓글을 받을까요?</Caption>
      <Row gap={Spacing.xs}>
        <Chip label="안 받기" selected={!value.feedback} onPress={() => set('feedback', false)} />
        <Chip label="받기" selected={value.feedback} onPress={() => set('feedback', true)} />
      </Row>
      <Caption tone="secondary">
        받으면 다른 사람이 일정 전체에, 또는 장소 하나하나에 댓글을 달 수 있어요.
      </Caption>
    </>
  );
}

const styles = StyleSheet.create({
  /* 태그가 여덟이면 한 줄에 안 섭니다. 접히게 둡니다 — 옆으로 흘리면
     오른쪽에 뭐가 더 있는지 안 보입니다. */
  wrap: {
    flexWrap: 'wrap',
  },
});
