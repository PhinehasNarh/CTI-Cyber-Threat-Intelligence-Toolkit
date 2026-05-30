export default function StatCard({ label, value, color = "#00ff87" }) {
  return (
    <div className="bg-cti-surface rounded-xl border border-cti-border p-4">
      <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className="text-2xl font-display font-bold"
        style={{ color }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
