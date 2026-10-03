export function MetricCard({
  label,
  value,
  change,
  tone,
  icon,
}: {
  label: string;
  value: string;
  change: string;
  tone: "mint" | "blue" | "amber" | "violet";
  icon: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-topline">
        <span>{label}</span>
        <span className={`metric-icon metric-icon-${tone}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-change">
        <span className="change-positive">{change}</span>
        <span>vs. last month</span>
      </div>
    </article>
  );
}
