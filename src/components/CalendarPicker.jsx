export default function CalendarPicker({ calMonth, setCalMonth, pickFrom, pickTo, onPick, onApply, onClose, allDates }) {
  const { y, m } = calMonth;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startDay = new Date(y, m, 1).getDay();
  const monthLabel = `${y}年${m + 1}月`;
  const prevM = () => setCalMonth(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
  const nextM = () => setCalMonth(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });
  const pad = (n) => String(n).padStart(2, "0");
  const toStr = (day) => `${y}-${pad(m + 1)}-${pad(day)}`;
  const hasData = (day) => allDates.includes(toStr(day));
  const isFrom = (day) => pickFrom === toStr(day);
  const isTo = (day) => pickTo === toStr(day);
  const inRange = (day) => {
    if (!pickFrom || !pickTo) return false;
    const s = toStr(day);
    return s > pickFrom && s < pickTo;
  };

  return (
    <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 p-3 w-64" style={{ minWidth: 260 }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevM} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 text-sm">◀</button>
        <span className="text-sm font-bold text-gray-800">{monthLabel}</span>
        <button onClick={nextM} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 text-sm">▶</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs mb-1">
        {["日","月","火","水","木","金","土"].map(d => (
          <div key={d} className={`py-0.5 font-medium ${d === "日" ? "text-red-400" : d === "土" ? "text-blue-400" : "text-gray-400"}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-xs gap-y-0.5">
        {Array.from({ length: startDay }, (_, i) => <div key={`e${i}`}></div>)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const hd = hasData(day);
          const fr = isFrom(day), tr = isTo(day), ir = inRange(day);
          const dow = (startDay + i) % 7;
          return (
            <button key={day} onClick={() => hd && onPick(toStr(day))} disabled={!hd}
              className={`w-8 h-8 rounded-md text-xs font-medium mx-auto flex items-center justify-center transition
                ${fr || tr ? "bg-indigo-600 text-white" : ir ? "bg-indigo-100 text-indigo-700" : hd ? "hover:bg-gray-100 text-gray-700" : "text-gray-300 cursor-default"}
                ${!fr && !tr && !ir && dow === 0 && hd ? "text-red-500" : ""} ${!fr && !tr && !ir && dow === 6 && hd ? "text-blue-500" : ""}`}>
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {pickFrom ? <span>{pickFrom}{pickTo ? ` 〜 ${pickTo}` : " 〜 ?"}</span> : <span className="text-gray-400">開始日をクリック</span>}
        </div>
        <div className="flex gap-1">
          <button onClick={onClose} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-md">閉じる</button>
          <button onClick={onApply} disabled={!pickFrom} className={`px-3 py-1 text-xs rounded-md font-medium ${pickFrom ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-200 text-gray-400"}`}>適用</button>
        </div>
      </div>
    </div>
  );
}
