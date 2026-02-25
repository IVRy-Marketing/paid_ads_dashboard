export default function MiniBar({ value, max, color = "#6366F1" }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-16 h-2 bg-gray-100 rounded-full inline-block ml-2 align-middle">
      <div className="h-2 rounded-full" style={{ width: `${w}%`, background: color }}></div>
    </div>
  );
}
