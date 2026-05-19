import type { ReactNode } from "react";

type AccountingReportFiltersProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  children?: ReactNode;
};

export function AccountingReportFilters({
  from,
  to,
  onFromChange,
  onToChange,
  children,
}: AccountingReportFiltersProps) {
  return (
    <article className="panel">
      <div className="accounting-filters">
        <label className="accounting-filter">
          <span>Desde</span>
          <input
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </label>

        <label className="accounting-filter">
          <span>Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
          />
        </label>

        {children}
      </div>
    </article>
  );
}