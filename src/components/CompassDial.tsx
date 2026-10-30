import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { compassPoint, compassPointHint, formatCompass } from "../utils/classicNav";

// A digital compass for Classic: the needle swings to the typed bearing (the short way round,
// settling with a little overshoot like a real needle), and dragging the dial sets the bearing.
// `ghost` shows a second, faint bearing (the azimuth behind a back azimuth).

/** Keeps adding turns so a needle going from 350° to 10° moves 20°, not 340° backwards */
const useUnwrapped = (deg: number | null) => {
  const [angle, setAngle] = useState(deg ?? 0);
  const last = useRef(deg ?? 0);
  useEffect(() => {
    if (deg === null) return;
    const delta = ((((deg - last.current) % 360) + 540) % 360) - 180;
    last.current = deg;
    setAngle((a) => a + delta);
  }, [deg]);
  return angle;
};

const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);

export const CompassDial = ({
  value,
  ghost = null,
  onChange,
  label,
  disabled,
  size = 96,
}: {
  value: number | null;
  ghost?: number | null;
  onChange?: (deg: number) => void;
  label: string;
  disabled?: boolean;
  size?: number;
}) => {
  const angle = useUnwrapped(value);
  const ghostAngle = useUnwrapped(ghost);
  const [dragging, setDragging] = useState(false);
  const svg = useRef<SVGSVGElement>(null);

  const bearingAt = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!onChange || disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onChange(bearingAt(e));
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging && onChange) onChange(bearingAt(e));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!onChange || disabled) return;
    const step = e.shiftKey ? 10 : 1;
    const base = value ?? 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange((base + step) % 360);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange((base - step + 360) % 360);
    else return;
    e.preventDefault();
  };

  // Free swing while typing, a firm follow while dragging
  const swing = dragging ? "none" : "transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)";

  return (
    <div className={`flex flex-col items-center gap-1 shrink-0 ${disabled ? "opacity-40" : ""}`}>
      <svg
        ref={svg}
        width={size}
        height={size}
        viewBox="-50 -50 100 100"
        role={onChange ? "slider" : "img"}
        aria-label={label}
        aria-valuemin={onChange ? 0 : undefined}
        aria-valuemax={onChange ? 359 : undefined}
        aria-valuenow={onChange && value !== null ? Math.round(value) : undefined}
        aria-valuetext={value !== null ? `${formatCompass(value)} ${compassPoint(value)}` : "not set"}
        tabIndex={onChange && !disabled ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={onKeyDown}
        className={`select-none touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${onChange && !disabled ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <defs>
          <radialGradient id="compass-face" r="0.6">
            <stop offset="0" stopColor="#24301b" />
            <stop offset="1" stopColor="#10160b" />
          </radialGradient>
        </defs>
        <circle r="48" fill="url(#compass-face)" stroke="#d49b22" strokeWidth="1.5" />
        {TICKS.map((t) => (
          <line
            key={t}
            y1={-45}
            y2={t % 90 === 0 ? -37 : t % 30 === 0 ? -39.5 : t % 10 === 0 ? -41.5 : -43}
            stroke={t === 0 ? "#e5533d" : "#e9dcb8"}
            strokeOpacity={t % 10 === 0 ? 0.95 : 0.45}
            strokeWidth={t % 30 === 0 ? 1.4 : 0.7}
            transform={`rotate(${t})`}
          />
        ))}
        {(["N", "E", "S", "W"] as const).map((c, i) => (
          <text
            key={c}
            transform={`rotate(${i * 90}) translate(0 -27)`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9"
            fontWeight="800"
            fill={c === "N" ? "#e5533d" : "#f3ead2"}
          >
            {c}
          </text>
        ))}
        {[30, 60, 120, 150, 210, 240, 300, 330].map((d) => (
          <text key={d} transform={`rotate(${d}) translate(0 -29)`} textAnchor="middle" dominantBaseline="central" fontSize="5" fill="#b8ad8a">
            {d}
          </text>
        ))}

        {/* The other bearing, faint (azimuth behind a back azimuth) */}
        {ghost !== null && (
          <g style={{ transform: `rotate(${ghostAngle}deg)`, transition: swing }}>
            <line y1={0} y2={-34} stroke="#d49b22" strokeWidth="2" strokeDasharray="3 2" strokeLinecap="round" />
            <circle cy={-34} r="2.2" fill="#d49b22" />
          </g>
        )}

        {/* Needle: red to the bearing, light tail */}
        {value !== null && (
          <g style={{ transform: `rotate(${angle}deg)`, transition: swing }}>
            <path d="M0 -36 L4.5 0 L-4.5 0 Z" fill="#e5533d" />
            <path d="M0 22 L4.5 0 L-4.5 0 Z" fill="#e9dcb8" />
          </g>
        )}
        <circle r="3.4" fill="#d49b22" stroke="#10160b" strokeWidth="1" />
      </svg>
      {/* Digital readout */}
      <div className="min-w-[4.75rem] px-1.5 py-0.5 rounded-md bg-ink text-center font-mono text-[11px] font-bold leading-tight text-gold-300 tabular-nums">
        {value !== null ? (
          <>
            {formatCompass(value)}{" "}
            <abbr title={compassPointHint(compassPoint(value))} className="no-underline cursor-help text-[9px] text-sand-300">
              {compassPoint(value)}
            </abbr>
          </>
        ) : (
          <span className="text-sand-400">---°</span>
        )}
      </div>
    </div>
  );
};
