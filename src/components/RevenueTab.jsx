import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ============================================================
// 定数・設定
// ============================================================
const PAID_MEDIUM_KEYWORDS = ["cpc", "display", "paidsocial"];
const ALLOWED_SOURCES = ["google", "yahoo", "msn", "facebook"];

const isPaidRow = (r) => {
  const medium = (r.utm_medium_last_touch__v2 || "").toLowerCase();
  const source = (r.utm_source_last_touch__v2 || "").toLowerCase();
  return (
    PAID_MEDIUM_KEYWORDS.some((k) => medium.includes(k)) &&
    ALLOWED_SOURCES.includes(source)
  );
};

const getMediaLabel = (source, medium) => {
  const s = (source || "").toLowerCase();
  const m = (medium || "").toLowerCase();
  if (s === "google"   && m.includes("cpc"))        return "Google 検索";
  if (s === "facebook" && (m.includes("paidsocial") || m.includes("cpc") || m.includes("display"))) return "Facebook";
  if (s === "msn"      && m.includes("cpc"))        return "Microsoft 検索";
  if (s === "yahoo"    && m.includes("cpc"))        return "Yahoo! 検索";
  if (s === "yahoo"    && m.includes("display"))    return "Yahoo! ディスプレイ";
  return `${source} / ${medium}`;
};

const DRILL_LEVELS = [
  { key: "_media",                       label: "媒体" },
  { key: "utm_campaign_last_touch__v2",  label: "Campaign" },
  { key: "utm_content_last_touch__v2",   label: "Content" },
  { key: "utm_term_last_touch__v2",      label: "Term" },
];

const GRANULARITIES = [
  { key: "daily",   label: "日別" },
  { key: "weekly",  label: "週別" },
  { key: "monthly", label: "月別" },
];

const MEDIA_COLORS = {
  "Google 検索":         "#4285F4",
  "Facebook":            "#F97316",
  "Microsoft 検索":      "#00A4EF",
  "Yahoo! 検索":         "#FF0033",
  "Yahoo! ディスプレイ": "#FF6B6B",
};
const FALLBACK_COLORS = ["#8b5cf6","#10b981","#f59e0b","#06b6d4","#84cc16","#ec4899","#6366f1"];
const getColor = (name, idx) => MEDIA_COLORS[name] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

const cleanVal = (v) => (!v || v === "null" || v === "(not set)") ? "(未設定)" : v;
const fmt     = (n) => n >= 1_000_000 ? `¥${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `¥${(n/1_000).toFixed(0)}K` : `¥${Math.round(n).toLocaleString()}`;
const fmtFull = (n) => `¥${Math.round(n).toLocaleString()}`;
const pad2 = (n) => String(n).padStart(2, "0");

// ============================================================
// 日付グルーピング
// ============================================================
const toWeekStart = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
};
const groupKey = (dateStr, gran) => {
  if (gran === "weekly")  return toWeekStart(dateStr);
  if (gran === "monthly") return dateStr.slice(0, 7);
  return dateStr;
};
const formatXLabel = (key, gran) => {
  if (gran === "monthly") return key;
  if (gran === "weekly")  return key.slice(5) + "W";
  return key.slice(5);
};

// ============================================================
// 期間プリセット計算
// ============================================================
const calcDateRange = (mode, customFrom, customTo, allDates) => {
  if (!allDates.length) return { from: "", to: "" };
  const lastDate = allDates[allDates.length - 1];
  const today = new Date(lastDate);

  if (mode === "yesterday") {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    const s = d.toISOString().slice(0, 10);
    return { from: s, to: s };
  }
  if (mode === "thisMonth") {
    const s = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-01`;
    return { from: s, to: lastDate };
  }
  if (mode === "lastMonth") {
    const d = new Date(today.getFullYear(), today.getMonth(), 0);
    const s = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
    const e = d.toISOString().slice(0, 10);
    return { from: s, to: e };
  }
  if (mode === "30d") {
    const d = new Date(today); d.setDate(d.getDate() - 29);
    return { from: d.toISOString().slice(0, 10), to: lastDate };
  }
  if (mode === "60d") {
    const d = new Date(today); d.setDate(d.getDate() - 59);
    return { from: d.toISOString().slice(0, 10), to: lastDate };
  }
  if (mode === "custom") {
    return { from: customFrom || "", to: customTo || "" };
  }
  return { from: "", to: "" }; // all
};

// ============================================================
// CSV パーサー
// ============================================================
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i]?.trim() ?? ""; });
    row._media = getMediaLabel(row.utm_source_last_touch__v2, row.utm_medium_last_touch__v2);
    return row;
  });
}

// ============================================================
// カスタム Tooltip
// ============================================================
function CustomTooltip({ active, payload, label, granularity }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm min-w-44">
      <p className="font-semibold text-gray-600 mb-1 text-xs">
        {granularity === "weekly" ? `週 ${label}〜` : label}
      </p>
      <p className="text-blue-700 font-bold mb-2 text-base">{fmtFull(total)}</p>
      {[...payload].reverse().map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3 text-xs mb-0.5">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
            <span className="text-gray-600 max-w-36 truncate">{p.name}</span>
          </span>
          <span className="font-medium text-gray-800">{fmtFull(p.value)}</span>
        </div>
      ))}
      <p className="text-xs text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100">クリックで内訳を表示</p>
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function RevenueTab({ rows, setRows, periodMode, customFrom, customTo }) {
  const [drillLevel, setDrillLevel]   = useState(0);
  const [drillFilters, setDrillFilters] = useState({});
  const [granularity, setGranularity] = useState("monthly");
  const [topN, setTopN]               = useState(8);

  // 選択バー（棒グラフクリック）
  const [selectedBar, setSelectedBar] = useState(null); // period key

  // ---------- ファイル読み込み ----------
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      setRows(parsed);
      setDrillLevel(0);
      setDrillFilters({});
      setSelectedBar(null);
    };
    reader.readAsText(file, "UTF-8");
  };

  // ---------- 広告フィルター ----------
  const paidRows = useMemo(() => rows.filter(isPaidRow), [rows]);

  // ---------- 全日付一覧（カレンダー用）----------
  const allDates = useMemo(() =>
    [...new Set(paidRows.map((r) => r.inquiry_date).filter(Boolean))].sort(),
    [paidRows]
  );

  // ---------- 期間フィルタ ----------
  const dateRange = useMemo(
    () => calcDateRange(periodMode, customFrom, customTo, allDates),
    [periodMode, customFrom, customTo, allDates]
  );

  const dateFilteredRows = useMemo(() => {
    const { from, to } = dateRange;
    if (!from && !to) return paidRows;
    return paidRows.filter((r) => {
      const d = r.inquiry_date;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });
  }, [paidRows, dateRange]);

  // ---------- selectedBar期間絞り込み ----------
  const barFilteredRows = useMemo(() => {
    if (!selectedBar) return dateFilteredRows;
    return dateFilteredRows.filter((r) => {
      const date = r.inquiry_date;
      if (!date || date === "null") return false;
      return groupKey(date, granularity) === selectedBar;
    });
  }, [dateFilteredRows, selectedBar, granularity]);

  // ---------- ドリルダウンフィルタ ----------
  const filteredRows = useMemo(() => {
    let result = barFilteredRows;
    if (drillFilters.media)    result = result.filter((r) => r._media === drillFilters.media);
    if (drillFilters.campaign) result = result.filter((r) => cleanVal(r.utm_campaign_last_touch__v2) === drillFilters.campaign);
    if (drillFilters.content)  result = result.filter((r) => cleanVal(r.utm_content_last_touch__v2)  === drillFilters.content);
    return result;
  }, [barFilteredRows, drillFilters]);

  const currentDimKey   = drillLevel === 0 ? "_media" : DRILL_LEVELS[drillLevel].key;
  const currentDimLabel = DRILL_LEVELS[drillLevel].label;

  // ---------- 上位キー ----------
  const topDimKeys = useMemo(() => {
    const map = {};
    filteredRows.forEach((r) => {
      const k = drillLevel === 0 ? r._media : cleanVal(r[currentDimKey]);
      map[k] = (map[k] || 0) + (parseFloat(r.total_expected_revenue) || 0);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return { top: sorted.slice(0, topN).map(([k]) => k), hasOthers: sorted.length > topN };
  }, [filteredRows, currentDimKey, drillLevel, topN]);

  // ---------- 時系列集計 ----------
  const chartData = useMemo(() => {
    const periodMap = {};
    filteredRows.forEach((r) => {
      const date = r.inquiry_date;
      if (!date || date === "null") return;
      const period = groupKey(date, granularity);
      const rawKey = drillLevel === 0 ? r._media : cleanVal(r[currentDimKey]);
      const dim = topDimKeys.top.includes(rawKey) ? rawKey : topDimKeys.hasOthers ? "その他" : rawKey;
      const arpu = parseFloat(r.total_expected_revenue) || 0;
      if (!periodMap[period]) periodMap[period] = { _rawPeriod: period };
      periodMap[period][dim] = (periodMap[period][dim] || 0) + arpu;
    });
    return Object.values(periodMap)
      .sort((a, b) => a._rawPeriod.localeCompare(b._rawPeriod))
      .map((d) => ({ ...d, label: formatXLabel(d._rawPeriod, granularity) }));
  }, [filteredRows, granularity, currentDimKey, drillLevel, topDimKeys]);

  // ---------- 棒グラフキー ----------
  const barKeys = useMemo(() => {
    const keys = new Set();
    chartData.forEach((d) => Object.keys(d).forEach((k) => {
      if (k !== "_rawPeriod" && k !== "label") keys.add(k);
    }));
    const ordered = [...topDimKeys.top.filter((k) => keys.has(k))];
    if (keys.has("その他")) ordered.push("その他");
    return ordered;
  }, [chartData, topDimKeys]);

  // ---------- KPI ----------
  const kpi = useMemo(() => ({
    arpu: filteredRows.reduce((s, r) => s + (parseFloat(r.total_expected_revenue) || 0), 0),
    lead: filteredRows.reduce((s, r) => s + (parseInt(r.lead_count)  || 0), 0),
    mql:  filteredRows.reduce((s, r) => s + (parseInt(r.mql_count)   || 0), 0),
    sal:  filteredRows.reduce((s, r) => s + (parseInt(r.sal_count)    || 0), 0),
    paid: filteredRows.reduce((s, r) => s + (parseInt(r.paid_contract_count) || 0), 0),
  }), [filteredRows]);

  // ---------- 通常テーブル（ドリルダウン用）----------
  const tableData = useMemo(() => {
    const map = {};
    filteredRows.forEach((r) => {
      const k = drillLevel === 0 ? r._media : cleanVal(r[currentDimKey]);
      if (!map[k]) map[k] = { name: k, arpu: 0, lead: 0, mql: 0, sal: 0 };
      map[k].arpu += parseFloat(r.total_expected_revenue) || 0;
      map[k].lead += parseInt(r.lead_count) || 0;
      map[k].mql  += parseInt(r.mql_count)  || 0;
      map[k].sal  += parseInt(r.sal_count)   || 0;
    });
    return Object.values(map).sort((a, b) => b.arpu - a.arpu).slice(0, 30);
  }, [filteredRows, currentDimKey, drillLevel]);

  // ---------- ドリルダウン操作 ----------
  const handleDrillDown = (name) => {
    if (drillLevel >= DRILL_LEVELS.length - 1) return;
    const filterKey = ["media","campaign","content","term"][drillLevel];
    setDrillFilters((prev) => ({ ...prev, [filterKey]: name }));
    setDrillLevel((prev) => prev + 1);
  };

  const handleBreadcrumb = (level) => {
    setDrillLevel(level);
    const keys = ["media","campaign","content","term"];
    const newFilters = {};
    keys.slice(0, level).forEach((k) => { if (drillFilters[k]) newFilters[k] = drillFilters[k]; });
    setDrillFilters(newFilters);
  };

  // ---------- 期間ラベル表示 ----------
  const periodLabel = useMemo(() => {
    const { from, to } = dateRange;
    if (!from && !to) return null;
    if (from === to) return from;
    return `${from} 〜 ${to}`;
  }, [dateRange]);

  // ============================================================
  // 空状態
  // ============================================================
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-4xl">📊</div>
        <p className="text-gray-500 text-sm">期待収益CSVをアップロードしてください</p>
        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
          CSVを選択
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
        <p className="text-xs text-gray-400">Databricksの plg_monitoring_daily_actual クエリ結果をそのままアップロード</p>
      </div>
    );
  }

  // ============================================================
  // メイン表示
  // ============================================================
  return (
    <div className="space-y-5 pb-8">

      {/* ヘッダー操作行 */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer bg-white border border-gray-300 hover:border-blue-400 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          CSVを再読込
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
        {periodLabel && (
          <span className="text-xs text-gray-400 ml-2">期間: {periodLabel}</span>
        )}
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "期待収益（合計）", value: fmt(kpi.arpu), sub: fmtFull(kpi.arpu), highlight: true },
          { label: "リード数",   value: kpi.lead.toLocaleString() },
          { label: "MQL数",     value: kpi.mql.toLocaleString() },
          { label: "SAL数",     value: kpi.sal.toLocaleString() },
          { label: "有料契約数", value: kpi.paid.toLocaleString() },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl p-4 border ${k.highlight ? "bg-blue-50 border-blue-200" : "bg-white border-gray-100"}`}>
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.highlight ? "text-blue-700" : "text-gray-800"}`}>{k.value}</p>
            {k.sub && <p className="text-xs text-blue-400 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* 積み上げ棒グラフ */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">

          {/* 粒度 */}
          <div className="flex gap-1">
            {GRANULARITIES.map((g) => (
              <button key={g.key} onClick={() => { setGranularity(g.key); setSelectedBar(null); }}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  granularity === g.key ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {g.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200" />

          {/* ドリルダウンパンくず */}
          <div className="flex items-center gap-1 text-xs">
            {DRILL_LEVELS.map((level, i) => (
              <span key={level.key} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300">›</span>}
                <button
                  onClick={() => i <= drillLevel && handleBreadcrumb(i)}
                  className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                    i === drillLevel
                      ? "bg-blue-600 text-white"
                      : i < drillLevel
                      ? "bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer"
                      : "text-gray-300 cursor-default"
                  }`}>
                  {i < drillLevel && drillFilters[["media","campaign","content","term"][i]]
                    ? (() => { const v = drillFilters[["media","campaign","content","term"][i]]; return v.length > 16 ? v.slice(0,16)+"…" : v; })()
                    : level.label}
                </button>
              </span>
            ))}
          </div>

          {/* 表示件数 */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-gray-500">上位:</span>
            {[5, 8, 10, 15].map((n) => (
              <button key={n} onClick={() => setTopN(n)}
                className={`text-xs px-2 py-1 rounded transition-colors ${topN === n ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 16, left: 16, bottom: 60 }}
            onClick={(e) => {
              if (e?.activePayload) {
                const period = e.activePayload[0]?.payload?._rawPeriod;
                if (period) setSelectedBar(selectedBar === period ? null : period);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              angle={granularity === "daily" ? -45 : -30}
              textAnchor="end"
              interval={granularity === "daily" ? "preserveStartEnd" : 0}
            />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip granularity={granularity} />} cursor={{ fill: "#f0f4ff" }} />
            {barKeys.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="a"
                radius={i === barKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={40}
                style={{ cursor: "pointer" }}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry._rawPeriod}
                    fill={key === "その他" ? "#d1d5db" : getColor(key, i)}
                    opacity={!selectedBar || selectedBar === entry._rawPeriod ? 1 : 0.35}
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>

        {/* 自前凡例 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center">
          {barKeys.map((key, i) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: key === "その他" ? "#d1d5db" : getColor(key, i) }} />
              {key}
            </span>
          ))}
        </div>
      </div>

      {/* テーブル（selectedBarがあればその期間の内訳、なければ期間合計） */}
      <div className={`bg-white rounded-xl overflow-hidden border-2 ${selectedBar ? "border-indigo-200" : "border-gray-100"}`}>
        <div className={`px-4 py-3 border-b flex items-center justify-between ${selectedBar ? "bg-indigo-50 border-indigo-100" : "border-gray-100"}`}>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedBar ? (
              <>
                <span className="text-sm font-semibold text-indigo-800">
                  📊 {formatXLabel(selectedBar, granularity)} の{currentDimLabel}別内訳
                </span>
                <span className="text-xs text-indigo-500 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                  合計: {fmtFull(tableData.reduce((s, d) => s + d.arpu, 0))}
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold text-gray-700">
                {currentDimLabel} 別明細（期間合計）
                {periodLabel && <span className="text-xs text-gray-400 font-normal ml-2">{periodLabel}</span>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {drillLevel < DRILL_LEVELS.length - 1 && (
              <span className={`text-xs ${selectedBar ? "text-indigo-400" : "text-gray-400"}`}>
                行をクリックで {DRILL_LEVELS[drillLevel + 1].label} へ →
              </span>
            )}
            {selectedBar && (
              <button onClick={() => { setSelectedBar(null); setDrillLevel(0); setDrillFilters({}); }}
                className="text-indigo-400 hover:text-indigo-600 text-sm px-1">✕</button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs text-gray-500 ${selectedBar ? "bg-indigo-50/50" : "bg-gray-50"}`}>
                <th className="text-left px-4 py-2.5 font-medium">{currentDimLabel}</th>
                <th className="text-right px-3 py-2.5 font-medium">期待収益</th>
                {selectedBar && <th className="text-right px-3 py-2.5 font-medium">構成比</th>}
                <th className="text-right px-3 py-2.5 font-medium">リード数</th>
                <th className="text-right px-3 py-2.5 font-medium">MQL数</th>
                <th className="text-right px-3 py-2.5 font-medium">SAL数</th>
                <th className="text-right px-4 py-2.5 font-medium">1リードあたり期待収益</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tableData.map((d, i) => {
                const total = tableData.reduce((s, x) => s + x.arpu, 0);
                const pct = total > 0 ? ((d.arpu / total) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={d.name}
                    onClick={() => drillLevel < DRILL_LEVELS.length - 1 && handleDrillDown(d.name)}
                    className={`transition-colors ${drillLevel < DRILL_LEVELS.length - 1 ? "hover:bg-blue-50 cursor-pointer" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: drillLevel === 0 ? getColor(d.name, i) : FALLBACK_COLORS[i % FALLBACK_COLORS.length] }} />
                        {d.name}
                        {drillLevel < DRILL_LEVELS.length - 1 && <span className="text-gray-300 text-xs ml-1">›</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-blue-700">{fmtFull(d.arpu)}</td>
                    {selectedBar && (
                      <td className="px-3 py-2.5 text-right text-gray-500 text-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          {pct}%
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-right text-gray-700">{d.lead.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{d.mql.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{d.sal.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500 text-xs pr-4">
                      {d.lead > 0 ? fmtFull(d.arpu / d.lead) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
