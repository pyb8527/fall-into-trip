import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Consent } from '@/auth/auth-provider';
import { Colors, Spacing, Type, Weight } from '@/constants/theme';
import { Checkbox, Row } from '@/ui';

/** 아무것도 안 켠 처음 값. */
export const NO_CONSENT: Consent = { over14: false, terms: false, privacy: false };

/** 셋 다 켰는지. 서버도 같은 것을 봅니다({@code AuthDtos.AgreeRequest#agreedAll}). */
export function agreedAll(c: Consent): boolean {
  return c.over14 && c.terms && c.privacy;
}

/**
 * 가입할 때와 동의 화면에서 쓰는 세 칸 + 「모두 동의」.
 *
 * <h3>셋을 따로 둡니다</h3>
 *
 * <p>「만 14세 이상」 · 「이용약관」 · 「개인정보 수집 · 이용」은 법이 따로
 * 묻게 하는 것들입니다(개인정보 보호법 제22조). 한 칸으로 묶으면 무엇에
 * 동의했는지가 흐려집니다. 대신 맨 위에 「모두 동의」를 두어 한 번에 켤 수
 * 있게 합니다 — 국내 앱 가입 화면이 거의 다 이 꼴이라 사람들이 익숙합니다.
 *
 * <p>「모두 동의」는 넷째 칸이 아닙니다. 셋이 다 켜져 있을 때 켜진 것으로
 * 보이고, 누르면 셋을 한꺼번에 켜거나 끕니다. 그래서 따로 값을 들지 않습니다.
 *
 * <h3>문서는 새 창으로 엽니다</h3>
 *
 * <p>문서(/terms · /privacy)는 앱 화면이 아니라 따로 둔 정적 문서입니다. 이
 * 화면에서 그리로 넘어가 버리면 적던 칸이 다 날아가므로 새 창으로 엽니다.
 * 앱(껍데기) 안에서는 같은 자리라 웹뷰가 그대로 띄우고, 뒤로가기로
 * 돌아옵니다.
 */
export function ConsentChecks({
  value,
  onChange,
}: {
  value: Consent;
  onChange: (next: Consent) => void;
}) {
  const all = agreedAll(value);
  const flip = (key: keyof Consent) => onChange({ ...value, [key]: !value[key] });

  return (
    <View style={styles.box}>
      <CheckLine
        label="모두 동의"
        strong
        checked={all}
        onToggle={() => onChange({ over14: !all, terms: !all, privacy: !all })}
      />
      <View style={styles.line} />
      <CheckLine label="만 14세 이상이에요" checked={value.over14} onToggle={() => flip('over14')} />
      <CheckLine
        label="이용약관에 동의해요"
        checked={value.terms}
        onToggle={() => flip('terms')}
        doc="/terms"
      />
      <CheckLine
        label="개인정보 수집 · 이용에 동의해요"
        checked={value.privacy}
        onToggle={() => flip('privacy')}
        doc="/privacy"
      />
    </View>
  );
}

/**
 * 한 줄. 네모만이 아니라 글자를 눌러도 켜집니다 — 네모 하나는 손가락에 작습니다.
 *
 * @param doc 「보기」로 열 문서. 없으면 그 자리를 안 그립니다
 */
function CheckLine({
  label,
  checked,
  onToggle,
  strong,
  doc,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  strong?: boolean;
  doc?: string;
}) {
  return (
    <Row gap={Spacing.s1} style={styles.row}>
      <Checkbox checked={checked} onChange={onToggle} label={label} />
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.labelTap}>
        <Text style={[styles.label, strong ? styles.labelStrong : null]}>
          {label}
          {strong ? null : <Text style={styles.need}> (필수)</Text>}
        </Text>
      </Pressable>
      {doc ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${label.replace(/에 동의해요$/, '')} 보기`}
          hitSlop={Spacing.s2}
          onPress={() => Linking.openURL(doc)}
          style={styles.docTap}>
          <Text style={styles.doc}>보기</Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.s1,
  },
  row: {
    alignItems: 'center',
  },
  labelTap: {
    flex: 1,
    paddingVertical: Spacing.s2,
  },
  label: {
    ...Type.body2,
    color: Colors.text,
  },
  labelStrong: {
    fontWeight: Weight.semibold,
  },
  need: {
    color: Colors.textMuted,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing.s1,
  },
  docTap: {
    paddingHorizontal: Spacing.s2,
    paddingVertical: Spacing.s2,
  },
  doc: {
    ...Type.caption,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
