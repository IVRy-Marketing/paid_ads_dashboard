/*
 * ── CSVカラム設定 ──
 * CSV上のコスト・インプレッション・クリックのカラム名です。
 * Databricksのエクスポート形式が変わった場合はここを修正してください。
 */
const CONFIG_CSV_COLUMNS = {
  date: "paid_date",
  cost: "content_cost",
  impressions: "content_impressions",
  clicks: "content_clicks",
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  campaignName: "campaign_name",
  campaignId: "campaign_id",
  adgroupName: "adgroup_name",
  adgroupId: "adgroup_id",
  tier1Total: "total_tier1cv_cnt",
  extraNumeric: ["allocation_ratio"],
};

export default CONFIG_CSV_COLUMNS;
