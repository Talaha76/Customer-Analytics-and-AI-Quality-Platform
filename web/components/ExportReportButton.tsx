"use client";

export default function ExportReportButton({ label = "Export report" }: { label?: string }) {
  return (
    <button className="primary-button" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
