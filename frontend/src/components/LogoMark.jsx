/** The real Funall funnel icon (provided artwork), reused in the nav, footer, and auth pages. */
export default function LogoMark({ size = 34 }) {
  return (
    <img
      className="logo-mark"
      src="/funall-icon.png"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
    />
  );
}
