/*
 * ── 媒体分類ルール ──
 *
 * 各媒体の判定条件を定義します。上から順に評価され、最初にマッチしたものが採用されます。
 *
 * - source:    utm_source の値（小文字で比較）
 * - medium:    utm_medium の値（省略時はチェックしない）
 * - campaign:  utm_campaign に含まれるキーワード（部分一致、配列で複数指定可）
 * - campName:  campaign_name に含まれるキーワード（部分一致、配列で複数指定可）
 * - name:      表示名
 * - color:     グラフの色
 *
 * 新しい媒体を追加するには、このリストに1エントリ追加するだけです。
 * 例: TikTok広告を追加 →
 *   { source: "tiktok", name: "TikTok", color: "#FF0050" },
 *
 * 同じsourceで複数チャネルがある場合、より具体的な条件を先に書いてください。
 * （例: Google P-MAX → Google リスティング の順）
 */
const CONFIG_CHANNELS = [
  // Google系（具体的な条件を先に）
  { source: "google", campaign: ["pmax"], campName: ["p-max", "pmax"], name: "Google P-MAX", color: "#0F9D58" },
  { source: "google", campaign: ["demandgen"], campName: ["ディマンドジェネレーション", "demand gen"], name: "Google デマンドジェネレーション", color: "#F4B400" },
  { source: "google", name: "Google リスティング", color: "#4285F4" },
  // Yahoo系
  { source: "yahoo", medium: "display", name: "Yahoo! ディスプレイ", color: "#FF6699" },
  { source: "yahoo", name: "Yahoo! リスティング", color: "#FF0033" },
  // Microsoft系
  { source: "msn", medium: "display", name: "Microsoft ディスプレイ", color: "#7FBA00" },
  { source: "msn", name: "Microsoft 検索", color: "#00A4EF" },
  // Facebook / Meta
  { source: "facebook", name: "Facebook", color: "#FF6D2E" },
  // ── 新しい媒体はここに追加 ──
  // { source: "tiktok", name: "TikTok", color: "#FF0050" },
  // { source: "line", name: "LINE広告", color: "#06C755" },
];

export default CONFIG_CHANNELS;
