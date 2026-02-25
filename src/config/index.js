export { default as CONFIG_CHANNELS } from './channels.js';
export { default as CONFIG_CV } from './cv.js';
export { default as CONFIG_CSV_COLUMNS } from './csvColumns.js';
export { default as CONFIG_ALERTS } from './alerts.js';

import CONFIG_CHANNELS from './channels.js';
import CONFIG_CV from './cv.js';
import CONFIG_CSV_COLUMNS from './csvColumns.js';

// --- CONFIGから内部定数を自動生成（編集不要） ---
export const COL = CONFIG_CSV_COLUMNS;

export const CHANNEL_COLORS = Object.fromEntries(
  CONFIG_CHANNELS.map(ch => [ch.name, ch.color])
);
export const getColor = (s) => CHANNEL_COLORS[s] || "#6B7280";

export const SIRYO_KEYS = CONFIG_CV.siryo.keys;
export const FREE_KEYS = CONFIG_CV.free.keys;
export const OTHER_KEYS = CONFIG_CV.other.keys;
export const CV_COLORS = {
  tier1: "#6366F1",
  siryo: CONFIG_CV.siryo.color,
  free: CONFIG_CV.free.color,
};

export const NUM_COLS = [
  CONFIG_CSV_COLUMNS.cost, CONFIG_CSV_COLUMNS.impressions, CONFIG_CSV_COLUMNS.clicks,
  ...CONFIG_CSV_COLUMNS.extraNumeric,
  ...CONFIG_CV.siryo.keys.map(k => k.key),
  ...CONFIG_CV.free.keys.map(k => k.key),
  ...CONFIG_CV.other.keys.map(k => k.key),
  CONFIG_CSV_COLUMNS.tier1Total, CONFIG_CV.siryo.totalKey, CONFIG_CV.free.totalKey,
];

export const TREND_COLORS = [
  "#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6",
  "#EC4899","#14B8A6","#F97316","#06B6D4","#84CC16",
  "#A855F7","#FB923C",
];
