import { useState, useMemo, useCallback } from "react";
import Papa from "papaparse";
import _ from "lodash";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import CalendarPicker from "./CalendarPicker";

/* ============================================================
   CONFIG
============================================================ */
const CHANNEL_COLORS = {
  "facebook / paidsocial": "#F97316",
  "google / cpc": "#3B82F6",
  "yahoo / cpc": "#EF4444",
  "yahoo / display": "#EC4899",
  "msn / cpc": "#06B6D4",
};

const BAR_COLORS = ["#6366F1", "#F97316", "#10B981", "#EF4444", "#EC4899", "#06B6D4", "#8B5CF6", "#F59E0B", "#14B8A6", "#F43F5E", "#A855F7", "#64748B", "#0EA5E9", "#D946EF", "#84CC16"];

/* ============================================================
   UTILITIES
============================================================ */
const fmt = (n) => (n == null ? "-" : n.toLocaleString());
const fmtPct = (n, d = 1) => (n == null || isNaN(n) ? "-" : n.toFixed(d) + "%");

const parseCSV = (text) => {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data.map((r) => ({
    date: r.session_date,
    source: r.utm_source,
    medium: r.utm_medium,
    campaign: r.utm_campaign || "(empty)",
    content: r.utm_content || "(empty)",
    term: r.utm_term || "(empty)",
    channel: `${r.utm_source} / ${r.utm_medium}`,
    tier1: +r.total_tier1cv_cnt || 0,
    siryo: +r.total_siryo_cnt || 0,
    free: +r.total_free_acount_cnt || 0,
    midep: +r.generate_lead_midep_uu || 0,
    obj: +r.generate_lead_0abj_uu || 0,
    push: +r.generate_lead_push_uu || 0,
    ai: +r.generate_lead_ai_uu || 0,
    aifax: +r.generate_lead_aifax_uu || 0,
    democall: +r.generate_lead_democall_dl_uu || 0,
    reg_ivr: +r.account_reg_ivr_uu || 0,
    reg_ivr_num: +r.account_reg_ivr_num_uu || 0,
    reg_num: +r.account_reg_num_uu || 0,
    costsim: +r.cost_sim_complete_uu || 0,
    reg_none: +r.account_reg_none_uu || 0,
  }));
};

const agg = (rows) => ({
  tier1: _.sumBy(rows, "tier1"),
  siryo: _.sumBy(rows, "siryo"),
  free: _.sumBy(rows, "free"),
});

const downloadCSV = (rows, columns, filename) => {
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((r) => columns.map((c) => {
    const val = c.getValue ? c.getValue(r) : r[c.key];
    return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
  }).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const copyTable = (rows, columns, setCopied) => {
  const header = columns.map((c) => c.label).join("\t");
  const body = rows.map((r) => columns.map((c) => {
    const val = c.getValue ? c.getValue(r) : r[c.key];
    return val;
  }).join("\t")).join("\n");
  navigator.clipboard.writeText(header + "\n" + body).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
};

/* ============================================================
   COMPONENTS
============================================================ */

const Pill = ({ active, onClick, children, color }) => (
  <button onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${active ? "text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
    style={active ? { backgroundColor: color || "#6366F1" } : {}}>
    {children}
  </button>
);

const SortIcon = ({ col, sortKey, sortDir }) => {
  if (col !== sortKey) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
};

/* ── Term Bar Chart (Horizontal) ── */
const TermBarChart = ({ data, title, compareData, compareMode }) => {
  const termData = useMemo(() => {
    const groups = _.groupBy(data, "term");
    const cGroups = compareMode && compareData ? _.groupBy(compareData, "term") : {};
    return Object.entries(groups)
      .map(([term, rows]) => {
        const cRows = cGroups[term] || [];
        return {
          term: term.length > 25 ? term.slice(0, 23) + "…" : term,
          fullTerm: term,
          ...agg(rows),
          ...(compareMode ? { tier1_compare: _.sumBy(cRows, "tier1"), siryo_compare: _.sumBy(cRows, "siryo"), free_compare: _.sumBy(cRows, "free") } : {}),
        };
      })
      .sort((a, b) => b.tier1 - a.tier1)
      .slice(0, 15);
  }, [data, compareData, compareMode]);

  if (termData.length === 0) return null;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
        <div className="font-bold text-gray-800 mb-1 max-w-[280px] break-words">{d.fullTerm}</div>
        <div className="text-gray-700">Tier1 CV: <span className="font-bold">{fmt(d.tier1)}</span></div>
        <div className="text-orange-600">資料請求: <span className="font-bold">{fmt(d.siryo)}</span></div>
        <div className="text-emerald-600">無料AC: <span className="font-bold">{fmt(d.free)}</span></div>
        {compareMode && d.tier1_compare != null && (
          <>
            <div className="mt-1 pt-1 border-t border-gray-100 text-gray-400">比較期間</div>
            <div className="text-gray-500">Tier1 CV: <span className="font-bold">{fmt(d.tier1_compare)}</span></div>
            <div className="text-gray-500">資料請求: <span className="font-bold">{fmt(d.siryo_compare)}</span></div>
            <div className="text-gray-500">無料AC: <span className="font-bold">{fmt(d.free_compare)}</span></div>
          </>
        )}
      </div>
    );
  };

  const barHeight = compareMode ? 40 : 32;

  return (
    <div className="mb-5">
      <div className="text-xs font-semibold text-gray-600 mb-2">{title || "ターム別 Tier1 CV（上位15件）"}</div>
      <ResponsiveContainer width="100%" height={Math.max(termData.length * barHeight + 40, 150)}>
        <BarChart data={termData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="term" tick={{ fontSize: 10 }} width={180} />
          <Tooltip content={<CustomTooltip />} />
          {compareMode && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Bar dataKey="tier1" name={compareMode ? "現在の期間" : "Tier1 CV"} fill="#6366F1" radius={[0, 4, 4, 0]} barSize={compareMode ? 14 : 18}>
            {!compareMode && termData.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
          {compareMode && (
            <Bar dataKey="tier1_compare" name="比較期間" fill="#9CA3AF" radius={[0, 4, 4, 0]} barSize={14} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ── Diff display helper ── */
const DiffCell = ({ current, compare, color }) => {
  const diff = current - compare;
  const cls = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400";
  return (
    <td className={`px-3 py-2 text-right text-xs ${color || ""}`}>
      <div>{fmt(compare)}</div>
      <div className={`${cls} text-[10px]`}>{diff > 0 ? "+" : ""}{fmt(diff)}</div>
    </td>
  );
};

/* ── Flat Table ── */
const FlatTable = ({ data, compareData, compareMode }) => {
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [filters, setFilters] = useState({ channel: "", campaign: "", content: "", term: "" });
  const [copied, setCopied] = useState(false);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let rows = data;
    if (filters.channel) rows = rows.filter((r) => r.channel === filters.channel);
    if (filters.campaign) rows = rows.filter((r) => r.campaign === filters.campaign);
    if (filters.content) rows = rows.filter((r) => r.content === filters.content);
    if (filters.term) rows = rows.filter((r) => r.term === filters.term);
    return rows;
  }, [data, filters]);

  const sorted = useMemo(() => _.orderBy(filtered, [sortKey], [sortDir]), [filtered, sortKey, sortDir]);
  const totals = useMemo(() => agg(filtered), [filtered]);

  const uniqueChannels = useMemo(() => _.uniq(data.map((r) => r.channel)).sort(), [data]);
  const uniqueCampaigns = useMemo(() => {
    const rows = filters.channel ? data.filter((r) => r.channel === filters.channel) : data;
    return _.uniq(rows.map((r) => r.campaign)).sort();
  }, [data, filters.channel]);
  const uniqueContents = useMemo(() => {
    let rows = data;
    if (filters.channel) rows = rows.filter((r) => r.channel === filters.channel);
    if (filters.campaign) rows = rows.filter((r) => r.campaign === filters.campaign);
    return _.uniq(rows.map((r) => r.content)).sort();
  }, [data, filters.channel, filters.campaign]);
  const uniqueTerms = useMemo(() => {
    let rows = data;
    if (filters.channel) rows = rows.filter((r) => r.channel === filters.channel);
    if (filters.campaign) rows = rows.filter((r) => r.campaign === filters.campaign);
    if (filters.content) rows = rows.filter((r) => r.content === filters.content);
    return _.uniq(rows.map((r) => r.term)).sort();
  }, [data, filters.channel, filters.campaign, filters.content]);

  const updateFilter = (key, val) => {
    const next = { ...filters, [key]: val };
    if (key === "channel") { next.campaign = ""; next.content = ""; next.term = ""; }
    if (key === "campaign") { next.content = ""; next.term = ""; }
    if (key === "content") { next.term = ""; }
    setFilters(next);
  };

  const FilterSelect = ({ label, value, options, filterKey }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <select value={value} onChange={(e) => updateFilter(filterKey, e.target.value)}
        className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white min-w-0">
        <option value="">すべて</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  /* compare: aggregate compareData by term for matching */
  const compareByTerm = useMemo(() => {
    if (!compareMode || !compareData) return {};
    const groups = _.groupBy(compareData, "term");
    return _.mapValues(groups, (rows) => agg(rows));
  }, [compareData, compareMode]);

  const cols = [
    { key: "date", label: "日付", align: "left" },
    { key: "channel", label: "媒体", align: "left" },
    { key: "campaign", label: "キャンペーン", align: "left" },
    { key: "content", label: "コンテンツ", align: "left" },
    { key: "term", label: "ターム", align: "left" },
    { key: "tier1", label: "Tier1 CV", align: "right" },
    { key: "siryo", label: "資料請求", align: "right" },
    { key: "free", label: "無料AC", align: "right" },
  ];

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
        <FilterSelect label="媒体" value={filters.channel} options={uniqueChannels} filterKey="channel" />
        <FilterSelect label="キャンペーン" value={filters.campaign} options={uniqueCampaigns} filterKey="campaign" />
        <FilterSelect label="コンテンツ" value={filters.content} options={uniqueContents} filterKey="content" />
        <FilterSelect label="ターム" value={filters.term} options={uniqueTerms} filterKey="term" />
      </div>

      <TermBarChart data={filtered} title="絞り込み結果：ターム別 Tier1 CV（上位15件）" compareData={compareData} compareMode={compareMode} />

      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">
          {sorted.length} 件表示 / 合計 Tier1 CV: <span className="font-bold text-gray-800">{fmt(totals.tier1)}</span>
          {" "}資料請求: <span className="font-bold text-orange-600">{fmt(totals.siryo)}</span>
          {" "}無料AC: <span className="font-bold text-emerald-600">{fmt(totals.free)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            const exportCols = [
              { key: "date", label: "日付" }, { key: "channel", label: "媒体" },
              { key: "campaign", label: "キャンペーン" }, { key: "content", label: "コンテンツ" },
              { key: "term", label: "ターム" }, { key: "tier1", label: "Tier1 CV" },
              { key: "siryo", label: "資料請求" }, { key: "free", label: "無料AC" },
            ];
            copyTable(sorted, exportCols, setCopied);
          }} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors">
            {copied ? "✅ コピー済み" : "📋 表をコピー"}
          </button>
          <button onClick={() => {
            const exportCols = [
              { key: "date", label: "日付" }, { key: "channel", label: "媒体" },
              { key: "campaign", label: "キャンペーン" }, { key: "content", label: "コンテンツ" },
              { key: "term", label: "ターム" }, { key: "tier1", label: "Tier1 CV" },
              { key: "siryo", label: "資料請求" }, { key: "free", label: "無料AC" },
            ];
            downloadCSV(sorted, exportCols, "ga4_cv_flat.csv");
          }} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors">
            📥 CSVダウンロード
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-[420px] border border-gray-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {cols.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c.key)}
                  className={`px-3 py-2 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>
                  {c.label}<SortIcon col={c.key} sortKey={sortKey} sortDir={sortDir} />
                </th>
              ))}
              {compareMode && (
                <>
                  <th className="px-3 py-2 text-right font-semibold text-gray-400 whitespace-nowrap bg-gray-100/60">比較 Tier1</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-400 whitespace-nowrap bg-gray-100/60">比較 資料</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-400 whitespace-nowrap bg-gray-100/60">比較 無料AC</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const cmp = compareMode ? (compareByTerm[r.term] || { tier1: 0, siryo: 0, free: 0 }) : null;
              return (
                <tr key={i} className="border-t border-gray-100 hover:bg-indigo-50/30">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{r.date}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: CHANNEL_COLORS[r.channel] || "#9CA3AF" }} />
                    {r.channel}
                  </td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={r.campaign}>{r.campaign}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={r.content}>{r.content}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={r.term}>{r.term}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(r.tier1)}</td>
                  <td className="px-3 py-2 text-right text-orange-600">{fmt(r.siryo)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{fmt(r.free)}</td>
                  {compareMode && cmp && (
                    <>
                      <DiffCell current={r.tier1} compare={cmp.tier1} />
                      <DiffCell current={r.siryo} compare={cmp.siryo} color="text-orange-400" />
                      <DiffCell current={r.free} compare={cmp.free} color="text-emerald-400" />
                    </>
                  )}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={compareMode ? 11 : 8} className="px-3 py-8 text-center text-gray-400">該当データなし</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ── Drilldown Table ── */
const DrilldownTable = ({ data, compareData, compareMode }) => {
  const [level, setLevel] = useState(0);
  const [path, setPath] = useState([]);
  const [copied, setCopied] = useState(false);
  const levelLabels = ["媒体", "キャンペーン", "コンテンツ", "ターム"];
  const levelKeys = ["channel", "campaign", "content", "term"];

  const filtered = useMemo(() => {
    let rows = data;
    for (let i = 0; i < level; i++) {
      rows = rows.filter((r) => r[levelKeys[i]] === path[i]);
    }
    return rows;
  }, [data, level, path]);

  const cFiltered = useMemo(() => {
    if (!compareMode || !compareData) return [];
    let rows = compareData;
    for (let i = 0; i < level; i++) {
      rows = rows.filter((r) => r[levelKeys[i]] === path[i]);
    }
    return rows;
  }, [compareData, compareMode, level, path]);

  const grouped = useMemo(() => {
    if (level > 3) return [];
    const key = levelKeys[Math.min(level, 3)];
    const groups = _.groupBy(filtered, key);
    const cGroups = compareMode ? _.groupBy(cFiltered, key) : {};
    return Object.entries(groups)
      .map(([name, rows]) => {
        const cRows = cGroups[name] || [];
        return {
          name,
          ...agg(rows),
          count: rows.length,
          ...(compareMode ? { c_tier1: _.sumBy(cRows, "tier1"), c_siryo: _.sumBy(cRows, "siryo"), c_free: _.sumBy(cRows, "free") } : {}),
        };
      })
      .sort((a, b) => b.tier1 - a.tier1);
  }, [filtered, cFiltered, compareMode, level]);

  const totals = useMemo(() => agg(filtered), [filtered]);

  const drillDown = (name) => {
    if (level >= 3) return;
    setPath([...path.slice(0, level), name]);
    setLevel(level + 1);
  };

  const goToLevel = (i) => { setLevel(i); setPath(path.slice(0, i)); };

  const detailRows = useMemo(() => {
    if (level !== 3) return [];
    return _.orderBy(filtered, ["date"], ["desc"]);
  }, [filtered, level]);

  const chartTitle = useMemo(() => {
    if (level === 0) return "媒体別 Tier1 CV";
    const context = path.slice(0, level).join(" › ");
    return `${context} › ${levelLabels[level]}別 Tier1 CV（上位15件）`;
  }, [level, path]);

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 text-sm flex-wrap">
        <button onClick={() => goToLevel(0)} className="text-indigo-600 hover:underline font-medium">全媒体</button>
        {path.slice(0, level).map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-gray-400">›</span>
            <button onClick={() => goToLevel(i + 1)} className="text-indigo-600 hover:underline max-w-[200px] truncate">{p}</button>
          </span>
        ))}
      </div>

      {level < 3 && <TermBarChart data={filtered} title={chartTitle} compareData={cFiltered} compareMode={compareMode} />}

      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">
          {levelLabels[Math.min(level, 3)]}別 ({level === 3 ? detailRows.length : grouped.length}件) / 合計 Tier1 CV: <span className="font-bold text-gray-800">{fmt(totals.tier1)}</span>
          {" "}資料請求: <span className="font-bold text-orange-600">{fmt(totals.siryo)}</span>
          {" "}無料AC: <span className="font-bold text-emerald-600">{fmt(totals.free)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            if (level === 3) {
              const cols = [
                { key: "date", label: "日付" }, { key: "channel", label: "媒体" },
                { key: "campaign", label: "キャンペーン" }, { key: "content", label: "コンテンツ" },
                { key: "term", label: "ターム" }, { key: "tier1", label: "Tier1 CV" },
                { key: "siryo", label: "資料請求" }, { key: "free", label: "無料AC" },
              ];
              copyTable(detailRows, cols, setCopied);
            } else {
              const cols = [
                { key: "name", label: levelLabels[level] }, { key: "tier1", label: "Tier1 CV" },
                { key: "siryo", label: "資料請求" }, { key: "free", label: "無料AC" },
              ];
              copyTable(grouped, cols, setCopied);
            }
          }} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors">
            {copied ? "✅ コピー済み" : "📋 表をコピー"}
          </button>
          <button onClick={() => {
            if (level === 3) {
              const cols = [
                { key: "date", label: "日付" }, { key: "channel", label: "媒体" },
                { key: "campaign", label: "キャンペーン" }, { key: "content", label: "コンテンツ" },
                { key: "term", label: "ターム" }, { key: "tier1", label: "Tier1 CV" },
                { key: "siryo", label: "資料請求" }, { key: "free", label: "無料AC" },
              ];
              downloadCSV(detailRows, cols, "ga4_cv_drilldown_detail.csv");
            } else {
              const cols = [
                { key: "name", label: levelLabels[level] }, { key: "tier1", label: "Tier1 CV" },
                { key: "siryo", label: "資料請求" }, { key: "free", label: "無料AC" },
              ];
              downloadCSV(grouped, cols, `ga4_cv_drilldown_${levelKeys[level]}.csv`);
            }
          }} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors">
            📥 CSVダウンロード
          </button>
        </div>
      </div>

      {level < 3 && (
        <div className="overflow-auto max-h-[420px] border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">{levelLabels[level]}</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Tier1 CV</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">資料請求</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">無料AC</th>
                {compareMode && (
                  <>
                    <th className="px-3 py-2 text-right font-semibold text-gray-400 bg-gray-100/60">比較 Tier1</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-400 bg-gray-100/60">比較 資料</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-400 bg-gray-100/60">比較 無料AC</th>
                  </>
                )}
                <th className="px-3 py-2 text-right font-semibold text-gray-600">構成比</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((r, i) => {
                const ratio = totals.tier1 > 0 ? (r.tier1 / totals.tier1) * 100 : 0;
                return (
                  <tr key={i} onClick={() => drillDown(r.name)}
                    className="border-t border-gray-100 cursor-pointer hover:bg-indigo-50/40">
                    <td className="px-3 py-2 max-w-[350px]">
                      <div className="flex items-center gap-2">
                        {level === 0 && <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CHANNEL_COLORS[r.name] || "#9CA3AF" }} />}
                        <span className="truncate" title={r.name}>{r.name}</span>
                        <span className="text-gray-300 text-xs flex-shrink-0">›</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(r.tier1)}</td>
                    <td className="px-3 py-2 text-right text-orange-600">{fmt(r.siryo)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{fmt(r.free)}</td>
                    {compareMode && (
                      <>
                        <DiffCell current={r.tier1} compare={r.c_tier1 || 0} />
                        <DiffCell current={r.siryo} compare={r.c_siryo || 0} color="text-orange-400" />
                        <DiffCell current={r.free} compare={r.c_free || 0} color="text-emerald-400" />
                      </>
                    )}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min(ratio, 100)}%` }} />
                        </div>
                        <span className="w-10 text-right">{fmtPct(ratio)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {level === 3 && (
        <div className="overflow-auto max-h-[420px] border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">日付</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">媒体</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">キャンペーン</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">コンテンツ</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">ターム</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Tier1 CV</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">資料請求</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">無料AC</th>
                {compareMode && (
                  <>
                    <th className="px-3 py-2 text-right font-semibold text-gray-400 bg-gray-100/60">比較 Tier1</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-400 bg-gray-100/60">比較 資料</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-400 bg-gray-100/60">比較 無料AC</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {detailRows.map((r, i) => {
                const cmpTerm = compareMode ? (_.groupBy(cFiltered, "term")[r.term] || []) : [];
                const cmpAgg = compareMode ? agg(cmpTerm) : null;
                return (
                  <tr key={i} className="border-t border-gray-100 hover:bg-indigo-50/30">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">{r.date}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5"
                        style={{ backgroundColor: CHANNEL_COLORS[r.channel] || "#9CA3AF" }} />
                      {r.channel}
                    </td>
                    <td className="px-3 py-2 max-w-[160px] truncate" title={r.campaign}>{r.campaign}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate" title={r.content}>{r.content}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate" title={r.term}>{r.term}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(r.tier1)}</td>
                    <td className="px-3 py-2 text-right text-orange-600">{fmt(r.siryo)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{fmt(r.free)}</td>
                    {compareMode && cmpAgg && (
                      <>
                        <DiffCell current={r.tier1} compare={cmpAgg.tier1} />
                        <DiffCell current={r.siryo} compare={cmpAgg.siryo} color="text-orange-400" />
                        <DiffCell current={r.free} compare={cmpAgg.free} color="text-emerald-400" />
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   GA4 Tab Component (embedded in dashboard)
   Props:
     - startDate: string (YYYY-MM-DD) from App's shared period
     - endDate: string (YYYY-MM-DD) from App's shared period
     - rawData: parsed GA4 rows (managed by App.jsx for persistence)
     - setRawData: setter for rawData
============================================================ */
export default function GA4Tab({ startDate, endDate, rawData, setRawData }) {
  const [viewMode, setViewMode] = useState("flat");
  /* compare mode state */
  const [compareMode, setCompareMode] = useState(false);
  const [compareFrom, setCompareFrom] = useState("");
  const [compareTo, setCompareTo] = useState("");
  const [compareCalOpen, setCompareCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [calPickFrom, setCalPickFrom] = useState("");
  const [calPickTo, setCalPickTo] = useState("");

  const handleFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      setRawData(rows);
    };
    reader.readAsText(file);
  }, [setRawData]);

  const filteredData = useMemo(() => {
    if (!rawData) return [];
    if (!startDate && !endDate) return rawData;
    return rawData.filter((r) => (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate));
  }, [rawData, startDate, endDate]);

  /* compare data filtered by compare period */
  const compareData = useMemo(() => {
    if (!compareMode || !rawData || !compareFrom) return [];
    return rawData.filter((r) => r.date >= compareFrom && (!compareTo || r.date <= compareTo));
  }, [rawData, compareMode, compareFrom, compareTo]);

  /* all dates available in rawData for calendar */
  const allDates = useMemo(() => {
    if (!rawData) return [];
    return _.uniq(rawData.map((r) => r.date)).sort();
  }, [rawData]);

  const handleCalPick = useCallback((dateStr) => {
    if (!calPickFrom || calPickTo) {
      setCalPickFrom(dateStr);
      setCalPickTo("");
    } else if (dateStr < calPickFrom) {
      setCalPickFrom(dateStr);
    } else {
      setCalPickTo(dateStr);
    }
  }, [calPickFrom, calPickTo]);

  const handleCalApply = useCallback(() => {
    setCompareFrom(calPickFrom);
    setCompareTo(calPickTo);
    setCompareCalOpen(false);
  }, [calPickFrom, calPickTo]);

  if (!rawData) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 text-3xl">📊</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">GA4 コンバージョン分析</h2>
        <p className="text-sm text-gray-500 mb-6">
          GA4の広告イベントCSVをアップロードして、<br />
          媒体別・キャンペーン別のCV獲得状況を分析します
        </p>
        <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl cursor-pointer hover:bg-indigo-700 transition-colors text-sm font-medium shadow-lg shadow-indigo-200">
          <span>📁 GA4 CSVを選択</span>
          <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Pill active={viewMode === "flat"} onClick={() => setViewMode("flat")} color="#6366F1">
              📋 フラットテーブル
            </Pill>
            <Pill active={viewMode === "drilldown"} onClick={() => setViewMode("drilldown")} color="#6366F1">
              🔍 ドリルダウン
            </Pill>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button
              onClick={() => setCompareMode((v) => !v)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${compareMode ? "bg-amber-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {compareMode ? "📊 比較 ON" : "📊 比較"}
            </button>
          </div>
          <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs cursor-pointer hover:bg-gray-200 transition-colors">
            <span>📁 CSV変更</span>
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>
        </div>

        {/* Compare period selector */}
        {compareMode && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-xs">
            <span className="font-medium text-amber-700">比較期間:</span>
            {compareFrom ? (
              <span className="text-gray-700">{compareFrom}{compareTo ? ` 〜 ${compareTo}` : ""}</span>
            ) : (
              <span className="text-gray-400">未選択</span>
            )}
            <div className="relative">
              <button
                onClick={() => { setCompareCalOpen((v) => !v); if (!compareCalOpen) { setCalPickFrom(compareFrom); setCalPickTo(compareTo); } }}
                className="px-3 py-1 bg-white border border-amber-300 rounded-md text-amber-700 hover:bg-amber-100 transition-colors"
              >
                📅 期間を選択
              </button>
              {compareCalOpen && (
                <CalendarPicker
                  calMonth={calMonth}
                  setCalMonth={setCalMonth}
                  pickFrom={calPickFrom}
                  pickTo={calPickTo}
                  onPick={handleCalPick}
                  onApply={handleCalApply}
                  onClose={() => setCompareCalOpen(false)}
                  allDates={allDates}
                />
              )}
            </div>
          </div>
        )}

        {viewMode === "flat"
          ? <FlatTable data={filteredData} compareData={compareData} compareMode={compareMode && compareFrom !== ""} />
          : <DrilldownTable data={filteredData} compareData={compareData} compareMode={compareMode && compareFrom !== ""} />
        }
      </div>
    </div>
  );
}
