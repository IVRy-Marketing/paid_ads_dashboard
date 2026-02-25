export default function Card({ children, c = "" }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${c}`}>
      {children}
    </div>
  );
}
