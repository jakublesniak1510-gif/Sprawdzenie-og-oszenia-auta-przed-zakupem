/**
 * Ikony SVG inline (styl obrysowy, 24×24, kolor = currentColor). Domyślnie dekoracyjne (aria-hidden);
 * z `label` – ikona znacząca (role="img" + aria-label).
 */
const PATHS = {
  flag: "M4 21V4m0 0h11l-1.5 4L15 12H4",
  gauge: "M12 14l3.5-3.5M4.6 18a9 9 0 1 1 14.8 0M12 14a1 1 0 1 0 0 .01",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.2L3.6 17.2a1.9 1.9 0 0 0 2.7 2.7l5.7-5.7a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.4-.4-.4-2.4z",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12zM8 10h8M8 14h5",
  clipboard: "M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M8.5 13.5l2 2 4-4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6L6 18",
  minus: "M6 12h12",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5h.01",
  alert: "M12 3.5L2.5 20h19zM12 10v4.5M12 17.5h.01",
  octagon: "M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2zM12 7.5v5.5M12 16.5h.01",
  share: "M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  copy: "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM16 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3",
  print: "M7 9V3h10v6M7 17H4v-7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7h-3M7 14h10v7H7z",
  menu: "M4 7h16M4 12h16M4 17h16",
  arrow: "M5 12h14M13 6l6 6-6 6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  car: "M5 16h14M5 16v3h2.5v-3M16.5 16v3H19v-3M5 16l-.5-5 2-5h11l2 5-.5 5M4.5 11h15M8 13.5h.01M16 13.5h.01",
  document: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  shield: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-4.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5", label, strokeWidth = 2 }: { name: IconName; className?: string; label?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    >
      {label && <title>{label}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
