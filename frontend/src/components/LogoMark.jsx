import { useId } from "react";

/** The Funall funnel mark — gradient twisted-funnel icon, reused in the nav, footer, and auth pages. */
export default function LogoMark({ size = 34 }) {
  // Gradient id must be unique per instance — two logos on one page (e.g.
  // nav + footer) would otherwise share <defs> ids, which is invalid SVG.
  const id = useId();

  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`funnel${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6D4AEB" />
          <stop offset="50%" stopColor="#FF3E8E" />
          <stop offset="100%" stopColor="#FF9E4F" />
        </linearGradient>
      </defs>
      <path
        d="M 4 12
           L 96 12
           C 96 19, 70 22, 60 32
           C 74 40, 80 46, 68 56
           C 58 64, 54 72, 50 96
           C 46 72, 42 64, 32 56
           C 20 46, 26 40, 40 32
           C 30 22, 4 19, 4 12
           Z"
        fill={`url(#funnel${id})`}
      />
    </svg>
  );
}
