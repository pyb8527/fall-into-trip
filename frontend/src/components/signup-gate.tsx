import { useRouter } from 'expo-router';

import {
  forgetComeback,
  rememberComeback,
  type Comeback,
  type ComebackDo,
} from '@/lib/comeback';
import { Body, BottomSheet, Button, Caption } from '@/ui';

/**
 * 계정이 필요할 때 그 자리에서 이유를 말합니다.
 *
 * <h3>왜 필요한가</h3>
 *
 * <p>지금까지는 추천이나 가져오기를 누르면 <b>말없이 로그인 화면으로
 * 튕겼습니다.</b> 구경하러 들어온 사람 입장에서는 갑자기 낯선 화면이
 * 뜬 것이고, 왜 그랬는지 모르면 그냥 닫습니다.
 *
 * <p>여기서 막는 이유는 기능마다 다릅니다. 보석함은 사람마다 따로라서,
 * 하트는 누가 눌렀는지 세야 해서, 댓글은 누가 쓴 말인지 남아야 해서.
 * 그 한 줄을 그 자리에서 말해 주면 "가두려는 것" 이 아니라 "그래야
 * 되는 것" 으로 읽힙니다.
 *
 * <h3>얻는 것으로 말합니다</h3>
 *
 * <p>"로그인이 필요합니다" 는 우리 사정입니다. 읽는 사람이 알고 싶은
 * 것은 계정을 만들면 무엇이 되느냐입니다.
 */

/** 무엇을 하려다 막혔는지에 따라 하는 말이 달라집니다. */
const SAY: Record<ComebackDo, { title: string; why: string }> = {
  copy: {
    title: '가져오려면 계정이 필요해요',
    why: '내 여행으로 복사하면 날짜도 장소도 마음대로 고칠 수 있습니다. 원래 글은 그대로 남습니다.',
  },
  save: {
    title: '보석함은 사람마다 따로예요',
    why: '가고 싶은 곳을 주워 두면 다음 여행을 짤 때 지도에서 바로 꺼내 씁니다.',
  },
  like: {
    title: '눌러 둔 것을 다시 찾으려면',
    why: '하트를 누른 글은 「내가 누른」 에 모입니다. 계정이 없으면 모아 둘 자리가 없습니다.',
  },
  comment: {
    title: '누가 쓴 말인지 남아야 해요',
    why: '이름 없이 남긴 말은 답을 받을 수도, 나중에 고치거나 지울 수도 없습니다.',
  },
  report: {
    title: '신고는 한 사람이 한 번만',
    why: '누가 신고했는지 세어야 한 사람이 여러 번 눌러 남의 글을 내리는 일을 막습니다.',
  },
  join: {
    title: '함께 짜려면 계정이 필요해요',
    why: '동행자로 들어가면 같은 일정을 같이 고치고, 서로 고친 것이 알림으로 옵니다.',
  },
};

/**
 * @param intent 하려던 일. null 이면 판이 닫혀 있습니다.
 */
export function SignUpGate({
  intent,
  onClose,
}: {
  intent: Comeback | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const say = intent ? SAY[intent.what] : null;

  /**
   * 가입·로그인 화면으로.
   *
   * <p>돌아올 자리는 주소에 싣고, 무엇을 하려 했는지는 메모리에 둡니다.
   * 주소는 남에게 복사되지만 메모리는 이 탭에만 있습니다.
   */
  function go(to: '/(auth)/register' | '/(auth)/login') {
    if (!intent) {
      return;
    }
    rememberComeback(intent);
    router.push(`${to}?next=${encodeURIComponent(intent.where)}`);
  }

  return (
    <BottomSheet
      visible={!!say}
      title={say?.title ?? ''}
      onClose={() => {
        /* 닫았으면 하려던 일도 접습니다. 들고 있다가 나중에 엉뚱한 때에
           튀어나오면 누른 적 없는 일이 일어납니다. */
        forgetComeback();
        onClose();
      }}
      footer={
        <>
          <Button label="가입하고 이어서 하기" onPress={() => go('/(auth)/register')} />
          <Button
            label="이미 계정이 있어요"
            variant="ghost"
            onPress={() => go('/(auth)/login')}
          />
        </>
      }>
      <Body tone="secondary">{say?.why}</Body>
      {/* 가입이 얼마나 걸리는지를 먼저 말해 둡니다. 여기서 망설이는 이유는
          대개 "귀찮을 것 같아서" 입니다. */}
      <Caption tone="secondary">
        이메일과 비밀번호만 있으면 됩니다. 가입하고 나면 방금 누른 자리로 돌아옵니다.
      </Caption>
    </BottomSheet>
  );
}
