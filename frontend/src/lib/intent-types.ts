/**
 * 기기 안의 모델이 내놓는 것.
 *
 * <p>웹과 앱이 같은 모양을 씁니다. 갈라지는 것은 <b>누가 이것을 만드는가</b>
 * 하나뿐이고(앱은 기기 안의 모델, 웹은 아무도) 그 아래는 한 길입니다.
 */

/**
 * 문장을 쪼갠 것.
 *
 * <p>서버의 {@code RecommendService.Intent} 와 같은 모양이어야 합니다.
 * 한쪽만 바꾸면 화면은 보냈다는데 서버가 못 알아듣습니다.
 */
export type Intent = {
  /** 지역 이름. 여행 맥락에서 이미 아는 경우가 많아 비어도 됩니다. */
  locationQuery: string | null;
  /** 갈래. 서버가 아는 열여섯 개 중 하나여야 쓰입니다. */
  category: string | null;
  /** "조용한", "아이랑" 같은 꾸미는 말. */
  keyword: string | null;
};

/**
 * 지금 기기가 어느 상태인지.
 *
 * <ul>
 *   <li><b>none</b> — 이 기기에서는 못 씁니다(웹, 또는 너무 좁은 기기).</li>
 *   <li><b>absent</b> — 쓸 수 있지만 아직 안 받았습니다.</li>
 *   <li><b>fetching</b> — 받는 중.</li>
 *   <li><b>ready</b> — 받아 두었습니다.</li>
 * </ul>
 */
export type IntentState = 'none' | 'absent' | 'fetching' | 'ready';

/** 받는 동안의 진행. 0에서 1 사이. */
export type Progress = number;
