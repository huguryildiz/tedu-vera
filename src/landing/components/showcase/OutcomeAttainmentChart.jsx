import { useTheme } from "@/shared/theme/ThemeProvider";

const OUTCOMES = [
  { id: "1.1", value: 92 },
  { id: "1.2", value: 92 },
  { id: "2",   value: 92 },
  { id: "3.1", value: 92 },
  { id: "3.2", value: 92 },
  { id: "4",   value: 92 },
  { id: "5",   value: 91 },
  { id: "6.1", value: 74 },
  { id: "6.2", value: 73 },
  { id: "7.1", value: 91 },
  { id: "7.2", value: 91 },
  { id: "8.1", value: 91 },
  { id: "8.2", value: 91 },
  { id: "9.1", value: 73 },
  { id: "9.2", value: 74 },
  { id: "10.1", value: 74 },
  { id: "10.2", value: 73 },
  { id: "11",   value: 91 },
];

const THRESHOLD = 70;
const W = 800;
const H = 440;
const PAD_TOP = 30;
const PAD_RIGHT = 14;
const PAD_BOTTOM = 50;
const PAD_LEFT = 38;
const INNER_W = W - PAD_LEFT - PAD_RIGHT;
const INNER_H = H - PAD_TOP - PAD_BOTTOM;
const SLOT = INNER_W / OUTCOMES.length;
const BAR_W = Math.max(8, Math.min(28, SLOT * 0.6));
const GRID_VALUES = [25, 50, 75, 100];

const yFor = (v) => PAD_TOP + (1 - v / 100) * INNER_H;
const xFor = (i) => PAD_LEFT + i * SLOT + (SLOT - BAR_W) / 2;
const gradFor = (v) =>
  v >= 85 ? "url(#ps-bar-met)" : v >= THRESHOLD ? "url(#ps-bar-warn)" : "url(#ps-bar-bad)";

export default function OutcomeAttainmentChart() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const grid = isDark ? "rgba(148,163,184,0.14)" : "rgba(15,23,42,0.08)";
  const baseline = isDark ? "rgba(148,163,184,0.32)" : "rgba(15,23,42,0.22)";
  const axisText = isDark ? "rgba(168,184,202,0.72)" : "rgba(75,86,117,0.85)";
  const valueText = isDark ? "rgba(241,245,249,0.95)" : "rgba(17,24,39,0.95)";
  const threshStroke = isDark ? "rgba(167,139,250,0.72)" : "rgba(124,58,237,0.78)";
  const threshLabel = isDark ? "rgba(196,181,253,0.92)" : "rgba(124,58,237,0.92)";
  const monoStack =
    "ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace";

  return (
    <div className="ps-screenshot-window ps-chart-window">
      <div className="ps-screenshot-chrome">
        <span className="ps-screenshot-dot" />
        <span className="ps-screenshot-dot" />
        <span className="ps-screenshot-dot" />
      </div>
      <div className="ps-chart-header">
        <div className="ps-chart-title-block">
          <div className="ps-chart-eyebrow">Programme Outcome Attainment</div>
          <div className="ps-chart-sub">Spring 2026 · Threshold {THRESHOLD}%</div>
        </div>
        <div className="ps-chart-legend">
          <span className="ps-chart-legend-item">
            <i style={{ background: "#22c55e" }} /> Met
          </span>
          <span className="ps-chart-legend-item">
            <i style={{ background: "#f59e0b" }} /> Above threshold
          </span>
          <span className="ps-chart-legend-item">
            <i style={{ background: "#ef4444" }} /> Below
          </span>
        </div>
      </div>
      <div className="ps-chart-body">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Programme outcome attainment percentages"
        >
          <defs>
            <linearGradient id="ps-bar-met" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="ps-bar-warn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="ps-bar-bad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {GRID_VALUES.map((g) => (
            <g key={g}>
              <line
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={yFor(g)}
                y2={yFor(g)}
                stroke={grid}
                strokeWidth="1"
              />
              <text
                x={PAD_LEFT - 8}
                y={yFor(g) + 4}
                textAnchor="end"
                fontSize="11"
                fill={axisText}
                fontFamily={monoStack}
              >
                {g}%
              </text>
            </g>
          ))}

          <line
            x1={PAD_LEFT}
            x2={W - PAD_RIGHT}
            y1={yFor(0)}
            y2={yFor(0)}
            stroke={baseline}
            strokeWidth="1.25"
          />

          <line
            x1={PAD_LEFT}
            x2={W - PAD_RIGHT}
            y1={yFor(THRESHOLD)}
            y2={yFor(THRESHOLD)}
            stroke={threshStroke}
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text
            x={W - PAD_RIGHT - 4}
            y={yFor(THRESHOLD) - 5}
            textAnchor="end"
            fontSize="10"
            fontWeight="600"
            fill={threshLabel}
            fontFamily={monoStack}
          >
            Threshold {THRESHOLD}%
          </text>

          {OUTCOMES.map((o, i) => {
            const x = xFor(i);
            const y = yFor(o.value);
            const h = INNER_H * (o.value / 100);
            return (
              <g key={o.id}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={h}
                  rx="3"
                  fill={gradFor(o.value)}
                />
                <text
                  x={x + BAR_W / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={valueText}
                  fontFamily={monoStack}
                >
                  {o.value}
                </text>
                <text
                  x={x + BAR_W / 2}
                  y={H - PAD_BOTTOM + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill={axisText}
                  fontFamily={monoStack}
                >
                  PO {o.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
