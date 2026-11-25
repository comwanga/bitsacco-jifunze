import type { Lang } from "@/lib/i18n";
import { siteCopy } from "@/lib/site-copy";
import "./savings-circle.css";

const C = 100; // centre of the 200 × 200 view box
const R = 80; // track radius

/** A point on the track, measured clockwise from the top. */
function at(deg: number): string {
  const rad = ((deg - 90) * Math.PI) / 180;
  return `${(C + R * Math.cos(rad)).toFixed(2)} ${(C + R * Math.sin(rad)).toFixed(2)}`;
}

/** One quarter of the track with a small gap on each side. */
function segment(i: number): string {
  const start = i * 90 + 6;
  const end = (i + 1) * 90 - 6;
  return `M ${at(start)} A ${R} ${R} 0 0 1 ${at(end)}`;
}

/**
 * The savings cycle: Learn → Check the group → Save together → Teach your chama.
 * CSS-only motion (savings-circle.css): one lap in 4.8 s, each step lit in turn, then rest on step 4.
 * The steps are a real list, so the content does not depend on the drawing or on JavaScript.
 */
export function SavingsCircle({ lang }: { lang: Lang }) {
  const c = siteCopy[lang];
  const steps = [c.circleLearn, c.circleCheck, c.circleSave, c.circleTeach];
  return (
    <div data-circle className="savings-circle grid grid-cols-[7.5rem_1fr] items-center gap-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <svg viewBox="0 0 200 200" aria-hidden="true" className="h-auto w-full">
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="14" />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={segment(i)} className={`circle-seg circle-seg-${i + 1}`} fill="none" strokeWidth="14" strokeLinecap="round" />
        ))}
        <circle cx={C} cy={C} r="46" fill="#008080" />
        <text x={C} y={C + 5} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">
          {c.circleCentre}
        </text>
        <g className="circle-orbit">
          <circle cx={C} cy={C - R} r="9" fill="#ff5800" stroke="#fff" strokeWidth="3" />
        </g>
      </svg>
      <ol data-circle-steps className="list-inside list-decimal space-y-1 text-[0.8125rem] font-semibold marker:opacity-80 sm:space-y-1.5 sm:text-base">
        {steps.map((label, i) => (
          <li key={label} data-step={i + 1} className={`circle-step circle-step-${i + 1} rounded-lg px-2.5 py-1 sm:px-3 sm:py-1.5`}>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
