import { SIRYO_KEYS, FREE_KEYS } from '../config/index.js';
import { fmt, fmtPct, pctChg, safeCpa } from '../utils/dataProcessing.js';
import MiniBar from './MiniBar.jsx';

export default function CVBreakdown({ data, prevData, cost }) {
  const maxVal = Math.max(
    ...SIRYO_KEYS.map(k => data[k.key] || 0),
    ...FREE_KEYS.map(k => data[k.key] || 0),
    0.1
  );

  const Section = ({ title, keys, color, total, cpa }) => (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-bold text-gray-800">{title}</span>
        <span className="text-sm font-bold" style={{ color }}>{fmt(total, 1)}</span>
        {cpa != null && <span className="text-xs text-gray-500">CPA ¥{fmt(cpa)}</span>}
      </div>
      {keys.map(k => {
        const v = data[k.key] || 0;
        const pv = prevData?.[k.key];
        const chg = pv != null && pv > 0 ? pctChg(v, pv) : null;
        return v > 0.001 || (pv != null && pv > 0.001) ? (
          <div key={k.key} className="flex items-center py-1 text-sm">
            <span className="w-44 text-gray-600 text-xs">{k.label}</span>
            <span className="w-16 text-right font-medium">{fmt(v, 1)}</span>
            <MiniBar value={v} max={maxVal} color={color} />
            {chg != null && (
              <span className={`ml-2 text-xs font-medium ${chg >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {fmtPct(chg)}
              </span>
            )}
          </div>
        ) : null;
      })}
    </div>
  );

  return (
    <div>
      <Section title="📄 資料請求" keys={SIRYO_KEYS} color="#F59E0B" total={data.siryo} cpa={safeCpa(cost, data.siryo)} />
      <Section title="👤 無料アカウント" keys={FREE_KEYS} color="#10B981" total={data.free} cpa={safeCpa(cost, data.free)} />
    </div>
  );
}
