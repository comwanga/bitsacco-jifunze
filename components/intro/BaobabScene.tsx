import { t, type Lang } from "@/lib/i18n";
import "./baobab.css";

/**
 * The Mbuyu (baobab) sunrise scene. Server-rendered SVG.
 * Without the `intro-play` class on <html> it shows the final frame: sun up, tree grown.
 * The inline intro script (lib/intro/shouldPlay.ts) adds the class on a first visit only.
 */
export function BaobabScene({ lang }: { lang: Lang }) {
  const branches = [
    { x: 531, href: `/${lang}/savers/`, label: t(lang, "branchSavers") },
    { x: 669, href: `/${lang}/builders/`, label: t(lang, "branchBuilders") },
  ];
  return (
    <svg
      className="mbuyu"
      viewBox="0 0 1200 400"
      preserveAspectRatio="xMidYMid slice"
      role="group" // not "img": an image's children are hidden, and the branch labels are links
      aria-label={t(lang, "sceneLabel")}
    >
      <defs>
        <linearGradient id="mb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2550" />
          <stop offset=".38" stopColor="#5a3767" />
          <stop offset=".62" stopColor="#c8603f" />
          <stop offset=".72" stopColor="#f3b866" />
        </linearGradient>
        <radialGradient id="mb-glow" cx=".43" cy=".7" r=".45">
          <stop offset="0" stopColor="#ffd89a" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffb060" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mb-sun">
          <stop offset="0" stopColor="#fff4cf" />
          <stop offset=".55" stopColor="#ffd27e" />
          <stop offset="1" stopColor="#ffb24e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mb-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a1d15" />
          <stop offset="1" stopColor="#170d09" />
        </linearGradient>
        <linearGradient id="mb-bark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b8603a" />
          <stop offset=".22" stopColor="#5a2e1f" />
          <stop offset="1" stopColor="#22110c" />
        </linearGradient>
        <filter id="mb-grain">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="9" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .7 -.3" />
        </filter>
        <clipPath id="mb-skyclip">
          <rect width="1200" height="281" />
        </clipPath>
      </defs>

      <rect width="1200" height="290" fill="url(#mb-sky)" />
      <rect className="mb-glow" width="1200" height="290" fill="url(#mb-glow)" />
      <g clipPath="url(#mb-skyclip)">
        <g className="mb-sun">
          <circle cx="519" cy="280" r="52" fill="url(#mb-sun)" />
          <circle cx="519" cy="280" r="20" fill="#fff1c4" />
        </g>
      </g>

      <g className="mb-birds" fill="none" stroke="#2a1730" strokeWidth="1.6" strokeLinecap="round">
        <path d="M760 130 q4.5 -4.5 9 0 q4.5 -4.5 9 0" />
        <path d="M782 120 q3.5 -3.5 7 0 q3.5 -3.5 7 0" />
      </g>

      <path
        d="M0 272 C120 260 260 270 400 264 C540 258 700 268 860 262 C1000 257 1100 266 1200 262 L1200 286 L0 286Z"
        fill="#5b2c3a"
        opacity=".65"
      />
      <g fill="#3a1b24" opacity=".9">
        {[
          [120, 277, 1.2],
          [260, 276, 0.8],
          [930, 276, 1],
          [1060, 277, 1.3],
        ].map(([x, y, s]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
            <path d="M-1 0 l1 -14 h1.6 l1 14z" />
            <ellipse cx="0.8" cy="-15" rx="16" ry="4" />
          </g>
        ))}
      </g>

      <path d="M0 280 Q600 268 1200 280 L1200 400 L0 400Z" fill="url(#mb-ground)" />
      <rect y="272" width="1200" height="128" filter="url(#mb-grain)" opacity=".45" />
      <ellipse cx="600" cy="283" rx="44" ry="5" fill="#000" opacity=".35" />

      <g transform="translate(600 281) scale(1.5) translate(-120 -252)">
        <circle className="mb-seed" cx="120" cy="250" r="3" fill="#f7c27a" />
        <path className="mb-trunk" d="M106 254 C101 232 103 208 109 186 L131 186 C137 208 139 232 134 254Z" fill="url(#mb-bark)" />
        <path className="mb-limb mb-limb-l" d="M112 189 C103 172 91 160 76 150 L80 145 C95 155 108 166 118 184Z" fill="#3b1e14" />
        <path className="mb-limb mb-limb-r" d="M128 189 C138 172 151 160 166 150 L162 145 C148 154 134 166 122 184Z" fill="#2c160f" />
        <path className="mb-limb mb-limb-m" d="M117 187 C116 172 118 160 121 148 L125 149 C123 160 123 173 124 187Z" fill="#331a11" />
        <g stroke="#2a150e" strokeWidth="1.4" fill="none" strokeLinecap="round">
          {[
            "M78 148 C72 142 70 138 66 134",
            "M79 147 C80 140 79 136 80 130",
            "M164 148 C170 142 172 138 176 134",
            "M163 147 C162 140 163 136 162 130",
            "M123 149 C120 142 118 138 116 134",
            "M123 149 C126 142 128 139 131 136",
          ].map((d) => (
            <path key={d} className="mb-twig" pathLength={1} d={d} />
          ))}
        </g>
        <g fill="#3d4a26">
          <ellipse className="mb-leaf" cx="70" cy="132" rx="10" ry="5" />
          <ellipse className="mb-leaf" cx="82" cy="128" rx="8" ry="4.5" />
          <ellipse className="mb-leaf" cx="172" cy="132" rx="10" ry="5" />
          <ellipse className="mb-leaf" cx="160" cy="128" rx="8" ry="4.5" />
          <ellipse className="mb-leaf" cx="122" cy="134" rx="11" ry="5" />
        </g>
      </g>

      <g stroke="#120806" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity=".9">
        <path d="M470 352 l-3 -12 M473 352 l1 -15 M476 352 l4 -11" />
        <path d="M720 372 l-3 -11 M723 372 l1 -14 M726 372 l4 -10" />
        <path d="M560 392 l-3 -12 M563 392 l1 -15 M566 392 l4 -11" />
      </g>

      {branches.map((b) => (
        <a key={b.href} href={b.href} className="mb-label">
          <rect x={b.x - 44} y={58} width={88} height={26} rx={13} fill="#170d09" fillOpacity=".55" />
          <text x={b.x} y={76} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fde6c2">
            {b.label}
          </text>
        </a>
      ))}
    </svg>
  );
}
