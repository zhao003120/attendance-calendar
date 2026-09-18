/**
 * 2026年中国法定节假日及调休数据
 * 数据来源：国务院办公厅关于2026年部分节假日安排的通知
 * https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm
 *
 * 日类型说明：
 *   holiday    — 法定假日（放假）
 *   workmakeup — 调休上班（周末补班）
 */
const HOLIDAY_DATA = {
  // ===== 元旦：1月1日(周四) =====
  // 放假：1月1日(四) ~ 1月3日(六)，共3天
  // 调休上班：1月4日(日)
  '2026-01-01': { type: 'holiday', name: '元旦' },
  '2026-01-02': { type: 'holiday', name: '元旦' },
  '2026-01-03': { type: 'holiday', name: '元旦' },
  '2026-01-04': { type: 'workmakeup', name: '元旦调休上班' },

  // ===== 春节：2月17日(周二，正月初一) =====
  // 放假：2月15日(日) ~ 2月23日(一)，共9天
  // 调休上班：2月14日(六)、2月28日(六)
  '2026-02-14': { type: 'workmakeup', name: '春节调休上班' },
  '2026-02-15': { type: 'holiday', name: '春节（腊月二十八）' },
  '2026-02-16': { type: 'holiday', name: '春节（除夕）' },
  '2026-02-17': { type: 'holiday', name: '春节（正月初一）' },
  '2026-02-18': { type: 'holiday', name: '春节' },
  '2026-02-19': { type: 'holiday', name: '春节' },
  '2026-02-20': { type: 'holiday', name: '春节' },
  '2026-02-21': { type: 'holiday', name: '春节' },
  '2026-02-22': { type: 'holiday', name: '春节' },
  '2026-02-23': { type: 'holiday', name: '春节（正月初七）' },
  '2026-02-28': { type: 'workmakeup', name: '春节调休上班' },

  // ===== 清明节：4月5日(周日) =====
  // 放假：4月4日(六) ~ 4月6日(一)，共3天，无调休
  '2026-04-04': { type: 'holiday', name: '清明节' },
  '2026-04-05': { type: 'holiday', name: '清明节' },
  '2026-04-06': { type: 'holiday', name: '清明节' },

  // ===== 劳动节：5月1日(周五) =====
  // 放假：5月1日(五) ~ 5月5日(二)，共5天
  // 调休上班：5月9日(六)
  '2026-05-01': { type: 'holiday', name: '劳动节' },
  '2026-05-02': { type: 'holiday', name: '劳动节' },
  '2026-05-03': { type: 'holiday', name: '劳动节' },
  '2026-05-04': { type: 'holiday', name: '劳动节' },
  '2026-05-05': { type: 'holiday', name: '劳动节' },
  '2026-05-09': { type: 'workmakeup', name: '劳动节调休上班' },

  // ===== 端午节：6月19日(周五) =====
  // 放假：6月19日(五) ~ 6月21日(日)，共3天，无调休
  '2026-06-19': { type: 'holiday', name: '端午节' },
  '2026-06-20': { type: 'holiday', name: '端午节' },
  '2026-06-21': { type: 'holiday', name: '端午节' },

  // ===== 中秋节：9月25日(周五) =====
  // 放假：9月25日(五) ~ 9月27日(日)，共3天，无调休
  '2026-09-25': { type: 'holiday', name: '中秋节' },
  '2026-09-26': { type: 'holiday', name: '中秋节' },
  '2026-09-27': { type: 'holiday', name: '中秋节' },

  // ===== 国庆节：10月1日(周四) =====
  // 放假：10月1日(四) ~ 10月7日(三)，共7天
  // 调休上班：9月20日(日)、10月10日(六)
  '2026-09-20': { type: 'workmakeup', name: '国庆调休上班' },
  '2026-10-01': { type: 'holiday', name: '国庆节' },
  '2026-10-02': { type: 'holiday', name: '国庆节' },
  '2026-10-03': { type: 'holiday', name: '国庆节' },
  '2026-10-04': { type: 'holiday', name: '国庆节' },
  '2026-10-05': { type: 'holiday', name: '国庆节' },
  '2026-10-06': { type: 'holiday', name: '国庆节' },
  '2026-10-07': { type: 'holiday', name: '国庆节' },
  '2026-10-10': { type: 'workmakeup', name: '国庆调休上班' },
};

const HOLIDAY_SUMMARIES = [
  { name: '元旦',   dates: '1月1日~1月3日',   days: 3, makeup: '1月4日' },
  { name: '春节',   dates: '2月15日~2月23日',  days: 9, makeup: '2月14日、2月28日' },
  { name: '清明节', dates: '4月4日~4月6日',    days: 3, makeup: '无' },
  { name: '劳动节', dates: '5月1日~5月5日',    days: 5, makeup: '5月9日' },
  { name: '端午节', dates: '6月19日~6月21日',  days: 3, makeup: '无' },
  { name: '中秋节', dates: '9月25日~9月27日',  days: 3, makeup: '无' },
  { name: '国庆节', dates: '10月1日~10月7日',  days: 7, makeup: '9月20日、10月10日' },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HOLIDAY_DATA, HOLIDAY_SUMMARIES };
}
