import React from "react";
import { useQuery } from "@malloyyo/dashboard";

const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--dash-accent)", textDecoration: "none", fontWeight: 600 }}>
    {children}
  </a>
);

export default function Dashboard({ dashboard }) {
  const { rows } = useQuery({ query: "about" });
  const count = rows && rows[0] ? Number(rows[0].title_count) : null;

  const h3 = { fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--dash-muted)", margin: "28px 0 8px" };
  const p = { margin: "0 0 12px", lineHeight: 1.65 };
  const code = { fontFamily: "ui-monospace, Menlo, monospace", background: "var(--dash-control-bg)", border: "1px solid var(--dash-border)", borderRadius: 6, padding: "1px 6px", fontSize: "0.9em" };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: 24, color: "var(--dash-fg)" }}>
      <h1 style={{ marginBottom: 4 }}>{dashboard.title}</h1>
      <p style={{ ...p, color: "var(--dash-muted)" }}>
        Films from IMDb with more than 5,000 ratings &mdash; who made them, who appeared in them, and how they
        were rated.
      </p>

      <p style={p}>
        Created with <A href="https://github.com/malloydata/malloyyo">Malloyyo</A> by lloyd tabb. The source is on
        GitHub at <A href="https://github.com/lloydtabb/malloyyo-imdb">lloydtabb/malloyyo-imdb</A>.
      </p>

      <h3 style={h3}>How it works</h3>
      <p style={p}>
        The dataset{count != null && <> — <strong>{count.toLocaleString()}</strong> titles</>} comes from the{" "}
        <A href="https://developer.imdb.com/non-commercial-datasets/">IMDb non-commercial datasets</A>, cleaned and
        ranked into <span style={code}>titles</span>, <span style={code}>principals</span> and{" "}
        <span style={code}>names</span> Parquet files under <span style={code}>docs/</span>. Poster images are
        matched by IMDb id to <A href="https://www.themoviedb.org/">TMDB</A> artwork. A Malloy semantic model
        (<span style={code}>imdb.malloy</span>) defines the sources and the query behind each dashboard.
      </p>
      <p style={p}>
        Every query runs <strong>entirely in your browser</strong>: DuckDB-WASM queries the Parquet files directly,
        so there is no server and no database to run.
      </p>
      <p style={p}>
        The dashboards are compiled to a static site with <span style={code}>malloyyo dashboard bundle</span> and
        hosted on <A href="https://pages.github.com">GitHub Pages</A>. A weekly GitHub Actions job re-downloads the
        IMDb data and refreshes the Parquet files, so the numbers stay current with no manual rebuild.
      </p>

      <h3 style={h3}>The dashboards</h3>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
        <li><strong>Genre Combinations</strong> — pick a genre and see its strongest pairings, shelf by shelf.</li>
        <li><strong>People that worked together</strong> — everyone who's shared a credit with a given cast or crew member, and the films they made together.</li>
      </ul>
    </div>
  );
}
