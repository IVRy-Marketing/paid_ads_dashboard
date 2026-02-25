import _ from 'lodash';
import {
  COL, CONFIG_CSV_COLUMNS, CONFIG_CHANNELS, SIRYO_KEYS, FREE_KEYS, OTHER_KEYS, NUM_COLS,
} from '../config/index.js';

// --- フォーマッター ---
export const fmt = (n, d = 0) =>
  n != null
    ? Number(n).toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "-";

export const fmtPct = (n) =>
  n != null ? (n >= 0 ? "+" : "") + n.toFixed(1) + "%" : "-";

export const pctChg = (a, b) => (b ? ((a - b) / b) * 100 : null);

export const safeCpa = (cost, cv) => (cv > 0.01 ? Math.round(cost / cv) : null);

// --- CSV行パーサー ---
export function parseRow(r) {
  const row = {};
  for (const k of Object.keys(r)) {
    const key = k.trim();
    const val = typeof r[k] === "string" ? r[k].trim() : r[k];
    row[key] = NUM_COLS.includes(key)
      ? (parseFloat(String(val).replace(/,/g, "")) || 0)
      : val;
  }
  const s = SIRYO_KEYS.reduce((a, k) => a + (row[k.key] || 0), 0);
  const f = FREE_KEYS.reduce((a, k) => a + (row[k.key] || 0), 0);
  if (!row[CONFIG_CSV_COLUMNS.tier1Total]) row[CONFIG_CSV_COLUMNS.tier1Total] = s + f;
  if (!row[CONFIG_CSV_COLUMNS.tier1Total]) row[CONFIG_CSV_COLUMNS.tier1Total] = s + f;
  // siryo / free totalの自動補完
  const cvConfig = { siryo: { totalKey: "total_siryo_cnt" }, free: { totalKey: "total_free_acount_cnt" } };
  if (!row[cvConfig.siryo.totalKey]) row[cvConfig.siryo.totalKey] = s;
  if (!row[cvConfig.free.totalKey]) row[cvConfig.free.totalKey] = f;
  return row;
}

// --- 媒体分類 ---
export function classifyChannel(row) {
  const src = (row[CONFIG_CSV_COLUMNS.source] || "").toLowerCase();
  const med = (row[CONFIG_CSV_COLUMNS.medium] || "").toLowerCase();
  const utmCamp = (row[CONFIG_CSV_COLUMNS.campaign] || "").toLowerCase();
  const campName = (row[CONFIG_CSV_COLUMNS.campaignName] || "").toLowerCase();
  for (const ch of CONFIG_CHANNELS) {
    if (src !== ch.source) continue;
    if (ch.medium && med !== ch.medium) continue;
    if (ch.campaign || ch.campName) {
      const campMatch = ch.campaign ? ch.campaign.some(kw => utmCamp.includes(kw)) : false;
      const nameMatch = ch.campName ? ch.campName.some(kw => campName.includes(kw)) : false;
      if (!campMatch && !nameMatch) continue;
    }
    return ch.name;
  }
  return src || "その他";
}

// --- 集計 ---
export function agg(rows) {
  const o = {
    cost: _.sumBy(rows, CONFIG_CSV_COLUMNS.cost),
    imp: _.sumBy(rows, CONFIG_CSV_COLUMNS.impressions),
    clicks: _.sumBy(rows, CONFIG_CSV_COLUMNS.clicks),
    tier1: _.sumBy(rows, CONFIG_CSV_COLUMNS.tier1Total),
    siryo: _.sumBy(rows, "total_siryo_cnt"),
    free: _.sumBy(rows, "total_free_acount_cnt"),
  };
  SIRYO_KEYS.forEach(k => o[k.key] = _.sumBy(rows, k.key));
  FREE_KEYS.forEach(k => o[k.key] = _.sumBy(rows, k.key));
  OTHER_KEYS.forEach(k => o[k.key] = _.sumBy(rows, k.key));
  return o;
}

// --- レート計算 ---
export function rates(a) {
  return {
    ...a,
    ctr: a.imp ? (a.clicks / a.imp * 100) : 0,
    cvr: a.clicks ? (a.tier1 / a.clicks * 100) : 0,
    cpa: safeCpa(a.cost, a.tier1),
    cpa_siryo: safeCpa(a.cost, a.siryo),
    cpa_free: safeCpa(a.cost, a.free),
    cpm: a.imp ? Math.round(a.cost / a.imp * 1000) : 0,
    cpc: a.clicks ? Math.round(a.cost / a.clicks) : 0,
  };
}
