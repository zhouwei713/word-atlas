/**
 * A small landscape drawn from a poem's imagery (the `scene` string built by scripts/poetry/build_poetry.py).
 * The same poem always gets the same picture: layout is seeded from the poem id.
 */
type Time = "day" | "dusk" | "night";
type Season = "spring" | "summer" | "autumn" | "winter" | "none";

const W = 240;
const H = 120;

const SKY: Record<Time, [string, string]> = {
  day: ["#cfe3e0", "#f6ecd6"],
  dusk: ["#b98a97", "#f3c79a"],
  night: ["#171f3d", "#3a4784"],
};
const HILLS: Record<Time, [string, string, string]> = {
  day: ["#a9c0b6", "#82a196", "#5f8479"],
  dusk: ["#9a7a88", "#73607a", "#52425f"],
  night: ["#2c375f", "#222c4f", "#18203d"],
};
const WATER: Record<Time, string> = { day: "#a8c9cb", dusk: "#cf9f93", night: "#27345c" };
const FOLIAGE: Record<Season, string> = { spring: "#8db468", summer: "#5e9a5b", autumn: "#cc8a3d", winter: "#dfe8ee", none: "#6f9a6a" };
const INK: Record<Time, string> = { day: "#31403f", dusk: "#3d2f45", night: "#0d1226" };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth ridge line: returns its filled path and a lookup of its height at x. */
function ridge(rnd: () => number, base: number, amp: number) {
  const p = [rnd() * 6, rnd() * 6, rnd() * 6];
  const f = [0.018 + rnd() * 0.02, 0.05 + rnd() * 0.03, 0.12 + rnd() * 0.05];
  const y = (x: number) => base - amp * (0.55 * (0.5 + 0.5 * Math.sin(x * f[0] + p[0])) + 0.3 * Math.abs(Math.sin(x * f[1] + p[1])) + 0.15 * Math.sin(x * f[2] + p[2]) ** 2);
  const pts: [number, number][] = [];
  for (let x = 0; x <= W + 10; x += 10) pts.push([x, y(x)]);
  let d = `M0,${H} L${pts[0][0]},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1][0] + pts[i][0]) / 2;
    const my = (pts[i - 1][1] + pts[i][1]) / 2;
    d += ` Q${pts[i - 1][0]},${pts[i - 1][1].toFixed(1)} ${mx},${my.toFixed(1)}`;
  }
  return { d: `${d} L${W},${H} Z`, y };
}

export function PoemArt({ id, scene }: { id: string; scene: string }) {
  const [time, season, ...motifs] = scene.split(" ") as [Time, Season, ...string[]];
  const has = (m: string) => motifs.includes(m);
  const rnd = seeded(hash(id));
  const t: Time = SKY[time] ? time : "day";
  const s: Season = FOLIAGE[season] ? season : "none";
  const snowy = s === "winter" || has("snow");
  const water = has("water") || has("boat") || has("bridge");
  const mountainous = has("mountain") || !water;
  const horizon = water ? 78 : 88;
  const side = rnd() < 0.5 ? 0 : 1;
  const hills = HILLS[t];
  const ink = INK[t];
  const sx = (x: number) => (side ? W - x : x);

  const far = ridge(rnd, horizon - 6, mountainous ? 34 : 12);
  const mid = ridge(rnd, horizon + 4, mountainous ? 30 : 14);
  const gradId = `pa-${id}`;

  const sunX = 50 + rnd() * 140;
  const sunY = t === "dusk" ? horizon - 26 - rnd() * 8 : 24 + rnd() * 14;
  const stars = t === "night" ? Array.from({ length: has("star") ? 26 : 12 }, () => [rnd() * W, rnd() * 56, 0.5 + rnd() * 0.9] as const) : [];
  const clouds = has("cloud") || rnd() < 0.5 ? Array.from({ length: has("cloud") ? 3 : 1 }, () => [20 + rnd() * 200, 18 + rnd() * 28, 0.8 + rnd() * 0.7] as const) : [];
  const birds = has("bird") ? Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => [30 + rnd() * 170, 22 + rnd() * 30, 0.7 + rnd() * 0.5] as const) : [];
  const towerX = 40 + rnd() * 160;
  const boatX = 60 + rnd() * 120;
  const trunkColor = t === "night" ? "#10162c" : "#4a3a30";
  const bankFill = s === "winter" ? "#e6eef2" : t === "night" ? "#162040" : s === "autumn" ? "#8a8a4c" : "#6e9466";

  return (
    <svg className="poem-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SKY[t][0]} />
          <stop offset="1" stopColor={SKY[t][1]} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${gradId})`} />
      {stars.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#f5ecc8" opacity={0.85} />
      ))}
      {(has("moon") || t === "night") && (
        <g>
          <circle cx={sunX} cy={sunY} r={20} fill="#f5ecc8" opacity={0.18} />
          <circle cx={sunX} cy={sunY} r={9} fill="#f7efcf" />
        </g>
      )}
      {(has("sun") || t === "dusk") && t !== "night" && (
        <g>
          <circle cx={sunX} cy={sunY} r={t === "dusk" ? 17 : 13} fill={t === "dusk" ? "#f0a46a" : "#f6d98a"} opacity={0.3} />
          <circle cx={sunX} cy={sunY} r={t === "dusk" ? 10 : 8} fill={t === "dusk" ? "#ee8b55" : "#f4cc6a"} />
        </g>
      )}
      {clouds.map(([x, y, k], i) => (
        <g key={i} fill={t === "night" ? "#8d9ad0" : "#fff"} opacity={t === "night" ? 0.18 : 0.55} transform={`translate(${x} ${y}) scale(${k})`}>
          <ellipse cx="0" cy="0" rx="22" ry="5" />
          <ellipse cx="-9" cy="-4" rx="12" ry="5" />
          <ellipse cx="8" cy="-3" rx="14" ry="5.5" />
        </g>
      ))}
      <path d={far.d} fill={hills[0]} />
      {snowy && <path d={far.d} fill="#fff" opacity={0.28} />}
      <path d={mid.d} fill={hills[1]} />
      {snowy && <path d={mid.d} fill="#fff" opacity={0.32} />}
      {has("tower") && (
        <g transform={`translate(${towerX} ${mid.y(towerX) + 1})`} fill={ink} opacity={0.85}>
          <rect x="-2.5" y="-8" width="5" height="8" />
          <path d="M-6,-8 L0,-13 L6,-8 Z" />
          <rect x="-1.8" y="-14" width="3.6" height="3" />
          <path d="M-4.5,-14 L0,-18 L4.5,-14 Z" />
        </g>
      )}
      {has("smoke") && (
        <path d={`M${towerX + 22},${mid.y(towerX + 22)} q-4,-8 0,-14 q4,-6 0,-13`} fill="none" stroke={t === "night" ? "#8d9ad0" : "#fff"} strokeWidth="2.2" strokeLinecap="round" opacity="0.5" />
      )}
      {water ? (
        <g>
          <rect x="0" y={horizon + 2} width={W} height={H - horizon} fill={WATER[t]} />
          {Array.from({ length: 7 }, (_, i) => {
            const y = horizon + 8 + i * 6;
            const x = rnd() * 180;
            return <path key={i} d={`M${x},${y} h${14 + rnd() * 26}`} stroke={t === "night" ? "#5a6aa8" : "#fff"} strokeWidth="0.8" opacity={t === "night" ? 0.5 : 0.6} strokeLinecap="round" />;
          })}
          {(has("moon") || t === "night") && <path d={`M${sunX - 6},${horizon + 6} h12 M${sunX - 4},${horizon + 12} h8 M${sunX - 2},${horizon + 18} h4`} stroke="#f5ecc8" strokeWidth="1.4" opacity="0.7" strokeLinecap="round" />}
        </g>
      ) : (
        <path d={ridge(rnd, horizon + 10, 6).d} fill={snowy ? "#eef3f5" : hills[2]} />
      )}
      {has("bridge") && (
        <path d={`M${boatX - 34},${horizon + 12} q34,-26 68,0`} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      )}
      {has("boat") && (
        <g transform={`translate(${boatX} ${horizon + 20})`}>
          <path d="M-8,0 Q0,5 8,0 L6,-2.5 L-6,-2.5 Z" fill={ink} />
          <path d="M0,-2.5 V-12 L6,-4 Z" fill={t === "night" ? "#c9cfe8" : "#f4eddc"} opacity="0.9" />
          <path d="M-10,3 h20" stroke={t === "night" ? "#5a6aa8" : "#fff"} strokeWidth="0.8" opacity="0.6" />
        </g>
      )}
      {/* the foreground bank sits in one corner and carries the trees */}
      <g transform={side ? `translate(${W} 0) scale(-1 1)` : undefined}>
        <path d={`M0,${H} L0,${H - 24} Q40,${H - 34} 78,${H - 14} Q96,${H - 8} 104,${H} Z`} fill={bankFill} />
        {has("willow") && (
          <g stroke={FOLIAGE[s === "winter" ? "winter" : "spring"]} strokeWidth="1.3" fill="none" strokeLinecap="round">
            <path d={`M30,${H - 24} L30,${H - 58}`} stroke={trunkColor} strokeWidth="2.4" />
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} d={`M30,${H - 58 + (i % 3)} q${-16 + i * 4},${6 + (i % 3) * 3} ${-18 + i * 4.5},${22 + (i % 4) * 5}`} />
            ))}
          </g>
        )}
        {has("tree") && (
          <g>
            {[24, 46].map((x, i) => (
              <g key={x} transform={`translate(${x} ${H - 22 - i * 3}) scale(${1 - i * 0.2})`}>
                <rect x="-1.5" y="-6" width="3" height="10" fill={trunkColor} />
                <path d="M0,-44 L-11,-24 H-6 L-14,-10 H14 L6,-24 H11 Z" fill={s === "winter" ? "#cfdce2" : t === "night" ? "#1a3a3a" : "#4d7d5c"} />
              </g>
            ))}
          </g>
        )}
        {has("bamboo") && (
          <g stroke={t === "night" ? "#1c4a46" : "#5d9a6c"} strokeWidth="2" strokeLinecap="round">
            {[16, 24, 33, 41].map((x, i) => (
              <path key={x} d={`M${x},${H - 20} V${H - 62 + i * 6}`} />
            ))}
            {[16, 24, 33, 41].map((x, i) => (
              <path key={`l${x}`} d={`M${x},${H - 46 + i * 5} l8,-4 M${x},${H - 38 + i * 4} l-8,-4`} strokeWidth="1.4" />
            ))}
          </g>
        )}
        {has("blossom") && !has("willow") && (
          <g>
            <path d={`M0,${H - 66} Q26,${H - 76} 48,${H - 54}`} stroke={trunkColor} strokeWidth="2.2" fill="none" strokeLinecap="round" />
            {Array.from({ length: 16 }, (_, i) => (
              <circle key={i} cx={6 + i * 2.8 + rnd() * 4} cy={H - 66 + (i % 5) * 4 + rnd() * 6 - (i < 8 ? i : 16 - i) * 1.2} r={2 + rnd() * 1.6} fill={t === "night" ? "#d9b3c4" : "#f2a9b8"} opacity="0.92" />
            ))}
          </g>
        )}
        {!has("willow") && !has("tree") && !has("bamboo") && !has("blossom") && (
          <g stroke={s === "winter" ? "#b9c8d0" : FOLIAGE[s]} strokeWidth="1.4" strokeLinecap="round">
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} d={`M${10 + i * 8},${H - 14 - (i % 3) * 3} l${i % 2 ? 2 : -2},${-9 - (i % 4)}`} />
            ))}
          </g>
        )}
      </g>
      {birds.map(([x, y, k], i) => (
        <path key={i} d="M0,0 q3,-3 6,0 q3,-3 6,0" transform={`translate(${sx(x)} ${y}) scale(${k})`} fill="none" stroke={ink} strokeWidth="1.1" strokeLinecap="round" />
      ))}
      {has("rain") && (
        <g>
          <rect width={W} height={H} fill="#3a4a58" opacity="0.22" />
          <g stroke="#fff" strokeWidth="0.7" opacity="0.5">
            {Array.from({ length: 30 }, (_, i) => {
              const x = rnd() * W;
              const y = rnd() * H;
              return <path key={i} d={`M${x},${y} l-3,8`} />;
            })}
          </g>
        </g>
      )}
      {snowy && has("snow") && (
        <g fill="#fff" opacity="0.85">
          {Array.from({ length: 34 }, (_, i) => (
            <circle key={i} cx={rnd() * W} cy={rnd() * H} r={0.8 + rnd() * 1.1} />
          ))}
        </g>
      )}
    </svg>
  );
}
