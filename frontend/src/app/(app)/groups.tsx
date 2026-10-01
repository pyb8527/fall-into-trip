import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api/client';
import type { Group } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { GroupForm } from '@/components/group-form';
import {
  Button,
  Caption,
  Empty,
  ErrorNote,
  Grow,
  IconButton,
  ListRow,
  Loading,
  Mark,
  Screen,
  Split,
  Title,
} from '@/ui';
import { AppTabs } from '@/ui/tab-bar';

/**
 * 내 모임.
 *
 * <h3>사람 수와 여행 수를 함께 냅니다</h3>
 *
 * <p>이름만 늘어놓으면 어느 것이 살아 있는 모임인지 안 보입니다. 모임이
 * 다섯만 되어도 「어디서 그 여행을 짰더라」 를 들어가 봐야 알게 됩니다.
 *
 * <h3>왜 여행 목록과 따로인가</h3>
 *
 * <p>여행은 일이고 모임은 사람입니다. 한 모임에서 여행을 여러 번 가는 것이
 * 이 기능의 뜻이라, 모임을 여행 목록 안에 접어 넣으면 그 뜻이 안 보입니다
 * — 내 여행 화면은 「모임」 칸으로 그 결과만 보여 줍니다.
 *
 * <h3>만들기를 위로 올렸습니다</h3>
 *
 * <p>아래에 고정 단추를 두었더니 갈래 띠와 겹쳐 아래쪽이 두 겹으로
 * 무거웠습니다. 갈래 화면에는 이미 띠가 서 있으니 그 위에 단추 판을 또
 * 얹으면 목록이 설 자리가 그만큼 줄어듭니다. 목록이 있을 때는 제목 오른쪽
 * <b>+</b> 하나로 충분합니다 — 모임을 만드는 일은 자주 하는 일이 아닙니다.
 *
 * <p>비었을 때는 다릅니다. 그때는 만들기가 이 화면의 하나뿐인 할 일이라,
 * 빈자리 아래에 채운 단추로 세웁니다.
 */
export default function Groups() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const { data, error, loading, reload } = useAsync<{ groups: Group[] }>(
    (signal) => api.get('/api/groups', signal),
    [],
  );

  const groups = data?.groups ?? [];
  const blank = data != null && groups.length === 0;

  return (
    <Screen
      safeTop
      tabs={<AppTabs />}
      header={
        <Split>
          <Grow>
            <Title>모임</Title>
          </Grow>
          {/* 비었을 때는 빈자리 쪽 단추가 이 일을 맡습니다. 둘을 같이 두면
              같은 일을 하는 자리가 한 화면에 둘입니다. */}
          {blank ? null : (
            <IconButton name="plus" label="새 모임 만들기" bare onPress={() => setCreating(true)} />
          )}
        </Split>
      }>
      {/*
        큰 제목이 본문 위에 서므로 상단바는 걷습니다.

        <p>갈래 띠로 오는 화면입니다. 뒤로 갈 데가 없으니 상단바가 할 일이
        없는데, 작은 제목 하나를 위해 56픽셀을 먹고 있었습니다 — 게다가
        아래 큰 제목과 같은 말을 두 번 적는 셈이었습니다.
      */}
      <Stack.Screen options={{ headerShown: false }} />

      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {blank ? (
        <>
          {/* 「없어요」 만 적으면 무엇을 위한 자리인지 모릅니다. 모임이
              무엇을 바꾸는지를 빈자리에서 한 번 말해 줍니다. */}
          <Empty message="함께 여행할 사람들을 모아 보세요." />
          <Caption tone="secondary">
            모임에 사람을 부르면 그 안에서 만든 여행이 모두에게 보이고, 일정도 누구나
            고칠 수 있어요.
          </Caption>
          <Button label="모임 만들기" compact onPress={() => setCreating(true)} />
        </>
      ) : null}

      {groups.map((g) => (
        <ListRow
          key={g.id}
          left={<Mark emoji={g.emoji ?? '🧳'} />}
          title={g.name}
          subtitle={`${g.memberCount}명 · 여행 ${g.tripCount}개`}
          onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
        />
      ))}

      <GroupForm
        visible={creating}
        onClose={() => setCreating(false)}
        onDone={(made) => {
          setCreating(false);
          /* 만들자마자 그 모임으로 들어갑니다. 다음에 할 일은 사람을 부르는
             것이고, 그 자리가 거기입니다. */
          router.push({ pathname: '/group/[id]', params: { id: made.id } });
        }}
      />
    </Screen>
  );
}
