/*
 * ── アラート設定 ──
 * 
 * トレンド悪化と異常を検知するための閾値です。
 * 実運用しながら調整してください。
 *
 * - trendWindow:    比較する移動平均の期間（日数）
 * - trendLookback:  何日前のMAと比較するか
 * - cvDeclineRate:  CV減少アラートの閾値（例: -0.20 = 20%減）
 * - cpaIncreaseRate: CPA悪化アラートの閾値（例: 0.20 = 20%増）
 * - zeroCostCheck:  最終日のコスト0を検知するか
 */
const CONFIG_ALERTS = {
  trendWindow: 7,
  trendLookback: 14,
  cvDeclineRate: -0.20,
  cpaIncreaseRate: 0.20,
  zeroCostCheck: true,
};

export default CONFIG_ALERTS;
