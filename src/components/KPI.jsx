import { fmtPct } from '../utils/dataProcessing.js';

export default function KPI({ label, value, change, unit = "", up = true, sub }) {
  const cv = change != null ? fmtPct(change) : null;
  const pos = change != null && ((up && change > 0) || (!up && change < 0));
  const neg = change != null && ((up && change < 0) || (!up && change > 0));
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-900">{unit}{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      {cv && (
        <div className={`text-xs mt-0.5 font-medium ${pos ? "text-emerald-600" : neg ? "text-red-500" : "text-gray-500"}`}>
          {cv}
        </div>
      )}
    </div>
  );
}
