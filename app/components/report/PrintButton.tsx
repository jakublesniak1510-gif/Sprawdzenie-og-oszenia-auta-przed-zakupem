"use client";

export function PrintButton({ label = "Drukuj / zapisz PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
    >
      🖨 {label}
    </button>
  );
}
