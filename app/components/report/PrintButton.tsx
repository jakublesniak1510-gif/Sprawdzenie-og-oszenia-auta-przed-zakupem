"use client";

import { Icon } from "@/components/ui/icons";

export function PrintButton({ label = "Drukuj / zapisz PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
    >
      <Icon name="print" className="h-4 w-4" />
      {label}
    </button>
  );
}
