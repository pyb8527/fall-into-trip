import { useRouter } from 'expo-router';
import { useState } from 'react';

import { api } from '@/api/client';
import type { Group } from '@/api/types';
import { useAsync } from '@/api/use-async';
import { GroupForm } from '@/components/group-form';
import { Spacing } from '@/constants/theme';
import {
  Body,
  Button,
  Caption,
  Card,
  Empty,
  ErrorNote,
  ListRow,
  Loading,
  Row,
  Screen,
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
 */
export default function Groups() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const { data, error, loading, reload } = useAsync<{ groups: Group[] }>(
    (signal) => api.get('/api/groups', signal),
    [],
  );

  const groups = data?.groups ?? [];

  return (
    <Screen
      safeTop
      tabs={<AppTabs />}
      footer={<Button label="새 모임 만들기" onPress={() => setCreating(true)} />}>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {data && groups.length === 0 ? (
        <>
          <Empty message="아직 든 모임이 없어요." />
          {/* 빈 화면에 「만들어 보세요」 만 두면 무엇을 위한 것인지 모릅니다.
              모임이 무엇을 바꾸는지 한 줄로 말해 줍니다. */}
          <Card>
            <Caption tone="secondary">
              모임을 만들고 사람을 부르면, 그 안에서 만든 여행은 모임 사람 모두에게
              보여요. 일정도 누구나 고칠 수 있어요.
            </Caption>
          </Card>
        </>
      ) : null}

      {groups.map((g) => (
        <ListRow
          key={g.id}
          left={<Body>{g.emoji ?? '🧳'}</Body>}
          title={g.name}
          subtitle={g.about ?? undefined}
          right={
            <Row gap={Spacing.xs}>
              <Caption tone="secondary">
                {g.memberCount}명 · 여행 {g.tripCount}
              </Caption>
            </Row>
          }
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
