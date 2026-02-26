import { useState, useCallback, useRef } from "react";
import * as Papa from "papaparse";
import _ from "lodash";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart,
} from "recharts";

// Config
import { CONFIG_ALERTS } from './config/index.js';
import {
  COL, getColor, SIRYO_KEYS, FREE_KEYS, OTHER_KEYS, TREND_COLORS,
} from './config/index.js';

// Utils
import {
  fmt, fmtPct, pctChg, safeCpa, parseRow, classifyChannel, agg, rates,
} from './utils/dataProcessing.js';

// Components
import { Card, KPI, Tbl, CVBreakdown, CalendarPicker } from './components/index.js';

// --- Trend color helper ---
const getTrendColor = (name, i, trendLevel) => {
  if (trendLevel === "channel") return getColor(name);
  return TREND_COLORS[i % TREND_COLORS.length];
};

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("summary");
  const [drillSrc, setDrillSrc] = useState(null);
  const [drillCamp, setDrillCamp] = useState(null);
  const [efficiencyMode, setEfficiencyMode] = useState("cost_cpa"); // "cost_cpa" or "cpa_only"
  const [chartMetric2, setChartMetric2] = useState("cost_cpm");
  const [cvView, setCvView] = useState("all");
  const [periodMode, setPeriodMode] = useState("thisMonth"); // "yesterday","thisMonth","lastMonth","30d","60d","all","custom"
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calPickFrom, setCalPickFrom] = useState(null); // temp pick state
  const [calPickTo, setCalPickTo] = useState(null);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [trendLevel, setTrendLevel] = useState("channel");
  const [trendChannel, setTrendChannel] = useState("__all__");
  const [trendCampaign, setTrendCampaign] = useState("__all__");
  const [trendSelected, setTrendSelected] = useState([]);
  // デイリー表タブ用
  const [tableChannel, setTableChannel] = useState("__all__");
  const [tableCampaign, setTableCampaign] = useState("__all__");
  const [tableAdgroup, setTableAdgroup] = useState("__all__");
  const [trendPickerOpen, setTrendPickerOpen] = useState(false);
  const [showMA, setShowMA] = useState(false); // 移動平均の表示ON/OFF
  const [maPeriod, setMaPeriod] = useState(7);  // 移動平均の期間（7 or 14）
  const [copied, setCopied] = useState(false);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChannel, setAiChannel] = useState(""); // AI分析対象の媒体
  const fileRef = useRef();

  const load = useCallback((raw) => {
    const rows = raw.map(parseRow).filter(r => r[COL.date]);
    rows.forEach(r => {
      r._channel = classifyChannel(r);
      // 内部標準名へのエイリアス（CSVカラム名が変わっても以下のコードが動くように）
      if (COL.date !== "paid_date") r.paid_date = r[COL.date];
      if (COL.cost !== "content_cost") r.content_cost = r[COL.cost];
      if (COL.impressions !== "content_impressions") r.content_impressions = r[COL.impressions];
      if (COL.clicks !== "content_clicks") r.content_clicks = r[COL.clicks];
    });
    setData(rows);
    setDrillSrc(null); setDrillCamp(null); setAiInsight("");
  }, []);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    Papa.parse(f, { header: true, dynamicTyping: false, skipEmptyLines: true, encoding: "UTF-8", delimitersToGuess: [",", "\t", "|", ";"], complete: (res) => load(res.data) });
  };

  const allDates = data ? _.uniq(data.map(r => r.paid_date)).sort() : [];
  const dataLastDate = allDates[allDates.length - 1] || "";
  const dates = (() => {
    if (periodMode === "custom") {
      const vf = customFrom || ""; const vt = customTo || "";
      return allDates.filter(d => (!vf || d >= vf) && (!vt || d <= vt));
    }
    if (periodMode === "yesterday") return dataLastDate ? [dataLastDate] : [];
    if (periodMode === "thisMonth" && dataLastDate) {
      const ym = dataLastDate.substring(0, 7); // "YYYY-MM"
      return allDates.filter(d => d.substring(0, 7) === ym);
    }
    if (periodMode === "lastMonth" && dataLastDate) {
      const dt = new Date(dataLastDate); dt.setMonth(dt.getMonth() - 1);
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      return allDates.filter(d => d.substring(0, 7) === ym);
    }
    if (periodMode === "all") return allDates;
    // "30d" or "60d"
    const n = periodMode === "60d" ? 60 : 30;
    return allDates.slice(-n);
  })();
  const lastDate = dates[dates.length - 1];
  const firstDate = dates[0];
  const sources = data ? _.uniq(data.filter(r => dates.includes(r.paid_date)).map(r => r._channel)).sort() : [];

  // 期間全体の集計
  const periodRows = data ? data.filter(r => dates.includes(r.paid_date)) : [];
  const periodAll = data ? rates(agg(periodRows)) : null;

  // 前同期間（同じ日数分だけ前にずらした期間）
  const prevPeriodDates = allDates.filter(d => d < firstDate).slice(-dates.length);
  const prevPeriodAll = prevPeriodDates.length > 0 ? rates(agg(data.filter(r => prevPeriodDates.includes(r.paid_date)))) : null;

  const w1d = dates.slice(-7), w2d = dates.slice(-14, -7);
  const w1 = data ? rates(agg(data.filter(r => w1d.includes(r.paid_date)))) : null;
  const w2 = data && w2d.length ? rates(agg(data.filter(r => w2d.includes(r.paid_date)))) : null;

  const bySource = sources.map(s => {
    const chRows = data.filter(r => r._channel === s && dates.includes(r.paid_date));
    const t = rates(agg(chRows));
    // 前同期間
    const prevChRows = data.filter(r => r._channel === s && prevPeriodDates.includes(r.paid_date));
    const p = prevChRows.length ? rates(agg(prevChRows)) : null;
    return { source: s, ...t, prev: p };
  });

  // === アラート検知 ===
  const alerts = data ? (() => {
    const results = [];
    const { trendWindow, trendLookback, cvDeclineRate, cpaIncreaseRate, zeroCostCheck } = CONFIG_ALERTS;

    // 媒体ごとにチェック
    sources.forEach(s => {
      const chAllRows = data.filter(r => r._channel === s);
      const chDates = _.uniq(chAllRows.map(r => r.paid_date)).sort();

      // --- 配信停止チェック ---
      if (zeroCostCheck && dataLastDate) {
        const lastDayRows = chAllRows.filter(r => r.paid_date === dataLastDate);
        const lastDayCost = _.sumBy(lastDayRows, "content_cost");
        // そのチャネルが過去にデータがあるのに最終日にコスト0
        if (chDates.length > 3 && lastDayCost === 0) {
          results.push({ type: "stop", severity: "critical", channel: s,
            message: `最終日(${dataLastDate})の配信コストが0円です` });
        }
      }

      // --- トレンド悪化チェック ---
      // 直近trendWindow日のMAと、trendLookback日前のtrendWindow日MAを比較
      if (chDates.length >= trendWindow + trendLookback) {
        const recentDates = chDates.slice(-trendWindow);
        const pastEnd = chDates.length - trendLookback;
        const pastDates = pastEnd >= trendWindow ? chDates.slice(pastEnd - trendWindow, pastEnd) : null;

        if (pastDates) {
          const recentAgg = agg(chAllRows.filter(r => recentDates.includes(r.paid_date)));
          const pastAgg = agg(chAllRows.filter(r => pastDates.includes(r.paid_date)));

          // CV減少チェック
          const recentCV = recentAgg.tier1 / trendWindow;
          const pastCV = pastAgg.tier1 / trendWindow;
          if (pastCV > 0.1) {
            const cvChange = (recentCV - pastCV) / pastCV;
            if (cvChange <= cvDeclineRate) {
              results.push({ type: "cv_decline", severity: "warning", channel: s,
                message: `CV ${maPeriod || 7}日平均が${Math.abs(cvChange * 100).toFixed(0)}%減少`,
                detail: `${pastCV.toFixed(1)}/日 → ${recentCV.toFixed(1)}/日`, change: cvChange });
            }
          }

          // CPA悪化チェック
          const recentCPA = safeCpa(recentAgg.cost, recentAgg.tier1);
          const pastCPA = safeCpa(pastAgg.cost, pastAgg.tier1);
          if (recentCPA && pastCPA) {
            const cpaChange = (recentCPA - pastCPA) / pastCPA;
            if (cpaChange >= cpaIncreaseRate) {
              results.push({ type: "cpa_increase", severity: "warning", channel: s,
                message: `CPA ${trendWindow}日平均が${(cpaChange * 100).toFixed(0)}%悪化`,
                detail: `¥${fmt(pastCPA)} → ¥${fmt(recentCPA)}`, change: cpaChange });
            }
          }
        }
      }
    });

    return results;
  })() : [];

  // === 当月着地予測（期間フィルタに影響されない、allDatesベース） ===
  const forecast = data && dataLastDate ? (() => {
    const ym = dataLastDate.substring(0, 7);
    const yr = parseInt(ym.substring(0, 4)), mo = parseInt(ym.substring(5, 7));
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const thisMonthDates = allDates.filter(d => d.substring(0, 7) === ym);
    const futureDays = [];
    for (let d = parseInt(dataLastDate.substring(8, 10)) + 1; d <= daysInMonth; d++) {
      futureDays.push({ date: `${ym}-${String(d).padStart(2, "0")}`, dow: new Date(yr, mo - 1, d).getDay() });
    }
    const last14 = allDates.slice(-14);
    const calcDowAvg = (filterFn) => {
      const byDow = {};
      for (let dow = 0; dow < 7; dow++) byDow[dow] = { cost: [], tier1: [], siryo: [], free: [] };
      last14.forEach(d => {
        const dow = new Date(d).getDay();
        const a = agg(data.filter(r => r.paid_date === d && filterFn(r)));
        byDow[dow].cost.push(a.cost); byDow[dow].tier1.push(a.tier1);
        byDow[dow].siryo.push(a.siryo); byDow[dow].free.push(a.free);
      });
      const avg = {};
      for (let dow = 0; dow < 7; dow++) {
        const c = byDow[dow];
        avg[dow] = { cost: c.cost.length ? _.mean(c.cost) : 0, tier1: c.tier1.length ? _.mean(c.tier1) : 0, siryo: c.siryo.length ? _.mean(c.siryo) : 0, free: c.free.length ? _.mean(c.free) : 0 };
      }
      return avg;
    };
    const calcFc = (filterFn, label) => {
      const dowAvg = calcDowAvg(filterFn);
      const actual = agg(data.filter(r => thisMonthDates.includes(r.paid_date) && filterFn(r)));
      let fC = 0, fT = 0, fS = 0, fF = 0;
      futureDays.forEach(({ dow }) => { fC += dowAvg[dow].cost; fT += dowAvg[dow].tier1; fS += dowAvg[dow].siryo; fF += dowAvg[dow].free; });
      const tC = actual.cost + fC, tT = actual.tier1 + fT, tS = actual.siryo + fS, tF = actual.free + fF;
      return { label, actualDays: thisMonthDates.length, remainDays: futureDays.length, totalDays: daysInMonth, cost: tC, tier1: tT, siryo: tS, free: tF, cpa: safeCpa(tC, tT), actualCost: actual.cost, actualTier1: actual.tier1 };
    };
    const all = calcFc(() => true, "全体");
    const byMedia = _.uniq(data.map(r => r._channel)).sort().map(s => calcFc(r => r._channel === s, s));

    // 先月実績を計算
    const prevMo = mo === 1 ? 12 : mo - 1;
    const prevYr = mo === 1 ? yr - 1 : yr;
    const prevYm = `${prevYr}-${String(prevMo).padStart(2, "0")}`;
    const prevMonthDates = allDates.filter(d => d.substring(0, 7) === prevYm);
    const calcPrevMonth = (filterFn) => {
      const a = agg(data.filter(r => prevMonthDates.includes(r.paid_date) && filterFn(r)));
      return { cost: a.cost, tier1: a.tier1, siryo: a.siryo, free: a.free, cpa: safeCpa(a.cost, a.tier1) };
    };
    const prevAll = prevMonthDates.length ? calcPrevMonth(() => true) : null;
    const prevByMedia = prevMonthDates.length
      ? Object.fromEntries(_.uniq(data.map(r => r._channel)).sort().map(s => [s, calcPrevMonth(r => r._channel === s)]))
      : {};

    // forecastの各行にprevMonthを付与
    all.prevMonth = prevAll;
    byMedia.forEach(m => { m.prevMonth = prevByMedia[m.label] || null; });

    return { month: `${yr}年${mo}月`, all, byMedia, progress: thisMonthDates.length / daysInMonth * 100 };
  })() : null;

  const [trendTopN, setTrendTopN] = useState(7);
  const [trendGranularity, setTrendGranularity] = useState("daily"); // "daily","weekly","monthly"

  const campaigns = data ? _.uniq(data.filter(r => trendChannel === "__all__" || r._channel === trendChannel).map(r => r.campaign_name)).filter(Boolean).sort() : [];
  const adgroups = data ? _.uniq(data.filter(r => (trendChannel === "__all__" || r._channel === trendChannel) && (trendCampaign === "__all__" || r.campaign_name === trendCampaign)).map(r => r.adgroup_name)).filter(Boolean).sort() : [];

  const trendFilterRows = (rows) => {
    let f = rows;
    if (trendChannel !== "__all__") f = f.filter(r => r._channel === trendChannel);
    if (trendCampaign !== "__all__") f = f.filter(r => r.campaign_name === trendCampaign);
    if (trendSelected.length > 0) {
      f = f.filter(r => trendSelected.includes(r[trendGroupKey] || "(未設定)"));
    }
    return f;
  };

  const trendGroupKey = trendLevel === "channel" ? "_channel" : trendLevel === "campaign" ? "campaign_name" : "adgroup_name";

  const allTrendGroups = data ? (() => {
    const filtered = trendFilterRows(data);
    const grouped = _.groupBy(filtered, r => r[trendGroupKey] || "(未設定)");
    return Object.entries(grouped).map(([name, rows]) => ({ name, cost: _.sumBy(rows, "content_cost"), tier1: _.sumBy(rows, "total_tier1cv_cnt") })).sort((a, b) => b.cost - a.cost);
  })() : [];

  const trendGroups = (() => {
    if (trendSelected.length > 0) return trendSelected;
    if (trendLevel === "channel") return allTrendGroups.map(g => g.name);
    return allTrendGroups.slice(0, trendTopN).map(g => g.name);
  })();

  const TREND_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316","#06B6D4","#84CC16","#A855F7","#FB923C"];
  // getTrendColor is imported from top level

  const toggleTrendItem = (name) => {
    setTrendSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const isSingleFilter = trendChannel !== "__all__" && trendLevel === "channel" && trendSelected.length === 0;
  const isSingleSelected = trendLevel === "channel" && trendSelected.length === 1;
  const hideGroupLines = isSingleFilter || isSingleSelected;

  // CPA key based on cvView selection
  const cvMetricKey = cvView === "siryo" ? "siryo" : cvView === "free" ? "free" : "tier1";
  const cvMetricLabel = cvView === "siryo" ? "資料請求" : cvView === "free" ? "無料アカウント" : "Tier1 CV";
  const cvCpaKey = cvView === "siryo" ? "cpa_siryo" : cvView === "free" ? "cpa_free" : "cpa";
  const cvCpaLabel = cvView === "siryo" ? "資料CPA" : cvView === "free" ? "無料AC CPA" : "Tier1 CPA";

  const dailyTrend = dates.map(d => {
    const dr = trendFilterRows(data.filter(r => r.paid_date === d));
    const a = rates(agg(dr));
    const row = {
      date: d.replace(/^\d{4}-/, ""), fullDate: d, ...a,
      cpa_siryo: safeCpa(a.cost, a.siryo), cpa_free: safeCpa(a.cost, a.free),
      siryo_ratio: a.tier1 > 0 ? (a.siryo / a.tier1 * 100) : 0,
      free_ratio: a.tier1 > 0 ? (a.free / a.tier1 * 100) : 0,
    };
    trendGroups.forEach(g => {
      const ga = agg(dr.filter(r => (r[trendGroupKey] || "(未設定)") === g));
      const ra = rates(ga);
      const k = g.substring(0, 20);
      row[`${k}_cost`] = ga.cost; row[`${k}_tier1`] = ga.tier1; row[`${k}_siryo`] = ga.siryo; row[`${k}_free`] = ga.free;
      row[`${k}_cpa`] = safeCpa(ga.cost, ga.tier1);
      row[`${k}_cpa_siryo`] = safeCpa(ga.cost, ga.siryo);
      row[`${k}_cpa_free`] = safeCpa(ga.cost, ga.free);
      row[`${k}_imp`] = ga.imp; row[`${k}_clicks`] = ga.clicks;
      row[`${k}_cpm`] = ra.cpm; row[`${k}_cpc`] = ra.cpc; row[`${k}_ctr`] = ra.ctr; row[`${k}_cvr`] = ra.cvr;
    });
    return row;
  });

  // 粒度に応じてdailyTrendを集約
  const trendData = (() => {
    if (trendGranularity === "daily") return dailyTrend;
    // 週別/月別のグルーピングキーを生成
    const getGroupKey = (fullDate) => {
      if (trendGranularity === "monthly") return fullDate.substring(0, 7); // "YYYY-MM"
      // weekly: ISO週の月曜始まり
      const d = new Date(fullDate);
      const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diff));
      return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
    };
    const getLabel = (key) => {
      if (trendGranularity === "monthly") { const [y,m] = key.split("-"); return `${y}/${m}`; }
      return key.replace(/^\d{4}-/, ""); // weekly: "MM-DD"
    };
    const grouped = _.groupBy(dailyTrend, r => getGroupKey(r.fullDate));
    return Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([key, rows]) => {
      // 数値カラムをすべて合算（rateは再計算）
      const base = {};
      const numKeys = Object.keys(rows[0]).filter(k => typeof rows[0][k] === "number");
      numKeys.forEach(k => {
        // CPA/CPM/CPC/CTR/CVR/ratioは合算ではなく再計算が必要
        if (k.includes("cpa") || k.includes("cpm") || k.includes("cpc") || k.includes("ctr") || k.includes("cvr") || k.includes("ratio")) {
          base[k] = null; // placeholder
        } else {
          base[k] = _.sumBy(rows, k);
        }
      });
      // 全体のrate再計算
      base.cpa = safeCpa(base.cost, base.tier1);
      base.cpa_siryo = safeCpa(base.cost, base.siryo);
      base.cpa_free = safeCpa(base.cost, base.free);
      base.ctr = base.imp ? (base.clicks / base.imp * 100) : 0;
      base.cvr = base.clicks ? (base.tier1 / base.clicks * 100) : 0;
      base.cpm = base.imp ? Math.round(base.cost / base.imp * 1000) : 0;
      base.cpc = base.clicks ? Math.round(base.cost / base.clicks) : 0;
      base.siryo_ratio = base.tier1 > 0 ? (base.siryo / base.tier1 * 100) : 0;
      base.free_ratio = base.tier1 > 0 ? (base.free / base.tier1 * 100) : 0;
      // グループ別のrate再計算
      trendGroups.forEach(g => {
        const k = g.substring(0, 20);
        const gCost = base[`${k}_cost`] || 0, gTier1 = base[`${k}_tier1`] || 0;
        const gSiryo = base[`${k}_siryo`] || 0, gFree = base[`${k}_free`] || 0;
        const gImp = base[`${k}_imp`] || 0, gClicks = base[`${k}_clicks`] || 0;
        base[`${k}_cpa`] = safeCpa(gCost, gTier1);
        base[`${k}_cpa_siryo`] = safeCpa(gCost, gSiryo);
        base[`${k}_cpa_free`] = safeCpa(gCost, gFree);
        base[`${k}_cpm`] = gImp ? Math.round(gCost / gImp * 1000) : 0;
        base[`${k}_cpc`] = gClicks ? Math.round(gCost / gClicks) : 0;
        base[`${k}_ctr`] = gImp ? (gClicks / gImp * 100) : 0;
        base[`${k}_cvr`] = gClicks ? (gTier1 / gClicks * 100) : 0;
      });
      base.date = getLabel(key);
      base.fullDate = key;
      return base;
    });
  })();

  // --- 移動平均の計算（日別のときのみ使用） ---
  // CPA移動平均は加重平均（期間内の合計費用÷合計CV）で算出。
  // 単純平均だとCV=0の日にCPA=nullになりスパイクを除外できないため。
  const trendDataWithMA = (() => {
    if (trendGranularity !== "daily" || !showMA) return trendData;
    const n = maPeriod;
    return trendData.map((row, i) => {
      const enhanced = { ...row };
      if (i < n - 1) {
        // 移動平均の算出に必要なデータが足りない期間はnull
        enhanced._ma_cpa = null;
        enhanced._ma_cpa_siryo = null;
        enhanced._ma_cpa_free = null;
        enhanced._ma_tier1 = null;
        enhanced._ma_siryo = null;
        enhanced._ma_free = null;
      } else {
        const window = trendData.slice(i - n + 1, i + 1);
        const sumCost = _.sumBy(window, "cost");
        const sumTier1 = _.sumBy(window, "tier1");
        const sumSiryo = _.sumBy(window, "siryo");
        const sumFree = _.sumBy(window, "free");
        // CPA移動平均（加重平均: 期間合計費用÷期間合計CV）
        enhanced._ma_cpa = safeCpa(sumCost, sumTier1);
        enhanced._ma_cpa_siryo = safeCpa(sumCost, sumSiryo);
        enhanced._ma_cpa_free = safeCpa(sumCost, sumFree);
        // CV件数移動平均（単純平均）
        enhanced._ma_tier1 = sumTier1 / n;
        enhanced._ma_siryo = sumSiryo / n;
        enhanced._ma_free = sumFree / n;
      }
      return enhanced;
    });
  })();

  // グラフに渡すデータ（MAが有効なら拡張版を使用）
  const chartData = (trendGranularity === "daily" && showMA) ? trendDataWithMA : trendData;

  const drillCampaigns = drillSrc ? (() => {
    const rows = data.filter(r => dates.includes(r.paid_date) && r._channel === drillSrc);
    const prevRows = data.filter(r => prevPeriodDates.includes(r.paid_date) && r._channel === drillSrc);
    return Object.entries(_.groupBy(rows, r => `${r.campaign_id}|||${r.campaign_name}`)).map(([k, v]) => {
      const [cid, cn] = k.split("|||");
      const a = rates(agg(v));
      const pr = prevRows.filter(r => String(r.campaign_id) === String(cid));
      return { campaign_id: cid, campaign_name: cn, ...a, prev: pr.length ? rates(agg(pr)) : null };
    }).sort((a, b) => b.cost - a.cost);
  })() : [];

  const drillAdgroups = drillCamp ? (() => {
    const rows = data.filter(r => dates.includes(r.paid_date) && r._channel === drillSrc && String(r.campaign_id) === String(drillCamp.campaign_id));
    return Object.entries(_.groupBy(rows, r => `${r.adgroup_id}|||${r.adgroup_name}`)).map(([k, v]) => {
      const [aid, an] = k.split("|||");
      return { adgroup_id: aid, adgroup_name: an, ...rates(agg(v)) };
    }).sort((a, b) => b.cost - a.cost);
  })() : [];

  const mediaCols = [
    { label: "媒体", render: r => <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: getColor(r.source) }}></span>{r.source}</span> },
    { label: "IMP", a: "right", render: r => fmt(r.imp) },
    { label: "Click", a: "right", render: r => fmt(r.clicks) },
    { label: "CTR", a: "right", render: r => `${r.ctr.toFixed(2)}%` },
    { label: "CPC", a: "right", render: r => `¥${fmt(r.cpc)}` },
    { label: "費用", a: "right", render: r => `¥${fmt(r.cost)}` },
    { label: "Tier1 CV", a: "right", b: true, render: r => fmt(r.tier1, 1) },
    { label: "┗ 資料", a: "right", render: r => <span className="text-amber-600">{fmt(r.siryo, 1)}</span> },
    { label: "┗ 無料AC", a: "right", render: r => <span className="text-emerald-600">{fmt(r.free, 1)}</span> },
    { label: "CVR", a: "right", render: r => r.clicks ? `${r.cvr.toFixed(2)}%` : "-" },
    { label: "Tier1 CPA", a: "right", b: true, render: r => r.cpa != null ? `¥${fmt(r.cpa)}` : "-" },
  ];

  const campCols = [
    { label: "キャンペーン", render: r => <span className="max-w-xs truncate block text-xs">{r.campaign_name || r.campaign_id}</span> },
    { label: "IMP", a: "right", render: r => fmt(r.imp) },
    { label: "Click", a: "right", render: r => fmt(r.clicks) },
    { label: "CTR", a: "right", render: r => `${r.ctr.toFixed(2)}%` },
    { label: "CPC", a: "right", render: r => `¥${fmt(r.cpc)}` },
    { label: "費用", a: "right", render: r => `¥${fmt(r.cost)}` },
    { label: "Tier1 CV", a: "right", b: true, render: r => fmt(r.tier1, 1) },
    { label: "┗ 資料", a: "right", render: r => <span className="text-amber-600 text-xs">{fmt(r.siryo, 1)}</span> },
    { label: "┗ 無料AC", a: "right", render: r => <span className="text-emerald-600 text-xs">{fmt(r.free, 1)}</span> },
    { label: "CVR", a: "right", render: r => r.clicks ? `${r.cvr.toFixed(2)}%` : "-" },
    { label: "Tier1 CPA", a: "right", b: true, render: r => r.cpa != null ? `¥${fmt(r.cpa)}` : "-" },
  ];

  const adgCols = [
    { label: "広告グループ", render: r => <span className="max-w-xs truncate block text-xs">{r.adgroup_name || r.adgroup_id}</span> },
    { label: "IMP", a: "right", render: r => fmt(r.imp) },
    { label: "Click", a: "right", render: r => fmt(r.clicks) },
    { label: "CTR", a: "right", render: r => `${r.ctr.toFixed(2)}%` },
    { label: "CPC", a: "right", render: r => `¥${fmt(r.cpc)}` },
    { label: "費用", a: "right", render: r => `¥${fmt(r.cost)}` },
    { label: "Tier1 CV", a: "right", b: true, render: r => fmt(r.tier1, 1) },
    { label: "┗ 資料", a: "right", render: r => <span className="text-amber-600 text-xs">{fmt(r.siryo, 1)}</span> },
    { label: "┗ 無料AC", a: "right", render: r => <span className="text-emerald-600 text-xs">{fmt(r.free, 1)}</span> },
    { label: "CVR", a: "right", render: r => r.clicks ? `${r.cvr.toFixed(2)}%` : "-" },
    { label: "Tier1 CPA", a: "right", b: true, render: r => r.cpa != null ? `¥${fmt(r.cpa)}` : "-" },
  ];

  // Tbl is imported from components

  const CVToggle = () => (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
      {[["all", "Tier1合計"], ["siryo", "資料請求"], ["free", "無料AC"]].map(([k, l]) => (
        <button key={k} onClick={() => setCvView(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition ${cvView === k ? "bg-white shadow text-gray-800" : "text-gray-500"}`}>{l}</button>
      ))}
    </div>
  );

  const MAToggle = () => trendGranularity === "daily" ? (
    <div className="flex items-center gap-2">
      <button onClick={() => setShowMA(!showMA)}
        className={`px-3 py-1 rounded-md text-xs font-medium transition border ${showMA ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
        {showMA ? "📈 MA ON" : "📈 MA"}
      </button>
      {showMA && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {[7, 14].map(n => (
            <button key={n} onClick={() => setMaPeriod(n)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition ${maPeriod === n ? "bg-white shadow text-gray-800" : "text-gray-500"}`}>
              {n}日
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null;

  // Helper: get the CPA suffix key name based on cvView
  const getCpaSuffix = () => cvView === "siryo" ? "_cpa_siryo" : cvView === "free" ? "_cpa_free" : "_cpa";

  const generateAI = async () => {
    if (!data || !aiChannel) return;
    setAiLoading(true); setAiInsight("");

    // --- 選択媒体のデータを構築 ---
    const chRows = data.filter(r => r._channel === aiChannel && dates.includes(r.paid_date));
    const chAll = rates(agg(chRows));

    // 前同期間
    const chPrevRows = data.filter(r => r._channel === aiChannel && prevPeriodDates.includes(r.paid_date));
    const chPrev = chPrevRows.length ? rates(agg(chPrevRows)) : null;

    // 直近7日 vs その前7日
    const ch7d = rates(agg(data.filter(r => r._channel === aiChannel && w1d.includes(r.paid_date))));
    const ch7dPrev = w2d.length ? rates(agg(data.filter(r => r._channel === aiChannel && w2d.includes(r.paid_date)))) : null;

    // キャンペーン別（全件）
    const campRows = data.filter(r => r._channel === aiChannel && dates.includes(r.paid_date));
    const campPrevRows = data.filter(r => r._channel === aiChannel && prevPeriodDates.includes(r.paid_date));
    const campaigns = Object.entries(_.groupBy(campRows, "campaign_name")).map(([name, rows]) => {
      const a = rates(agg(rows));
      const pr = campPrevRows.filter(r => r.campaign_name === name);
      const p = pr.length ? rates(agg(pr)) : null;
      return { name: name || "(未設定)", ...a, prev: p };
    }).sort((a, b) => b.cost - a.cost);

    // 日別推移（直近14日）
    const chDailyTrend = dates.slice(-14).map(d => {
      const dr = data.filter(r => r._channel === aiChannel && r.paid_date === d);
      const a = rates(agg(dr));
      return { date: d, ...a };
    });

    // アラート情報（この媒体に関するもの）
    const chAlerts = alerts.filter(a => a.channel === aiChannel);

    const prompt = `あなたは運用型広告のシニアコンサルタントです。以下の【${aiChannel}】のデータを診断し、日本語で報告してください。

## 対象サービス: IVRy（電話自動応答SaaS）
## KPI構造: Tier1 CV = 資料請求 + 無料アカウント
## 分析期間: ${firstDate} 〜 ${lastDate}（${dates.length}日間）

## 【${aiChannel}】 期間実績
費用:¥${fmt(chAll.cost)} / IMP:${fmt(chAll.imp)} / Click:${fmt(chAll.clicks)} / CTR:${chAll.ctr.toFixed(2)}% / CPC:¥${fmt(chAll.cpc)}
Tier1CV:${fmt(chAll.tier1,1)}（資料:${fmt(chAll.siryo,1)} / 無料AC:${fmt(chAll.free,1)}）
CVR:${chAll.cvr.toFixed(2)}% / CPA:${chAll.cpa!=null?"¥"+fmt(chAll.cpa):"N/A"} / 資料CPA:${chAll.cpa_siryo!=null?"¥"+fmt(chAll.cpa_siryo):"N/A"} / 無料AC CPA:${chAll.cpa_free!=null?"¥"+fmt(chAll.cpa_free):"N/A"}
${chPrev?`前期間比: 費用${fmtPct(pctChg(chAll.cost,chPrev.cost))} / Click${fmtPct(pctChg(chAll.clicks,chPrev.clicks))} / CTR${fmtPct(pctChg(chAll.ctr,chPrev.ctr))} / CVR${fmtPct(pctChg(chAll.cvr,chPrev.cvr))} / Tier1CV${fmtPct(pctChg(chAll.tier1,chPrev.tier1))} / CPA${chPrev.cpa?fmtPct(pctChg(chAll.cpa,chPrev.cpa)):"N/A"}`:""}

## 直近7日 vs 前7日
直近7日: 費用¥${fmt(ch7d.cost)} / Click${fmt(ch7d.clicks)} / CTR${ch7d.ctr.toFixed(2)}% / CPC¥${fmt(ch7d.cpc)} / CVR${ch7d.cvr.toFixed(2)}% / Tier1CV${fmt(ch7d.tier1,1)} / CPA${ch7d.cpa!=null?"¥"+fmt(ch7d.cpa):"N/A"}
${ch7dPrev?`前7日: 費用¥${fmt(ch7dPrev.cost)} / Click${fmt(ch7dPrev.clicks)} / CTR${ch7dPrev.ctr.toFixed(2)}% / CPC¥${fmt(ch7dPrev.cpc)} / CVR${ch7dPrev.cvr.toFixed(2)}% / Tier1CV${fmt(ch7dPrev.tier1,1)} / CPA${ch7dPrev.cpa!=null?"¥"+fmt(ch7dPrev.cpa):"N/A"}`:"データなし"}

## キャンペーン別（全${campaigns.length}件）
${campaigns.map(c=>`${c.name}: 費用¥${fmt(c.cost)} / IMP${fmt(c.imp)} / Click${fmt(c.clicks)} / CTR${c.ctr.toFixed(2)}% / CPC¥${fmt(c.cpc)} / CVR${c.cvr.toFixed(2)}% / Tier1CV${fmt(c.tier1,1)}(資料${fmt(c.siryo,1)}+無料AC${fmt(c.free,1)}) / CPA${c.cpa!=null?"¥"+fmt(c.cpa):"N/A"}${c.prev?` [前期間比: Click${fmtPct(pctChg(c.clicks,c.prev.clicks))} / CVR${fmtPct(pctChg(c.cvr,c.prev.cvr))} / CV${fmtPct(pctChg(c.tier1,c.prev.tier1))} / CPA${c.prev.cpa?fmtPct(pctChg(c.cpa,c.prev.cpa)):"N/A"}]`:""}`).join("\n")}

## 日別推移（直近14日）
${chDailyTrend.map(d=>`${d.date}: 費用¥${fmt(d.cost)} / Click${fmt(d.clicks)} / CTR${d.ctr.toFixed(2)}% / CVR${d.cvr.toFixed(2)}% / Tier1CV${fmt(d.tier1,1)} / CPA${d.cpa!=null?"¥"+fmt(d.cpa):"N/A"}`).join("\n")}

${chAlerts.length>0?`## ⚠ 検知されたアラート\n${chAlerts.map(a=>`- ${a.type==="stop"?"配信停止":a.type==="cpa_increase"?"CPA悪化":"CV減少"}: ${a.message} (${a.detail||""})`).join("\n")}`:""}

以下の3ステップ構成で厳密に出力してください。各ステップ内では箇条書きで簡潔に。

### Step1: 状態判定
この媒体の現在の状態を「好調」「横ばい」「不調」で判定し、1-2文で根拠を示してください。CV・CPA・コストの3軸で評価すること。

### Step2: 原因分解
現在の状態の原因をファネル（IMP→Click→CV）のどこに要因があるかを分解してください。
- CPCの変化（入札競合・品質スコア要因）
- CTRの変化（広告文・ターゲティング要因）
- CVRの変化（LP・ユーザー質要因）
の観点で2-4点に絞って指摘すること。

### Step3: キャンペーン特定
上記の要因を引き起こしている具体的なキャンペーンを名指しで特定してください。
各キャンペーンについて「何が起きているか」「推奨アクション」を1文ずつで簡潔に。`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
      });
      const json = await res.json();
      setAiInsight(json.content?.map(b => b.text || "").join("") || "取得できませんでした。");
    } catch (err) { setAiInsight("APIエラー: " + err.message); }
    setAiLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">AD</div>
            <h1 className="text-lg font-bold text-gray-900">広告レポート分析</h1>
            {lastDate && <span className="text-xs text-gray-400 ml-2">{firstDate === lastDate ? lastDate : `${firstDate} 〜 ${lastDate}`}（{dates.length}日間）</span>}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  {[["yesterday","前日"],["thisMonth","当月"],["lastMonth","先月"],["30d","30日"],["60d","60日"],["all","全期間"]].map(([k,l])=>(
                    <button key={k} onClick={()=>{setPeriodMode(k);setCustomFrom("");setCustomTo("");setCalendarOpen(false);}} className={`px-2 py-1 rounded-md text-xs font-medium transition ${periodMode===k?"bg-white shadow text-gray-800":"text-gray-500 hover:text-gray-700"}`}>{l}</button>
                  ))}
                </div>
                <div className="relative">
                  <button onClick={()=>{setCalendarOpen(!calendarOpen);if(!calendarOpen){setCalPickFrom(customFrom||null);setCalPickTo(customTo||null);if(dataLastDate){const d=new Date(dataLastDate);setCalMonth({y:d.getFullYear(),m:d.getMonth()});}}}} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${periodMode==="custom"?"bg-indigo-50 border-indigo-300 text-indigo-700":"bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    📅 {periodMode==="custom"&&customFrom?`${customFrom}〜${customTo||""}` :"期間指定"}
                  </button>
                  {calendarOpen && <CalendarPicker
                    calMonth={calMonth} setCalMonth={setCalMonth}
                    pickFrom={calPickFrom} pickTo={calPickTo}
                    onPick={(d)=>{
                      if(!calPickFrom||calPickTo||(d<calPickFrom)){setCalPickFrom(d);setCalPickTo(null);}
                      else{setCalPickTo(d);}
                    }}
                    onApply={()=>{setCustomFrom(calPickFrom||"");setCustomTo(calPickTo||calPickFrom||"");setPeriodMode("custom");setCalendarOpen(false);}}
                    onClose={()=>setCalendarOpen(false)}
                    allDates={allDates}
                  />}
                </div>
              </>
            )}
            <button onClick={() => fileRef.current?.click()} className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition">CSV</button>
            {data && <button onClick={() => setTab("debug")} className={`w-7 h-7 flex items-center justify-center rounded-lg transition text-sm ${tab === "debug" ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`} title="デバッグ">⚙</button>}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.tsv" onChange={handleFile} className="hidden" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {!data ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 text-3xl">📊</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">SQLの実行結果CSVをアップロード</h2>
            <p className="text-gray-500 text-sm mb-6">Databricksからエクスポートしたファイルに対応</p>
            <button onClick={() => fileRef.current?.click()} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition shadow-lg shadow-indigo-200">CSVを選択</button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 mb-5 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
              {[["summary", "サマリー"], ["trend", "トレンド"], ["table", "📋 デイリー表"], ["drill", "ドリルダウン"], ["ai", "🤖 AI診断"]].map(([k, l]) => (
                <button key={k} onClick={() => { setTab(k); if (k !== "drill") { setDrillSrc(null); setDrillCamp(null); } }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === k ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}>{l}</button>
              ))}
            </div>

            {tab === "summary" && periodAll && (
              <div className="space-y-5">
                <Card>
                  <h3 className="font-bold text-gray-800 mb-4">📊 期間実績 ({firstDate} 〜 {lastDate})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    <KPI label="費用" value={fmt(periodAll.cost)} unit="¥" change={prevPeriodAll ? pctChg(periodAll.cost, prevPeriodAll.cost) : null} />
                    <KPI label="Click" value={fmt(periodAll.clicks)} change={prevPeriodAll ? pctChg(periodAll.clicks, prevPeriodAll.clicks) : null} />
                    <KPI label="Tier1 CV" value={fmt(periodAll.tier1, 1)} change={prevPeriodAll ? pctChg(periodAll.tier1, prevPeriodAll.tier1) : null} sub={`資料${fmt(periodAll.siryo,1)} + AC${fmt(periodAll.free,1)}`} />
                    <KPI label="CPA(Tier1)" value={periodAll.cpa != null ? fmt(periodAll.cpa) : "-"} unit="¥" change={prevPeriodAll?.cpa ? pctChg(periodAll.cpa, prevPeriodAll.cpa) : null} up={false} />
                    <KPI label="資料請求" value={fmt(periodAll.siryo, 1)} change={prevPeriodAll ? pctChg(periodAll.siryo, prevPeriodAll.siryo) : null} />
                    <KPI label="資料CPA" value={periodAll.cpa_siryo != null ? fmt(periodAll.cpa_siryo) : "-"} unit="¥" change={prevPeriodAll?.cpa_siryo ? pctChg(periodAll.cpa_siryo, prevPeriodAll.cpa_siryo) : null} up={false} />
                    <KPI label="無料AC" value={fmt(periodAll.free, 1)} change={prevPeriodAll ? pctChg(periodAll.free, prevPeriodAll.free) : null} />
                    <KPI label="無料AC CPA" value={periodAll.cpa_free != null ? fmt(periodAll.cpa_free) : "-"} unit="¥" change={prevPeriodAll?.cpa_free ? pctChg(periodAll.cpa_free, prevPeriodAll.cpa_free) : null} up={false} />
                  </div>
                </Card>
                {w1 && w2 && (
                  <Card>
                    <h3 className="font-bold text-gray-800 mb-3">📈 週次比較</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                      {[["費用","cost","¥",true],["Tier1 CV","tier1","",true],["CPA","cpa","¥",false],["資料請求","siryo","",true],["無料AC","free","",true],["資料CPA","cpa_siryo","¥",false]].map(([l,k,u,up])=>(
                        <div key={k}>
                          <div className="text-xs text-gray-500 mb-1">{l}</div>
                          <div className="text-xs">今週 <span className="font-bold">{u}{fmt(w1[k],k==="tier1"||k==="siryo"||k==="free"?1:0)}</span></div>
                          <div className="text-xs text-gray-400">前週 {u}{fmt(w2[k],k==="tier1"||k==="siryo"||k==="free"?1:0)}</div>
                          {w2[k]!=null&&<div className={`text-xs mt-0.5 font-medium ${(up?pctChg(w1[k],w2[k])>=0:pctChg(w1[k],w2[k])<=0)?"text-emerald-600":"text-red-500"}`}>{fmtPct(pctChg(w1[k],w2[k]))}</div>}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {/* === アラートバナー === */}
                {alerts.length > 0 && (
                  <Card c="border-amber-200 bg-amber-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">⚠️</span>
                      <h3 className="font-bold text-gray-800 text-sm">注意が必要な媒体（{alerts.length}件）</h3>
                    </div>
                    <div className="space-y-1.5">
                      {alerts.map((a, i) => (
                        <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${a.severity === "critical" ? "bg-red-50 border border-red-200" : "bg-white border border-amber-100"}`}>
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: getColor(a.channel)}}></span>
                          <span className="font-medium text-gray-800 min-w-0">{a.channel}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${a.severity === "critical" ? "bg-red-100 text-red-700" : a.type === "cpa_increase" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                            {a.type === "stop" ? "配信停止" : a.type === "cpa_increase" ? "CPA悪化" : "CV減少"}
                          </span>
                          <span className="text-gray-600 text-xs">{a.message}</span>
                          {a.detail && <span className="text-gray-400 text-xs ml-auto flex-shrink-0">{a.detail}</span>}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                <Card>
                  <h3 className="font-bold text-gray-800 mb-3">🏢 媒体別</h3>
                  <Tbl columns={mediaCols} data={bySource} onRowClick={r => { setTab("drill"); setDrillSrc(r.source); setDrillCamp(null); }} />
                </Card>
                {forecast && (
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800">🔮 当月着地予測（{forecast.month}）</h3>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500">確定 {forecast.all.actualDays}日 / 残 {forecast.all.remainDays}日</div>
                        <div className="w-24 h-2 bg-gray-100 rounded-full"><div className="h-2 bg-indigo-500 rounded-full" style={{width:`${forecast.progress}%`}}></div></div>
                        <span className="text-xs font-medium text-indigo-600">{forecast.progress.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mb-3">過去14日の曜日別平均から残日数を推計</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">区分</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">費用</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs font-bold">Tier1 CV</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">┗ 資料</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">┗ 無料AC</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs font-bold">CPA</th>
                        </tr></thead>
                        <tbody>
                          {[forecast.all, ...forecast.byMedia].map((r, i) => {
                            const pm = r.prevMonth;
                            const diffColor = (v, inv) => !v ? "" : (inv ? v <= 0 : v >= 0) ? "text-emerald-600" : "text-red-500";
                            const diffFmt = (cur, prev, prefix="") => {
                              if (!pm || prev == null || prev === 0) return null;
                              const d = cur - prev;
                              return <span className={`text-xs ml-1 ${diffColor(d, prefix==="¥" && false)}`}>({d >= 0 ? "+" : ""}{prefix}{fmt(Math.round(d))})</span>;
                            };
                            const diffFmtUp = (cur, prev, prefix="") => {
                              if (!pm || prev == null || prev === 0) return null;
                              const d = cur - prev;
                              return <span className={`text-xs ml-1 ${d >= 0 ? "text-emerald-600" : "text-red-500"}`}>({d >= 0 ? "+" : ""}{prefix}{fmt(Math.round(d))})</span>;
                            };
                            const diffFmtDown = (cur, prev, prefix="") => {
                              if (!pm || prev == null || prev === 0) return null;
                              const d = cur - prev;
                              return <span className={`text-xs ml-1 ${d <= 0 ? "text-emerald-600" : "text-red-500"}`}>({d >= 0 ? "+" : ""}{prefix}{fmt(Math.round(d))})</span>;
                            };
                            return (
                              <tr key={r.label} className={`border-b border-gray-50 ${i === 0 ? "bg-indigo-50 font-bold" : "hover:bg-blue-50"}`}>
                                <td className="py-2 px-2 text-xs flex items-center gap-1.5">
                                  {i > 0 && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{background: getColor(r.label)}}></span>}
                                  {i === 0 ? "📊 全体" : r.label}
                                </td>
                                <td className="text-right py-2 px-2">¥{fmt(r.cost)}{diffFmt(r.cost, pm?.cost, "¥")}</td>
                                <td className="text-right py-2 px-2 font-bold">{fmt(r.tier1, 1)}{diffFmtUp(r.tier1, pm?.tier1)}</td>
                                <td className="text-right py-2 px-2 text-amber-600">{fmt(r.siryo, 1)}{diffFmtUp(r.siryo, pm?.siryo)}</td>
                                <td className="text-right py-2 px-2 text-emerald-600">{fmt(r.free, 1)}{diffFmtUp(r.free, pm?.free)}</td>
                                <td className="text-right py-2 px-2 font-bold">{r.cpa != null ? `¥${fmt(r.cpa)}` : "-"}{r.cpa != null ? diffFmtDown(r.cpa, pm?.cpa, "¥") : ""}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ===== TREND TAB ===== */}
            {tab === "trend" && (
              <div className="space-y-5">
                {/* Filters Card */}
                <Card>
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">粒度</label>
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                        {[["daily","日別"],["weekly","週別"],["monthly","月別"]].map(([k,l])=>(
                          <button key={k} onClick={()=>setTrendGranularity(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition ${trendGranularity===k?"bg-white shadow text-gray-800":"text-gray-500"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">分析軸</label>
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                        {[["channel","媒体別"],["campaign","キャンペーン別"],["adgroup","広告グループ別"]].map(([k,l])=>(
                          <button key={k} onClick={()=>{setTrendLevel(k);setTrendCampaign("__all__");setTrendSelected([]);}} className={`px-3 py-1 rounded-md text-xs font-medium transition ${trendLevel===k?"bg-white shadow text-gray-800":"text-gray-500"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">媒体フィルタ</label>
                      <select value={trendChannel} onChange={e=>{setTrendChannel(e.target.value);setTrendCampaign("__all__");setTrendSelected([]);}} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                        <option value="__all__">全媒体</option>
                        {sources.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {(trendLevel === "adgroup") && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">キャンペーン</label>
                        <select value={trendCampaign} onChange={e=>{setTrendCampaign(e.target.value);setTrendSelected([]);}} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-xs">
                          <option value="__all__">全キャンペーン</option>
                          {campaigns.map(c=><option key={c} value={c}>{c.substring(0,40)}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="relative">
                      <label className="text-xs text-gray-500 block mb-1">表示対象 ({trendSelected.length > 0 ? `${trendSelected.length}件選択中` : trendLevel === "channel" ? `全${allTrendGroups.length}件` : `上位${Math.min(trendTopN, allTrendGroups.length)}/${allTrendGroups.length}件`})</label>
                      <button onClick={()=>setTrendPickerOpen(!trendPickerOpen)} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition flex items-center gap-1">
                        {trendSelected.length > 0 ? trendSelected.map(s=>s.substring(0,10)).join(", ").substring(0,30) : "選択して絞り込み"}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                      {trendPickerOpen && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 w-80 max-h-72 overflow-y-auto">
                          <div className="sticky top-0 bg-white border-b border-gray-100 p-2 flex gap-2">
                            <button onClick={()=>setTrendSelected(allTrendGroups.map(g=>g.name))} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100">全選択</button>
                            <button onClick={()=>setTrendSelected([])} className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100">クリア</button>
                            <button onClick={()=>setTrendSelected(allTrendGroups.slice(0,5).map(g=>g.name))} className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100">Top5</button>
                            <button onClick={()=>setTrendSelected(allTrendGroups.slice(0,10).map(g=>g.name))} className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100">Top10</button>
                            <button onClick={()=>setTrendPickerOpen(false)} className="ml-auto text-xs px-2 py-1 text-gray-400 hover:text-gray-600">✕</button>
                          </div>
                          {allTrendGroups.map((g,i)=>(
                            <label key={g.name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-xs">
                              <input type="checkbox" checked={trendSelected.includes(g.name)} onChange={()=>toggleTrendItem(g.name)} className="rounded border-gray-300 text-indigo-600" />
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:getTrendColor(g.name, i, trendLevel)}}></span>
                              <span className="truncate flex-1">{g.name}</span>
                              <span className="text-gray-400 flex-shrink-0">¥{fmt(g.cost)}</span>
                              <span className="text-gray-400 flex-shrink-0">CV{fmt(g.tier1,1)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* ========================================== */}
                {/* 💸 コストモニター（媒体別費用推移） */}
                {/* 役割: 予算配分の推移と内訳を監視 */}
                {/* ========================================== */}
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800">💸 コストモニター（費用内訳）</h3>
                  </div>
                  <div style={{height:280}}>
                    <ResponsiveContainer>
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                        <XAxis dataKey="date" tick={{fontSize:11}}/>
                        <YAxis tick={{fontSize:11}} tickFormatter={v=>`¥${(v/1000).toFixed(0)}k`}/>
                        <Tooltip formatter={(v,n)=>typeof v==="number"?`¥${fmt(v)}`:v} wrapperStyle={{fontSize:11}} contentStyle={{padding:"6px 10px"}} itemStyle={{fontSize:11}}/>
                        <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                        {trendGroups.map((g,i)=><Bar key={g} dataKey={`${g.substring(0,20)}_cost`} name={g.substring(0,25)} stackId="cost" fill={getTrendColor(g,i,trendLevel)}/>)}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* ========================================== */}
                {/* グラフA: 💰 効率モニター（費用 × CPA） */}
                {/* 役割: 予算消化に対して獲得効率（CPA）が許容範囲か監視 */}
                {/* ========================================== */}
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800">💰 効率モニター（費用 × CPA）</h3>
                    <div className="flex gap-2 items-center">
                      <MAToggle />
                      <CVToggle />
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                        {[["cost_cpa","費用×CPA"],["cpa_only","CPA推移"]].map(([k,l])=>(
                          <button key={k} onClick={()=>setEfficiencyMode(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition ${efficiencyMode===k?"bg-white shadow text-gray-800":"text-gray-500"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{height:300}}>
                    <ResponsiveContainer>
                      {efficiencyMode === "cost_cpa" ? (
                        /* 費用×CPA モード: 棒=費用, 折れ線=CPA */
                        <ComposedChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                          <XAxis dataKey="date" tick={{fontSize:10}}/>
                          <YAxis yAxisId="l" tick={{fontSize:10}} tickFormatter={v=>`¥${(v/1000).toFixed(0)}k`}/>
                          <YAxis yAxisId="r" orientation="right" tick={{fontSize:10}} tickFormatter={v=>v!=null?`¥${fmt(v)}`:"-"}/>
                          <Tooltip formatter={(v,n)=>{
                            if(n==="費用") return `¥${fmt(v)}`;
                            if(typeof v==="number" && v>0) return `¥${fmt(v)}`;
                            return "-";
                          }} wrapperStyle={{fontSize:11}} contentStyle={{padding:"6px 10px"}} itemStyle={{fontSize:11}}/>
                          <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                          <Bar yAxisId="l" dataKey="cost" name="費用" fill="#93C5FD" radius={[2,2,0,0]}/>
                          {/* 全体CPA線: cvViewに応じて切替 */}
                          <Line yAxisId="r" dataKey={cvCpaKey} name={cvCpaLabel} stroke="#EF4444" strokeWidth={2.5} dot={{r:3}} connectNulls={false}/>
                          {/* 移動平均CPA線 */}
                          {showMA && trendGranularity === "daily" && (
                            <Line yAxisId="r" dataKey={cvView === "siryo" ? "_ma_cpa_siryo" : cvView === "free" ? "_ma_cpa_free" : "_ma_cpa"} name={`${cvCpaLabel} ${maPeriod}日MA`} stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="8 4" strokeOpacity={0.6} connectNulls={false}/>
                          )}
                          {/* グループ別CPA線 */}
                          {!hideGroupLines && trendGroups.map((g,i)=>(
                            <Line key={g} yAxisId="r" dataKey={`${g.substring(0,20)}${getCpaSuffix()}`} name={`${g.substring(0,25)} CPA`} stroke={getTrendColor(g,i,trendLevel)} strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls={false}/>
                          ))}
                        </ComposedChart>
                      ) : (
                        /* CPA推移モード: 折れ線のみ */
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                          <XAxis dataKey="date" tick={{fontSize:10}}/>
                          <YAxis tick={{fontSize:10}} tickFormatter={v=>v!=null?`¥${fmt(v)}`:"-"}/>
                          <Tooltip formatter={v=>v!=null?`¥${fmt(v)}`:"-"} wrapperStyle={{fontSize:11}} contentStyle={{padding:"6px 10px"}} itemStyle={{fontSize:11}}/>
                          <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                          <Line dataKey={cvCpaKey} name={cvCpaLabel} stroke="#EF4444" strokeWidth={2.5} dot={{r:3}} connectNulls={false}/>
                          {/* 移動平均CPA線 */}
                          {showMA && trendGranularity === "daily" && (
                            <Line dataKey={cvView === "siryo" ? "_ma_cpa_siryo" : cvView === "free" ? "_ma_cpa_free" : "_ma_cpa"} name={`${cvCpaLabel} ${maPeriod}日MA`} stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="8 4" strokeOpacity={0.6} connectNulls={false}/>
                          )}
                          {!hideGroupLines && trendGroups.map((g,i)=>(
                            <Line key={g} dataKey={`${g.substring(0,20)}${getCpaSuffix()}`} name={`${g.substring(0,25)} CPA`} stroke={getTrendColor(g,i,trendLevel)} strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls={false}/>
                          ))}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* 配信指標チャート（変更なし） */}
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800">📡 配信指標</h3>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                      {[["cost_cpm","費用/CPM"],["imp_ctr","Imp/CTR"],["click_cvr","Click/CVR"],["ctr_cpc","CTR/CPC"]].map(([k,l])=>(
                        <button key={k} onClick={()=>setChartMetric2(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition ${chartMetric2===k?"bg-white shadow text-gray-800":"text-gray-500"}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{height:300}}>
                    <ResponsiveContainer>
                      {chartMetric2==="cost_cpm"?(
                        <ComposedChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                          <XAxis dataKey="date" tick={{fontSize:10}}/>
                          <YAxis yAxisId="l" tick={{fontSize:10}} tickFormatter={v=>`¥${(v/1000).toFixed(0)}k`}/>
                          <YAxis yAxisId="r" orientation="right" tick={{fontSize:10}} tickFormatter={v=>`¥${fmt(v)}`}/>
                          <Tooltip formatter={(v,n)=>n==="費用"?`¥${fmt(v)}`:n==="CPM"?`¥${fmt(v)}`:v} wrapperStyle={{fontSize:11}} contentStyle={{padding:"6px 10px"}} itemStyle={{fontSize:11}}/>
                          <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                          <Bar yAxisId="l" dataKey="cost" name="費用" fill="#93C5FD" radius={[2,2,0,0]}/>
                          <Line yAxisId="r" dataKey="cpm" name="CPM" stroke="#EF4444" strokeWidth={2.5} dot={{r:3}}/>
                          {!hideGroupLines && trendGroups.map((g,i)=><Line key={g} yAxisId="r" dataKey={`${g.substring(0,20)}_cpm`} name={`${g.substring(0,20)} CPM`} stroke={getTrendColor(g,i,trendLevel)} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>)}
                        </ComposedChart>
                      ):chartMetric2==="imp_ctr"?(
                        <ComposedChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                          <XAxis dataKey="date" tick={{fontSize:10}}/>
                          <YAxis yAxisId="l" tick={{fontSize:10}} tickFormatter={v=>(v/1000).toFixed(0)+"k"}/>
                          <YAxis yAxisId="r" orientation="right" tick={{fontSize:10}} tickFormatter={v=>v.toFixed(1)+"%"}/>
                          <Tooltip formatter={(v,n)=>n==="IMP"?fmt(v):typeof v==="number"?v.toFixed(2)+"%":v} wrapperStyle={{fontSize:11}} contentStyle={{padding:"6px 10px"}} itemStyle={{fontSize:11}}/>
                          <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                          <Bar yAxisId="l" dataKey="imp" name="IMP" fill="#C4B5FD" radius={[2,2,0,0]}/>
                          <Line yAxisId="r" dataKey="ctr" name="CTR" stroke="#F59E0B" strokeWidth={2.5} dot={{r:3}}/>
                          {!hideGroupLines && trendGroups.map((g,i)=><Line key={g} yAxisId="r" dataKey={`${g.substring(0,20)}_ctr`} name={`${g.substring(0,20)} CTR`} stroke={getTrendColor(g,i,trendLevel)} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>)}
                        </ComposedChart>
                      ):chartMetric2==="click_cvr"?(
                        <ComposedChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                          <XAxis dataKey="date" tick={{fontSize:10}}/>
                          <YAxis yAxisId="l" tick={{fontSize:10}}/>
                          <YAxis yAxisId="r" orientation="right" tick={{fontSize:10}} tickFormatter={v=>v.toFixed(2)+"%"}/>
                          <Tooltip formatter={(v,n)=>n==="Click"?fmt(v):typeof v==="number"?v.toFixed(2)+"%":v} wrapperStyle={{fontSize:11}} contentStyle={{padding:"6px 10px"}} itemStyle={{fontSize:11}}/>
                          <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                          <Bar yAxisId="l" dataKey="clicks" name="Click" fill="#6EE7B7" radius={[2,2,0,0]}/>
                          <Line yAxisId="r" dataKey="cvr" name="CVR" stroke="#8B5CF6" strokeWidth={2.5} dot={{r:3}}/>
                          {!hideGroupLines && trendGroups.map((g,i)=><Line key={g} yAxisId="r" dataKey={`${g.substring(0,20)}_cvr`} name={`${g.substring(0,20)} CVR`} stroke={getTrendColor(g,i,trendLevel)} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>)}
                        </ComposedChart>
                      ):(
                        <ComposedChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                          <XAxis dataKey="date" tick={{fontSize:10}}/>
                          <YAxis yAxisId="l" tick={{fontSize:10}} tickFormatter={v=>`¥${fmt(v)}`}/>
                          <YAxis yAxisId="r" orientation="right" tick={{fontSize:10}} tickFormatter={v=>v.toFixed(1)+"%"}/>
                          <Tooltip formatter={(v,n)=>n.includes("CTR")?v.toFixed(2)+"%":n.includes("CPC")?`¥${fmt(v)}`:v} wrapperStyle={{fontSize:11}} contentStyle={{padding:"6px 10px"}} itemStyle={{fontSize:11}}/>
                          <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                          <Bar yAxisId="l" dataKey="cpc" name="CPC" fill="#F87171" radius={[2,2,0,0]}/>
                          <Line yAxisId="r" dataKey="ctr" name="CTR" stroke="#F59E0B" strokeWidth={2.5} dot={{r:3}}/>
                          {!hideGroupLines && trendGroups.map((g,i)=><Line key={g} yAxisId="r" dataKey={`${g.substring(0,20)}_ctr`} name={`${g.substring(0,20)} CTR`} stroke={getTrendColor(g,i,trendLevel)} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>)}
                        </ComposedChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* ========================================== */}
                {/* グラフB: 📊 CV件数推移（ボリューム監視） */}
                {/* 役割: 獲得件数の最大化を追うためのグラフ */}
                {/* ========================================== */}
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800">📊 CV件数推移（ボリューム）</h3>
                    <div className="flex gap-2 items-center">
                      <MAToggle/>
                      <CVToggle/>
                    </div>
                  </div>
                  <div style={{height:280}}>
                    <ResponsiveContainer>
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                        <XAxis dataKey="date" tick={{fontSize:11}}/>
                        <YAxis tick={{fontSize:11}}/>
                        <Tooltip formatter={(v,n)=>{
                          if(typeof v==="number") return n.includes("MA") ? v.toFixed(1) : v.toFixed(1);
                          return v;
                        }} wrapperStyle={{fontSize:11}} contentStyle={{padding:"6px 10px"}} itemStyle={{fontSize:11}}/>
                        <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                        {trendGroups.map((g,i)=><Bar key={g} dataKey={`${g.substring(0,20)}_${cvMetricKey}`} name={g.substring(0,25)} stackId="a" fill={getTrendColor(g,i,trendLevel)}/>)}
                        {/* CV移動平均線 */}
                        {showMA && trendGranularity === "daily" && (
                          <Line dataKey={cvView === "siryo" ? "_ma_siryo" : cvView === "free" ? "_ma_free" : "_ma_tier1"} name={`${cvMetricLabel} ${maPeriod}日MA`} stroke="#6366F1" strokeWidth={2.5} dot={false} strokeDasharray="8 4" strokeOpacity={0.8} connectNulls={false}/>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* ========================================== */}
                {/* グラフC: 📋 CV種別推移（資料請求 vs 無料AC） */}
                {/* 役割: CV構成比の変化を監視 */}
                {/* ========================================== */}
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800">📋 CV種別推移（資料請求 vs 無料AC）</h3>
                  </div>
                  <div style={{height:300}}>
                    <ResponsiveContainer>
                      <ComposedChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                        <XAxis dataKey="date" tick={{fontSize:10}}/>
                        <YAxis yAxisId="l" tick={{fontSize:10}} label={{value:"件数",angle:-90,position:"insideLeft",style:{fontSize:10,fill:"#9CA3AF"}}}/>
                        <YAxis yAxisId="r" orientation="right" tick={{fontSize:10}} tickFormatter={v=>`${v.toFixed(0)}%`} domain={[0,100]} label={{value:"比率",angle:90,position:"insideRight",style:{fontSize:10,fill:"#9CA3AF"}}}/>
                        <Tooltip formatter={(v,n)=>{
                          if(n.includes("比率")) return typeof v==="number"?v.toFixed(1)+"%":"-";
                          return typeof v==="number"?v.toFixed(1):v;
                        }} wrapperStyle={{fontSize:11}} contentStyle={{padding:"6px 10px"}} itemStyle={{fontSize:11}}/>
                        <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                        <Bar yAxisId="l" dataKey="siryo" name="資料請求CV" stackId="cv" fill="#F59E0B" radius={[0,0,0,0]}/>
                        <Bar yAxisId="l" dataKey="free" name="無料AC CV" stackId="cv" fill="#10B981" radius={[2,2,0,0]}/>
                        <Line yAxisId="r" dataKey="siryo_ratio" name="資料請求 比率" stroke="#D97706" strokeWidth={2} dot={false}/>
                        <Line yAxisId="r" dataKey="free_ratio" name="無料AC 比率" stroke="#059669" strokeWidth={2} dot={false}/>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            )}

            {/* ===== DAILY TABLE TAB ===== */}
            {tab === "table" && data && (() => {
              // フィルタ用の選択肢生成
              const tblSources = _.uniq(data.filter(r => dates.includes(r.paid_date)).map(r => r._channel)).sort();
              const tblCampaigns = tableChannel !== "__all__" ? _.uniq(data.filter(r => dates.includes(r.paid_date) && r._channel === tableChannel).map(r => r.campaign_name)).filter(Boolean).sort() : [];
              const tblAdgroups = tableCampaign !== "__all__" ? _.uniq(data.filter(r => dates.includes(r.paid_date) && r._channel === tableChannel && r.campaign_name === tableCampaign).map(r => r.adgroup_name)).filter(Boolean).sort() : [];

              // フィルタ適用
              const filterRows = (rows) => {
                let f = rows;
                if (tableChannel !== "__all__") f = f.filter(r => r._channel === tableChannel);
                if (tableCampaign !== "__all__") f = f.filter(r => r.campaign_name === tableCampaign);
                if (tableAdgroup !== "__all__") f = f.filter(r => r.adgroup_name === tableAdgroup);
                return f;
              };

              // 日別データ生成
              const tableData = dates.map(d => {
                const dr = filterRows(data.filter(r => r.paid_date === d));
                const a = rates(agg(dr));
                return { date: d, ...a, cpa_siryo: safeCpa(a.cost, a.siryo), cpa_free: safeCpa(a.cost, a.free) };
              });

              // 合計行
              const totalRow = (() => {
                const dr = filterRows(data.filter(r => dates.includes(r.paid_date)));
                const a = rates(agg(dr));
                return { date: "合計", ...a, cpa_siryo: safeCpa(a.cost, a.siryo), cpa_free: safeCpa(a.cost, a.free), isTotal: true };
              })();

              // 現在のフィルタ状態のラベル
              const filterLabel = tableChannel === "__all__" ? "全媒体" : tableAdgroup !== "__all__" ? tableAdgroup : tableCampaign !== "__all__" ? tableCampaign : tableChannel;

              // --- A: 集計表のクリップボードコピー ---
              const copyTableToClipboard = () => {
                const header = ["日付","IMP","Click","CTR","CPC","費用","Tier1 CV","資料請求","無料AC","Tier1 CPA"].join("\t");
                const rows = tableData.map(r =>
                  [r.date, r.imp, r.clicks, r.ctr.toFixed(2)+"%", r.cpc, r.cost, r.tier1.toFixed(1), r.siryo.toFixed(1), r.free.toFixed(1), r.cpa != null ? r.cpa : ""].join("\t")
                );
                const total = ["合計", totalRow.imp, totalRow.clicks, totalRow.ctr.toFixed(2)+"%", totalRow.cpc, totalRow.cost, totalRow.tier1.toFixed(1), totalRow.siryo.toFixed(1), totalRow.free.toFixed(1), totalRow.cpa != null ? totalRow.cpa : ""].join("\t");
                const tsv = [header, ...rows, total].join("\n");
                navigator.clipboard.writeText(tsv).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              };

              // --- B: ローデータCSVダウンロード ---
              const downloadRawCSV = () => {
                const rawRows = data.filter(r => dates.includes(r.paid_date));
                // 出力カラム定義
                const csvCols = [
                  { key: "paid_date", label: "日付" },
                  { key: "_channel", label: "媒体" },
                  { key: "campaign_name", label: "キャンペーン" },
                  { key: "campaign_id", label: "キャンペーンID" },
                  { key: "adgroup_name", label: "広告グループ" },
                  { key: "adgroup_id", label: "広告グループID" },
                  { key: "content_cost", label: "費用" },
                  { key: "content_impressions", label: "IMP" },
                  { key: "content_clicks", label: "Click" },
                  { key: "total_tier1cv_cnt", label: "Tier1 CV" },
                  { key: "total_siryo_cnt", label: "資料請求" },
                  { key: "total_free_acount_cnt", label: "無料AC" },
                  ...SIRYO_KEYS.map(k => ({ key: k.key, label: k.label })),
                  ...FREE_KEYS.map(k => ({ key: k.key, label: k.label })),
                ];
                const header = csvCols.map(c => c.label);
                const csvData = rawRows.map(r => csvCols.map(c => r[c.key] ?? ""));
                const csvStr = Papa.unparse({ fields: header, data: csvData });
                const bom = "\uFEFF"; // Excel用BOM
                const blob = new Blob([bom + csvStr], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `raw_data_${firstDate}_${lastDate}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              };

              return (
                <div className="space-y-5">
                  <Card>
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">媒体</label>
                        <select value={tableChannel} onChange={e=>{setTableChannel(e.target.value);setTableCampaign("__all__");setTableAdgroup("__all__");}} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                          <option value="__all__">全媒体</option>
                          {tblSources.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {tableChannel !== "__all__" && (
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">キャンペーン</label>
                          <select value={tableCampaign} onChange={e=>{setTableCampaign(e.target.value);setTableAdgroup("__all__");}} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-xs">
                            <option value="__all__">全キャンペーン</option>
                            {tblCampaigns.map(c=><option key={c} value={c}>{c.substring(0,50)}</option>)}
                          </select>
                        </div>
                      )}
                      {tableCampaign !== "__all__" && (
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">広告グループ</label>
                          <select value={tableAdgroup} onChange={e=>setTableAdgroup(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-xs">
                            <option value="__all__">全広告グループ</option>
                            {tblAdgroups.map(a=><option key={a} value={a}>{a.substring(0,50)}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="ml-auto">
                        <label className="text-xs text-gray-500 block mb-1">エクスポート</label>
                        <button onClick={downloadRawCSV}
                          className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5 text-gray-700">
                          📥 ローデータCSV
                          <span className="text-gray-400">({firstDate}〜{lastDate})</span>
                        </button>
                      </div>
                    </div>
                  </Card>
                  <Card c="overflow-x-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-800">📋 {filterLabel} デイリーデータ</h3>
                      <button onClick={copyTableToClipboard}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${copied ? "bg-emerald-100 text-emerald-700" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                        {copied ? "✓ コピーしました" : "📋 表をコピー"}
                      </button>
                    </div>
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                          <th className="py-2 px-2 text-left text-gray-600 font-semibold sticky left-0 bg-gray-50 z-10">日付</th>
                          <th className="py-2 px-2 text-right text-gray-600 font-semibold">IMP</th>
                          <th className="py-2 px-2 text-right text-gray-600 font-semibold">Click</th>
                          <th className="py-2 px-2 text-right text-gray-600 font-semibold">CTR</th>
                          <th className="py-2 px-2 text-right text-gray-600 font-semibold">CPC</th>
                          <th className="py-2 px-2 text-right text-gray-600 font-semibold">費用</th>
                          <th className="py-2 px-2 text-right text-gray-600 font-semibold font-bold">Tier1 CV</th>
                          <th className="py-2 px-2 text-right text-amber-600 font-semibold">資料請求</th>
                          <th className="py-2 px-2 text-right text-emerald-600 font-semibold">無料AC</th>
                          <th className="py-2 px-2 text-right text-gray-600 font-semibold font-bold">Tier1 CPA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((r, i) => (
                          <tr key={r.date} className={`border-b border-gray-100 hover:bg-blue-50 ${new Date(r.date).getDay() === 0 ? "bg-red-50/30" : new Date(r.date).getDay() === 6 ? "bg-blue-50/30" : ""}`}>
                            <td className="py-1.5 px-2 font-medium text-gray-700 sticky left-0 bg-white z-10">{r.date}<span className="text-gray-400 ml-1">{["日","月","火","水","木","金","土"][new Date(r.date).getDay()]}</span></td>
                            <td className="py-1.5 px-2 text-right">{fmt(r.imp)}</td>
                            <td className="py-1.5 px-2 text-right">{fmt(r.clicks)}</td>
                            <td className="py-1.5 px-2 text-right">{r.ctr.toFixed(2)}%</td>
                            <td className="py-1.5 px-2 text-right">¥{fmt(r.cpc)}</td>
                            <td className="py-1.5 px-2 text-right">¥{fmt(r.cost)}</td>
                            <td className="py-1.5 px-2 text-right font-bold">{fmt(r.tier1, 1)}</td>
                            <td className="py-1.5 px-2 text-right text-amber-600">{fmt(r.siryo, 1)}</td>
                            <td className="py-1.5 px-2 text-right text-emerald-600">{fmt(r.free, 1)}</td>
                            <td className="py-1.5 px-2 text-right font-bold">{r.cpa != null ? `¥${fmt(r.cpa)}` : "-"}</td>
                          </tr>
                        ))}
                        {/* 合計行 */}
                        <tr className="border-t-2 border-gray-300 bg-indigo-50 font-bold">
                          <td className="py-2 px-2 sticky left-0 bg-indigo-50 z-10">合計 ({dates.length}日)</td>
                          <td className="py-2 px-2 text-right">{fmt(totalRow.imp)}</td>
                          <td className="py-2 px-2 text-right">{fmt(totalRow.clicks)}</td>
                          <td className="py-2 px-2 text-right">{totalRow.ctr.toFixed(2)}%</td>
                          <td className="py-2 px-2 text-right">¥{fmt(totalRow.cpc)}</td>
                          <td className="py-2 px-2 text-right">¥{fmt(totalRow.cost)}</td>
                          <td className="py-2 px-2 text-right">{fmt(totalRow.tier1, 1)}</td>
                          <td className="py-2 px-2 text-right text-amber-600">{fmt(totalRow.siryo, 1)}</td>
                          <td className="py-2 px-2 text-right text-emerald-600">{fmt(totalRow.free, 1)}</td>
                          <td className="py-2 px-2 text-right">{totalRow.cpa != null ? `¥${fmt(totalRow.cpa)}` : "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card>
                </div>
              );
            })()}

            {tab === "drill" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <button onClick={() => { setDrillSrc(null); setDrillCamp(null); }} className={`px-3 py-1 rounded-lg ${!drillSrc ? "bg-indigo-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}>全媒体</button>
                  {drillSrc && <><span className="text-gray-300">›</span><button onClick={() => setDrillCamp(null)} className={`px-3 py-1 rounded-lg ${!drillCamp ? "bg-indigo-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}>{drillSrc}</button></>}
                  {drillCamp && <><span className="text-gray-300">›</span><span className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs max-w-xs truncate">{drillCamp.campaign_name}</span></>}
                </div>
                {!drillSrc && <Card><h3 className="font-bold text-gray-800 mb-3">媒体を選択</h3><Tbl columns={mediaCols} data={bySource} onRowClick={r=>{setDrillSrc(r.source);setDrillCamp(null);}}/></Card>}
                {drillSrc && !drillCamp && <Card><h3 className="font-bold text-gray-800 mb-3">📂 {drillSrc} キャンペーン</h3><Tbl columns={campCols} data={drillCampaigns} onRowClick={r=>setDrillCamp(r)}/></Card>}
                {drillCamp && <Card><h3 className="font-bold text-gray-800 mb-3">📂 広告グループ</h3><p className="text-xs text-gray-500 mb-3">{drillCamp.campaign_name}</p><Tbl columns={adgCols} data={drillAdgroups}/></Card>}
              </div>
            )}

            {tab === "debug" && data && (() => {
              const channelCounts = _.countBy(data, "_channel");
              const srcMedCounts = _.countBy(data, r => `${r.utm_source || "(空)"} / ${r.utm_medium || "(空)"}`);
              const yahooRows = data.filter(r => (r.utm_source || "").toLowerCase().includes("yahoo"));
              const yahooMediums = _.countBy(yahooRows, r => `"${r.utm_medium}"`);
              const yahooCosts = _.groupBy(yahooRows, "utm_medium");
              const channelSummary = Object.entries(_.groupBy(data, "_channel")).map(([ch, rows]) => {
                const a = agg(rows);
                return { channel: ch, rows: rows.length, cost: a.cost, imp: a.imp, clicks: a.clicks, tier1: a.tier1 };
              }).sort((a, b) => b.cost - a.cost);

              const lastDayRows = data.filter(r => r.paid_date === lastDate);
              const allChannels = Object.keys(_.groupBy(data, "_channel")).sort();
              const lastDayByChannel = _.groupBy(lastDayRows, "_channel");

              const ydaRows = data.filter(r => r._channel === "Yahoo! ディスプレイ");
              const ydaDates = _.uniq(ydaRows.map(r => r.paid_date)).sort();

              const debugText = [
                "=== チャネル分類結果 ===",
                ...channelSummary.map(r => `${r.channel}: ${r.rows}行 / 費用¥${fmt(r.cost)} / IMP${fmt(r.imp)} / Click${fmt(r.clicks)} / Tier1CV${fmt(r.tier1, 1)}`),
                "",
                "=== source / medium 組み合わせ ===",
                ...Object.entries(srcMedCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} → ${v}件`),
                "",
                "=== Yahoo行の詳細 ===",
                `Yahoo行数: ${yahooRows.length}`,
                "utm_mediumの値: " + Object.entries(yahooMediums).map(([k, v]) => `${k}=${v}件`).join(", "),
                ...Object.entries(yahooCosts).map(([med, rows]) => `utm_medium="${med}" → ${rows.length}件 / 費用¥${fmt(_.sumBy(rows, "content_cost"))} / IMP${fmt(_.sumBy(rows, "content_impressions"))}`),
                "",
                "=== Yahoo行サンプル(先頭5行) ===",
                ...yahooRows.slice(0, 5).map((r, i) => `[${i + 1}] date=${r.paid_date} source="${r.utm_source}" medium="${r.utm_medium}" campaign="${(r.utm_campaign || "").substring(0, 30)}" _channel=${r._channel} cost=¥${fmt(r.content_cost)} imp=${fmt(r.content_impressions)}`),
                "",
                `=== 最終日チェック (${lastDate}) ===`,
                ...allChannels.map(ch => {
                  const rows = lastDayByChannel[ch] || [];
                  const a = agg(rows);
                  return `${rows.length === 0 ? "⚠️ " : "✅ "}${ch}: ${rows.length}行 / 費用¥${fmt(a.cost)} / IMP${fmt(a.imp)} / Tier1CV${fmt(a.tier1, 1)}`;
                }),
                "",
                `=== Yahoo!ディスプレイ 日付範囲 ===`,
                `全${ydaDates.length}日 / 最初: ${ydaDates[0] || "なし"} / 最後: ${ydaDates[ydaDates.length - 1] || "なし"}`,
                `最終日(${lastDate})のYDA行数: ${(lastDayByChannel["Yahoo! ディスプレイ"] || []).length}`,
                "直近5日:",
                ...ydaDates.slice(-5).map(d => {
                  const dr = ydaRows.filter(r => r.paid_date === d);
                  const a = agg(dr);
                  return `  ${d}: ${dr.length}行 / 費用¥${fmt(a.cost)} / IMP${fmt(a.imp)}`;
                }),
              ].join("\n");

              const copyDebug = () => {
                const ta = document.createElement("textarea");
                ta.value = debugText;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              };

              return (
                <div className="space-y-5">
                  <Card>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-800">🔍 デバッグ情報</h3>
                      <button onClick={copyDebug} className={`text-xs px-4 py-2 rounded-lg font-medium transition ${copied ? "bg-emerald-100 text-emerald-700" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                        {copied ? "✓ コピーしました！" : "📋 全結果をコピー"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">下のボタンで結果をコピーして、チャットに貼り付けてください</p>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-gray-800 mb-3">チャネル分類結果</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2">チャネル名</th><th className="text-right py-2 px-2">行数</th><th className="text-right py-2 px-2">費用</th><th className="text-right py-2 px-2">IMP</th><th className="text-right py-2 px-2">Click</th><th className="text-right py-2 px-2">Tier1 CV</th>
                        </tr></thead>
                        <tbody>{channelSummary.map(r => (
                          <tr key={r.channel} className={`border-b border-gray-50 hover:bg-blue-50 ${r.channel.includes("Yahoo") && r.channel.includes("ディスプレイ") ? "bg-yellow-50" : ""}`}>
                            <td className="py-2 px-2 font-medium flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:getColor(r.channel)}}></span>{r.channel}</td>
                            <td className="text-right py-2 px-2">{r.rows}</td>
                            <td className="text-right py-2 px-2">¥{fmt(r.cost)}</td>
                            <td className="text-right py-2 px-2">{fmt(r.imp)}</td>
                            <td className="text-right py-2 px-2">{fmt(r.clicks)}</td>
                            <td className="text-right py-2 px-2">{fmt(r.tier1, 1)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-gray-800 mb-3">source / medium 組み合わせ</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2">source / medium</th><th className="text-right py-2 px-2">行数</th>
                        </tr></thead>
                        <tbody>{Object.entries(srcMedCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                          <tr key={k} className={`border-b border-gray-50 ${k.includes("display") ? "bg-yellow-50" : ""}`}>
                            <td className="py-2 px-2 font-mono">{k}</td><td className="text-right py-2 px-2">{v}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-gray-800 mb-3">Yahoo行の詳細</h3>
                    <p className="text-xs text-gray-500 mb-2">yahoo行: {yahooRows.length}件</p>
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-700 mb-1">utm_mediumの値:</p>
                      {Object.entries(yahooMediums).map(([k, v]) => (
                        <div key={k} className="text-xs font-mono bg-gray-50 rounded px-2 py-1 mb-1">{k} → {v}件</div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">utm_medium別 合計:</p>
                      {Object.entries(yahooCosts).map(([med, rows]) => (
                        <div key={med || "(空)"} className="text-xs font-mono bg-gray-50 rounded px-2 py-1 mb-1">
                          medium="{med}" → {rows.length}件 / 費用¥{fmt(_.sumBy(rows, "content_cost"))} / IMP{fmt(_.sumBy(rows, "content_impressions"))} / Click{fmt(_.sumBy(rows, "content_clicks"))}
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-gray-800 mb-3">Yahoo行サンプル（先頭5行）</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-gray-200">
                          <th className="text-left py-1 px-1">date</th><th className="text-left py-1 px-1">source</th><th className="text-left py-1 px-1">medium</th><th className="text-left py-1 px-1">campaign</th><th className="text-left py-1 px-1">_channel</th><th className="text-right py-1 px-1">cost</th><th className="text-right py-1 px-1">imp</th>
                        </tr></thead>
                        <tbody>{yahooRows.slice(0, 5).map((r, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1 px-1">{r.paid_date}</td>
                            <td className="py-1 px-1 font-mono">"{r.utm_source}"</td>
                            <td className="py-1 px-1 font-mono">"{r.utm_medium}"</td>
                            <td className="py-1 px-1 truncate max-w-xs">{r.utm_campaign}</td>
                            <td className="py-1 px-1 font-medium">{r._channel}</td>
                            <td className="text-right py-1 px-1">¥{fmt(r.content_cost)}</td>
                            <td className="text-right py-1 px-1">{fmt(r.content_impressions)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-gray-800 mb-3">📅 最終日チェック</h3>
                    <p className="text-xs text-gray-500 mb-2">最終日: <span className="font-bold">{lastDate}</span> / 全日数: {dates.length}</p>
                    <p className="text-xs font-medium text-gray-700 mb-1">最終日のチャネル別行数・費用:</p>
                    {(() => {
                      const lastDayRows2 = data.filter(r => r.paid_date === lastDate);
                      const byChannel = _.groupBy(lastDayRows2, "_channel");
                      const allCh = Object.keys(_.groupBy(data, "_channel")).sort();
                      return allCh.map(ch => {
                        const rows = byChannel[ch] || [];
                        const a = agg(rows);
                        const missing = rows.length === 0;
                        return (
                          <div key={ch} className={`text-xs font-mono rounded px-2 py-1 mb-1 ${missing ? "bg-red-50 text-red-700" : "bg-gray-50"}`}>
                            {missing ? "⚠️ " : "✅ "}{ch}: {rows.length}行 / 費用¥{fmt(a.cost)} / IMP{fmt(a.imp)} / Tier1CV{fmt(a.tier1, 1)}
                          </div>
                        );
                      });
                    })()}
                    <p className="text-xs font-medium text-gray-700 mt-3 mb-1">Yahoo!ディスプレイの直近日付（末尾5日）:</p>
                    {(() => {
                      const ydaRows2 = data.filter(r => r._channel === "Yahoo! ディスプレイ");
                      const ydaDates2 = _.uniq(ydaRows2.map(r => r.paid_date)).sort().slice(-5);
                      return ydaDates2.length > 0
                        ? ydaDates2.map(d => {
                            const dr = ydaRows2.filter(r => r.paid_date === d);
                            const a = agg(dr);
                            return <div key={d} className="text-xs font-mono bg-gray-50 rounded px-2 py-1 mb-1">{d}: {dr.length}行 / 費用¥{fmt(a.cost)} / IMP{fmt(a.imp)}</div>;
                          })
                        : <div className="text-xs text-red-600">Yahoo!ディスプレイの行が0件です</div>;
                    })()}
                  </Card>
                </div>
              );
            })()}

            {tab === "ai" && (
              <div className="space-y-5">
                <Card>
                  <div className="flex items-center gap-4 mb-4">
                    <h3 className="font-bold text-gray-800">🤖 媒体ディープダイブ</h3>
                    <div className="flex items-center gap-2 ml-auto">
                      <select value={aiChannel} onChange={e=>{setAiChannel(e.target.value);setAiInsight("");}}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-48">
                        <option value="">媒体を選択...</option>
                        {sources.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={generateAI} disabled={aiLoading || !aiChannel}
                        className={`px-5 py-2 rounded-xl text-sm font-medium transition shadow ${aiLoading || !aiChannel?"bg-gray-300 text-gray-500 cursor-not-allowed":"bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-200"}`}>
                        {aiLoading?"分析中...":"診断を実行"}
                      </button>
                    </div>
                  </div>
                  {!aiChannel && !aiLoading && (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-3xl mb-3">🔍</p>
                      <p className="text-sm">分析したい媒体を選択して「診断を実行」をクリック</p>
                      <p className="text-xs mt-2 text-gray-300">キャンペーン粒度で好調/不調要因を特定します</p>
                    </div>
                  )}
                  {aiChannel && !aiInsight && !aiLoading && (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-sm">「診断を実行」で<span className="font-medium text-gray-600">{aiChannel}</span>を分析します</p>
                    </div>
                  )}
                  {aiLoading && (
                    <div className="flex items-center gap-3 py-12 justify-center">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-gray-500 text-sm">{aiChannel}を分析中...</span>
                    </div>
                  )}
                  {aiInsight && !aiLoading && (
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {aiInsight.split("\n").map((line,i) => {
                        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-bold text-gray-800 mt-5 mb-2">{line.replace("### ","")}</h3>;
                        if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold text-gray-800 mt-5 mb-2">{line.replace("## ","")}</h3>;
                        if (line.trim() === "---") return <hr key={i} className="my-3 border-gray-200"/>;
                        if (line.startsWith("- ")) return <div key={i} className="ml-4 mb-1 flex gap-2"><span className="text-indigo-500 mt-0.5">•</span><span dangerouslySetInnerHTML={{__html: line.replace("- ","").replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}} /></div>;
                        if (line.trim() === "") return <div key={i} className="h-2"></div>;
                        return <p key={i} className="mb-1" dangerouslySetInnerHTML={{__html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}} />;
                      })}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
