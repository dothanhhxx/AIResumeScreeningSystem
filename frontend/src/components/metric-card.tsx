import { useI18n } from "@/i18n/provider";

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
  const { t } = useI18n();

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
        <span>{t("vs. last month")}</span>
      </div>
    </article>
  );
}
