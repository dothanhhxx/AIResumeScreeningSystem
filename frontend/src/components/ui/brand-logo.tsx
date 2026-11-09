import type { CSSProperties } from "react";

export interface BrandLogoProps {
  /**
   * "dark" = light/brass text & luminous forest-brass mark for dark forest backgrounds
   * "light" = deep forest text & rich forest-brass mark for cream/white backgrounds
   */
  variant?: "dark" | "light";
  /** Size preset for mark and wordmark */
  size?: "sm" | "md" | "lg";
  /** Show the tagline "From resume noise to explainable hiring clarity." */
  showTagline?: boolean;
  /** Render only the geometric TL prism + sparkle mark (e.g., collapsed sidebar) */
  markOnly?: boolean;
  /** Optional custom tagline text (already translated if passed) */
  tagline?: string;
  className?: string;
  style?: CSSProperties;
}

const SIZE_MAP = {
  sm: { mark: 28, title: 16, tagline: 9.5, gap: 9 },
  md: { mark: 36, title: 19, tagline: 10.5, gap: 11 },
  lg: { mark: 46, title: 24, tagline: 11.5, gap: 13 },
} as const;

/**
 * TalentLens geometric "TL" prism + 4-pointed AI sparkle logo,
 * unified with the Deep Forest Green & Warm Brass palette.
 */
export function BrandMark({
  size = 36,
  variant = "dark",
  className,
}: {
  size?: number;
  variant?: "dark" | "light";
  className?: string;
}) {
  const isDark = variant === "dark";

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 128 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, display: "block" }}
    >
      <defs>
        {/* Top-left angled chevron brow gradient (Warm Brass -> Bright Gold) */}
        <linearGradient
          id={`tl-brow-${variant}`}
          x1="8"
          y1="44"
          x2="86"
          y2="14"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={isDark ? "#d6ad4a" : "#b88928"} />
          <stop offset="55%" stopColor={isDark ? "#f3da8b" : "#e8c467"} />
          <stop offset="100%" stopColor={isDark ? "#e8c467" : "#c69932"} />
        </linearGradient>

        {/* Left vertical T-stem gradient */}
        <linearGradient
          id={`tl-left-pillar-${variant}`}
          x1="44"
          y1="26"
          x2="44"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={isDark ? "#2d8a66" : "#1c5a44"} />
          <stop offset="100%" stopColor={isDark ? "#134232" : "#082219"} />
        </linearGradient>

        {/* Right vertical L-stem gradient */}
        <linearGradient
          id={`tl-right-pillar-${variant}`}
          x1="71"
          y1="22"
          x2="71"
          y2="106"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={isDark ? "#1f684d" : "#134232"} />
          <stop offset="100%" stopColor={isDark ? "#0d3326" : "#061912"} />
        </linearGradient>

        {/* Right upward L-wing gradient (Forest -> Brass Gold) */}
        <linearGradient
          id={`tl-wing-${variant}`}
          x1="64"
          y1="104"
          x2="118"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={isDark ? "#134232" : "#082219"} />
          <stop offset="45%" stopColor={isDark ? "#287a5b" : "#1c5a44"} />
          <stop offset="100%" stopColor={isDark ? "#e8c467" : "#d6ad4a"} />
        </linearGradient>

        {/* 4-point AI sparkle star gradient */}
        <linearGradient
          id={`tl-star-${variant}`}
          x1="96"
          y1="10"
          x2="122"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={isDark ? "#f7e3a3" : "#e8c467"} />
          <stop offset="100%" stopColor={isDark ? "#d6ad4a" : "#b88928"} />
        </linearGradient>
      </defs>

      {/* 1. Top angled chevron brow (forms the T crossbar & prism roof) */}
      <path
        d="M10 33L61 6L86 21V58L78 52V25L61 15L10 43V33Z"
        fill={`url(#tl-brow-${variant})`}
      />

      {/* 2. Left vertical pillar (T stem) */}
      <path
        d="M35 28L50 20V98L35 88V28Z"
        fill={`url(#tl-left-pillar-${variant})`}
        stroke={isDark ? "rgb(232 196 103 / 0.28)" : "none"}
        strokeWidth="0.75"
      />

      {/* 3. Right vertical pillar (L vertical stem) */}
      <path
        d="M63 22L78 24V76L63 106V22Z"
        fill={`url(#tl-right-pillar-${variant})`}
        stroke={isDark ? "rgb(232 196 103 / 0.25)" : "none"}
        strokeWidth="0.75"
      />

      {/* 4. Right angled upward wing (L base arm) */}
      <path
        d="M63 106L78 76L118 52V66L63 106Z"
        fill={`url(#tl-wing-${variant})`}
      />

      {/* 5. Four-pointed AI clarity star on top right */}
      <path
        d="M109 10C111.5 18.5 114.5 21.5 123 24C114.5 26.5 111.5 29.5 109 38C106.5 29.5 103.5 26.5 95 24C103.5 21.5 106.5 18.5 109 10Z"
        fill={`url(#tl-star-${variant})`}
      />
    </svg>
  );
}

export function BrandLogo({
  variant = "dark",
  size = "md",
  showTagline = false,
  markOnly = false,
  tagline = "From resume noise to explainable hiring clarity.",
  className = "",
  style,
}: BrandLogoProps) {
  const dims = SIZE_MAP[size];
  const isDark = variant === "dark";

  return (
    <span
      className={`tl-brand-logo ${className}`.trim()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${dims.gap}px`,
        textDecoration: "none",
        lineHeight: 1,
        ...style,
      }}
    >
      <BrandMark size={dims.mark} variant={variant} />
      {!markOnly && (
        <span
          className="tl-brand-wordmark"
          style={{
            display: "inline-grid",
            gap: showTagline ? "3px" : "0",
            minWidth: 0,
          }}
        >
          <span
            className="tl-brand-title"
            style={{
              fontSize: `${dims.title}px`,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: isDark ? "#f7f1e3" : "#082219",
              whiteSpace: "nowrap",
            }}
          >
            Talent
            <span
              style={{
                color: isDark ? "#e8c467" : "#b88928",
                fontWeight: 700,
              }}
            >
              Lens
            </span>
          </span>
          {showTagline && (
            <small
              className="tl-brand-tagline"
              style={{
                fontSize: `${dims.tagline}px`,
                fontWeight: 500,
                letterSpacing: "0.01em",
                lineHeight: 1.25,
                color: isDark ? "rgb(243 238 223 / 0.72)" : "#4b5f56",
                whiteSpace: "nowrap",
              }}
            >
              {tagline}
            </small>
          )}
        </span>
      )}
    </span>
  );
}
