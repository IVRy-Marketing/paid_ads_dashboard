export default function Tbl({ columns, data: d, onRowClick }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((c, i) => (
              <th key={i} className={`py-2 px-2 text-gray-500 font-medium text-xs ${c.a === "right" ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-gray-50 hover:bg-blue-50 ${onRowClick ? "cursor-pointer" : ""}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((c, ci) => (
                <td key={ci} className={`py-2 px-2 ${c.a === "right" ? "text-right" : ""} ${c.b ? "font-bold" : ""}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
