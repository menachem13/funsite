import { useId } from "react";

/** The Funsite "F" mark — gradient ribbon logo, reused in the nav, footer, and auth pages. */
export default function LogoMark({ size = 28 }) {
  // Gradient ids must be unique per instance — two logos on one page (e.g.
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
        <linearGradient id={`stem${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4F63F5" />
          <stop offset="55%" stopColor="#3A6FF2" />
          <stop offset="100%" stopColor="#17C9B4" />
        </linearGradient>
        <linearGradient id={`top${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4F63F5" />
          <stop offset="100%" stopColor="#8B4FF2" />
        </linearGradient>
        <linearGradient id={`mid${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF5E7A" />
          <stop offset="100%" stopColor="#FF3E9E" />
        </linearGradient>
      </defs>
      <path
        d="M46 16 L46 70 C46 80 40 86 30 86 C22 86 16 81 16 73 L16 38 C16 26 25 16 38 16 Z"
        fill={`url(#stem${id})`}
      />
      <path d="M30 16 L76 16 L92 29 L76 42 L30 42 Z" fill={`url(#top${id})`} />
      <path d="M30 47 L66 47 L80 59 L66 71 L30 71 Z" fill={`url(#mid${id})`} />
      <circle cx="70" cy="82" r="8.5" fill="#17C9B4" />
    </svg>
  );
}
