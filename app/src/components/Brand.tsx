/**
 * HeiMailer brand marks.
 *
 * HeiMailerLogo — the app's own identity: a paper-plane "send" mark inside a
 * brand-green rounded badge, with a subtle animated flight trail and sheen.
 * Animation is pure CSS (see .heimark-* rules) and respects reduced-motion.
 *
 * HeinekenMyanmarLogo — the corporate endorsement. Loads the real transparent
 * logo from /heineken-myanmar.png if present; otherwise falls back to a clean
 * star + wordmark lockup that reads on both light and dark themes.
 */
import { useState } from "react";

export function HeiMailerLogo({ size = 64, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <span
      className={`heimark${animated ? " heimark--on" : ""}`}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" width={size} height={size} fill="none">
        <defs>
          <linearGradient id="heimark-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00a04a" />
            <stop offset="1" stopColor="#00622a" />
          </linearGradient>
          <linearGradient id="heimark-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.30" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* badge */}
        <rect x="0" y="0" width="64" height="64" rx="18" fill="url(#heimark-g)" />
        <rect x="0" y="0" width="64" height="32" rx="18" fill="url(#heimark-sheen)" />

        {/* animated flight trail */}
        <path
          className="heimark-trail"
          d="M14 44 C24 44, 30 38, 44 22"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="3 5"
        />

        {/* paper plane */}
        <g className="heimark-plane">
          <path
            d="M47 17 L29 27.5 L34.5 31 L47 17 Z"
            fill="#fff"
          />
          <path
            d="M47 17 L34.5 31 L35 39.5 L38.5 33.5 L47 17 Z"
            fill="#eafff2"
          />
          <path
            d="M47 17 L29 27.5 L34.5 31 L35 39.5 L47 17 Z"
            fill="#ffffff"
            fillOpacity="0.9"
          />
        </g>
      </svg>
    </span>
  );
}

export function HeinekenMyanmarLogo({ height = 26 }: { height?: number }) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src="/heineken-myanmar.png"
        alt="HEINEKEN Myanmar"
        className="hk-logo"
        style={{ height }}
        onError={() => setFailed(true)}
      />
    );
  }

  // Fallback lockup (used until /heineken-myanmar.png is added).
  return (
    <span className="hk-logo-fallback" style={{ height }} aria-label="HEINEKEN Myanmar">
      <svg viewBox="0 0 24 24" width={height} height={height} aria-hidden>
        <path
          d="m12 2 2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 16.9 6.2 20.9l1.1-6.47-4.7-4.58 6.5-.95Z"
          fill="#E2231A"
          stroke="#fff"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hk-logo-fallback__text">
        HEINEKEN <b>Myanmar</b>
      </span>
    </span>
  );
}
