// @ts-nocheck
// Top actresses by decade — the ten actresses whose films drew the most IMDb
// votes, for each decade from the 1920s on.
//
// One query returns every decade, so the decade strip switches views without a
// round trip. The chosen decade lives in the URL (~decade) so a view can be
// shared. Below the leaderboard, every decade's top ten sits in a compact grid;
// hovering a name there (or in the leaderboard) lights that actress up in every
// decade she made the list, which shows careers that span decades at a glance.
//
// The viz "kit" (theme tokens, num/compact) is copied across dashboards on
// purpose: jsx components are sandboxed (only React + @malloyyo/dashboard
// import), so there is no shared local module to import.
import React from "react";
import { useQuery, useUrlState } from "@malloyyo/dashboard";

/* ============================ shared viz kit ============================ */
const INK = {
  light: { surface: "#fcfcfb", track: "#eceff3", muted: "#898781", text: "#0b0b0b", text2: "#52514e", accent: "#2a78d6", hi: "#fff4d6" },
  dark: { surface: "#1a1a19", track: "#26262b", muted: "#898781", text: "#ffffff", text2: "#c3c2b7", accent: "#4f9bff", hi: "#3a3220" },
};

function relLum(c) {
  if (!c) return null;
  c = c.trim();
  let r, g, b, m;
  if ((m = c.match(/^#([0-9a-f]{3})$/i))) { const h = m[1]; r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16); }
  else if ((m = c.match(/^#([0-9a-f]{6})$/i))) { const h = m[1]; r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
  else if ((m = c.match(/rgba?\(([^)]+)\)/i))) { const p = m[1].split(",").map((x) => parseFloat(x)); [r, g, b] = p; }
  else return null;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function useTheme() {
  const [dark, setDark] = React.useState(false);
  React.useLayoutEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.body || document.documentElement);
      const lum = relLum(cs.getPropertyValue("--dash-fg"));
      setDark(lum != null ? lum > 0.5 : window.matchMedia("(prefers-color-scheme: dark)").matches);
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    return () => { mq.removeEventListener("change", read); obs.disconnect(); };
  }, []);
  return { dark, ink: dark ? INK.dark : INK.light };
}

// Query numerics arrive as STRINGS — always coerce before formatting or maths.
const num = (x) => (x == null || x === "" ? 0 : +x);
const compact = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n);
/* ========================== end shared viz kit ========================= */

const label = (d) => `${d}s`;
const eyebrow = (ink) => ({ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: ink.muted, fontWeight: 700 });

/* -------------------------------- decade strip ------------------------- */
// One button per decade; bar height is the decade's total actress-film votes,
// so the strip doubles as a picture of how IMDb voting skews recent.
function DecadeStrip({ ink, decades, current, onPick }) {
  const max = decades.reduce((m, d) => Math.max(m, d.total_votes), 0);
  return (
    <div style={{ margin: "0 0 26px" }}>
      <div style={{ ...eyebrow(ink), marginBottom: 8 }}>Decade</div>
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
        {decades.map((d) => {
          const on = d.decade === current;
          const h = max > 0 ? Math.max((d.total_votes / max) * 44, 3) : 3;
          return (
            <button
              key={d.decade}
              type="button"
              onClick={() => onPick(d.decade)}
              aria-pressed={on}
              title={`${label(d.decade)} · ${compact(d.total_votes)} votes across ${d.title_count.toLocaleString()} films`}
              style={{
                flex: "1 1 0", minWidth: 0, font: "inherit", cursor: "pointer",
                padding: "6px 2px 5px", borderRadius: 8,
                border: `1px solid ${on ? ink.accent : "var(--dash-border)"}`,
                background: on ? ink.accent : ink.surface,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 5,
              }}
            >
              <div style={{ height: 44, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{
                  width: "56%", height: h, borderRadius: "3px 3px 0 0",
                  background: on ? "rgba(255,255,255,.75)" : ink.track,
                  transition: "height .18s ease",
                }} />
              </div>
              <div style={{
                fontSize: 12, fontWeight: on ? 700 : 560, color: on ? "#fff" : ink.text2,
                fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
              }}>
                {label(d.decade)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- leaderboard -------------------------- */
function Thumb({ ink, film }) {
  const [bad, setBad] = React.useState(false);
  const box = { width: 30, height: 45, borderRadius: 4, background: ink.track, flex: "none", display: "block" };
  if (!film?.movie_thumb || bad) return <div style={box} aria-hidden="true" />;
  return (
    <img
      src={film.movie_thumb}
      alt=""
      width={30}
      height={45}
      loading="lazy"
      onError={() => setBad(true)}
      style={{ ...box, objectFit: "cover" }}
    />
  );
}

function Leaderboard({ ink, decade, hover, setHover }) {
  const max = decade.actresses.reduce((m, a) => Math.max(m, a.total_votes), 0);
  return (
    <section style={{ margin: "0 0 36px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 680, margin: 0, color: ink.text, letterSpacing: "-.01em" }}>
          The {label(decade.decade)}
        </h2>
        <span style={{ fontSize: 12.5, color: ink.muted, fontVariantNumeric: "tabular-nums" }}>
          {decade.title_count.toLocaleString()} films with a credited actress · {compact(decade.total_votes)} votes
        </span>
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {decade.actresses.map((a, i) => {
          const film = a.top_film;
          const lit = hover === a.nconst;
          return (
            <li
              key={a.nconst}
              onMouseEnter={() => setHover(a.nconst)}
              onMouseLeave={() => setHover(null)}
              style={{
                display: "grid",
                gridTemplateColumns: "26px minmax(140px, 190px) minmax(120px, 1fr) minmax(170px, 250px)",
                alignItems: "center", gap: 14,
                padding: "7px 8px", borderRadius: 8,
                background: lit ? ink.hi : "transparent",
                transition: "background .1s ease",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: i < 3 ? ink.accent : ink.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {i + 1}
              </div>

              <div style={{ minWidth: 0 }}>
                <a
                  href={a.name_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 14, fontWeight: 620, color: ink.text, textDecoration: "none", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {a.name}
                </a>
                <div style={{ fontSize: 11.5, color: ink.muted, fontVariantNumeric: "tabular-nums" }}>
                  {a.title_count} {a.title_count === 1 ? "film" : "films"} · avg {a.average_rating.toFixed(1)}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div style={{ flex: "1 1 auto", height: 14, background: ink.track, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    width: `${max > 0 ? (a.total_votes / max) * 100 : 0}%`, height: "100%",
                    background: ink.accent, borderRadius: 3, transition: "width .25s ease",
                  }} />
                </div>
                <div style={{ width: 44, flex: "none", fontSize: 12.5, fontWeight: 620, color: ink.text2, fontVariantNumeric: "tabular-nums" }}>
                  {compact(a.total_votes)}
                </div>
              </div>

              {film ? (
                <a
                  href={film.movie_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Most-voted film this decade: ${film.title} (${film.release_year})`}
                  style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, textDecoration: "none", color: "inherit" }}
                >
                  <Thumb ink={ink} film={film} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 560, color: ink.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {film.title}
                    </div>
                    <div style={{ fontSize: 11, color: ink.muted, fontVariantNumeric: "tabular-nums" }}>
                      {film.release_year} · {compact(film.total_votes)}
                    </div>
                  </div>
                </a>
              ) : <div />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ----------------------------- every decade grid ----------------------- */
function DecadeGrid({ ink, decades, current, onPick, hover, setHover, spans }) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <div style={eyebrow(ink)}>Every decade</div>
        <span style={{ fontSize: 11.5, color: ink.muted }}>
          hover a name to trace her across decades · click a card to open it
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {decades.map((d) => {
          const on = d.decade === current;
          return (
            <div
              key={d.decade}
              role="button"
              tabIndex={0}
              onClick={() => onPick(d.decade)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(d.decade); } }}
              style={{
                cursor: "pointer", padding: "10px 12px", borderRadius: 10,
                border: `1px solid ${on ? ink.accent : "var(--dash-border)"}`,
                background: ink.surface,
                boxShadow: on ? `inset 0 0 0 1px ${ink.accent}` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: on ? ink.accent : ink.text }}>{label(d.decade)}</span>
                <span style={{ fontSize: 11, color: ink.muted, fontVariantNumeric: "tabular-nums" }}>{compact(d.total_votes)}</span>
              </div>
              <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {d.actresses.map((a, i) => {
                  const lit = hover === a.nconst;
                  const multi = (spans.get(a.nconst) || 0) > 1;
                  return (
                    <li
                      key={a.nconst}
                      onMouseEnter={() => setHover(a.nconst)}
                      onMouseLeave={() => setHover(null)}
                      style={{
                        display: "flex", gap: 6, fontSize: 12, lineHeight: "19px",
                        padding: "0 4px", margin: "0 -4px", borderRadius: 4,
                        background: lit ? ink.hi : "transparent",
                        color: lit ? ink.text : ink.text2,
                        fontWeight: lit ? 650 : multi ? 560 : 450,
                      }}
                    >
                      <span style={{ width: 16, flex: "none", textAlign: "right", color: ink.muted, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                      {multi && (
                        <span title={`In the top ten for ${spans.get(a.nconst)} decades`} style={{ marginLeft: "auto", flex: "none", fontSize: 10, color: ink.muted, fontVariantNumeric: "tabular-nums" }}>
                          ×{spans.get(a.nconst)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------- dashboard ---------------------------- */
export default function Dashboard({ dashboard, givens }) {
  const { ink } = useTheme();
  const q = useQuery({ query: "actresses_by_decade", givens });
  const [pick, setPick] = useUrlState("decade", 0);
  const [hover, setHover] = React.useState(null);

  // Nested queries come back with the nest as a real JS array on each row.
  const decades = React.useMemo(
    () => (q.rows || []).map((r) => ({
      decade: num(r.decade),
      title_count: num(r.title_count),
      total_votes: num(r.total_votes),
      actresses: (r.actresses || []).map((a) => {
        const f = (a.top_film || [])[0];
        return {
          name: a.name,
          nconst: a.nconst,
          name_url: a.name_url,
          total_votes: num(a.total_votes),
          title_count: num(a.title_count),
          average_rating: num(a.average_rating),
          top_film: f ? {
            title: f.title,
            release_year: num(f.release_year),
            movie_thumb: f.movie_thumb || null,
            movie_url: f.movie_url,
            total_votes: num(f.total_votes),
          } : null,
        };
      }),
    })).filter((d) => d.decade > 0 && d.actresses.length),
    [q.rows]
  );

  // How many decades each actress makes the top ten — marks long careers.
  const spans = React.useMemo(() => {
    const m = new Map();
    for (const d of decades) for (const a of d.actresses) m.set(a.nconst, (m.get(a.nconst) || 0) + 1);
    return m;
  }, [decades]);

  // Default to the most recent COMPLETE decade: the current one is still
  // accumulating votes and would undersell itself.
  const fallback = React.useMemo(() => {
    const full = decades.filter((d) => d.decade + 10 <= new Date().getFullYear());
    return (full.length ? full : decades).at(-1)?.decade ?? 0;
  }, [decades]);
  const current = decades.some((d) => d.decade === pick) ? pick : fallback;
  const decade = decades.find((d) => d.decade === current);

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "22px 24px 48px", color: "var(--dash-fg)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 680, letterSpacing: "-.02em", margin: "0 0 3px" }}>
        {dashboard.title}
      </h1>
      <p style={{ color: ink.muted, fontSize: 13.5, lineHeight: 1.45, margin: "0 0 20px", maxWidth: 760 }}>
        The ten actresses whose films drew the most IMDb votes in each decade. Votes are summed across every film
        she's credited on as <em>actress</em> that decade; the right column shows her most-voted one.
      </p>

      {q.error ? (
        <div style={{ color: "var(--dash-danger)", fontSize: 13 }}>{String(q.error)}</div>
      ) : q.loading && !decades.length ? (
        <div style={{ color: ink.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Loading&hellip;</div>
      ) : !decade ? (
        <div style={{ color: ink.muted, fontSize: 13.5, padding: "40px 0", textAlign: "center" }}>No results.</div>
      ) : (
        <>
          <DecadeStrip ink={ink} decades={decades} current={current} onPick={setPick} />
          <Leaderboard ink={ink} decade={decade} hover={hover} setHover={setHover} />
          <DecadeGrid
            ink={ink}
            decades={decades}
            current={current}
            onPick={(d) => { setPick(d); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            hover={hover}
            setHover={setHover}
            spans={spans}
          />
        </>
      )}
    </div>
  );
}
