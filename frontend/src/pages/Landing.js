import React from "react";
import { useNavigate } from "react-router-dom";

const FEATURES = [
  { color: "#ff6b35", title: "Live Ride Sharing", desc: "Post an active ride and split the fare with someone on the same route." },
  { color: "#0084ff", title: "Smart Route Matching", desc: "Find nearby trips with route overlap, time proximity, and seat availability." },
  { color: "#00c896", title: "AI Fare Estimate", desc: "Get practical shared-fare estimates before creating a scheduled trip." },
  { color: "#f59e0b", title: "Trust Score", desc: "Profiles use completion, cancellation, complaints, on-time behavior, and safety signals." },
  { color: "#8b5cf6", title: "Safety First", desc: "Verified profiles, trust scores, and gender preferences for every ride." },
  { color: "#ec4899", title: "Real-time Updates", desc: "Receive notifications, join requests, ride updates, and chat messages instantly." },
];

const STEPS = [
  ["01", "Create profile"],
  ["02", "Post or browse trip"],
  ["03", "Match and coordinate"],
  ["04", "Share the ride safely"],
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <button style={styles.brand} onClick={() => navigate("/")}>
            <span style={styles.brandMark}>TS</span>
            <span style={styles.brandText}>TravelShare</span>
          </button>
          <div style={styles.navLinks}>
            <a href="#features" style={styles.navLink}>Features</a>
            <a href="#how" style={styles.navLink}>How it works</a>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ padding: "8px 18px" }} onClick={() => navigate("/login")}>Sign In</button>
            <button className="btn btn-primary" style={{ padding: "8px 18px" }} onClick={() => navigate("/register")}>Get Started</button>
          </div>
        </div>
      </nav>

      <section style={styles.hero}>
        <div style={styles.heroGlow1} />
        <div style={styles.heroGlow2} />
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>AI-powered ride coordination</div>
          <h1 style={styles.heroTitle}>
            Travel Together,<br />
            <span style={styles.heroTitleAccent}>Save Together</span>
          </h1>
          <p style={styles.heroSub}>
            Coordinate shared rides with route matching, Trust Score profiles, emergency comfort mode,
            real-time alerts, and ML fare estimates.
          </p>
          <div style={styles.heroCTAs}>
            <button className="btn btn-primary" style={styles.heroBtn} onClick={() => navigate("/register")}>Start Sharing Trips</button>
            <button className="btn btn-secondary" style={styles.heroBtn} onClick={() => navigate("/login")}>Sign In</button>
          </div>
          <div style={styles.statsStrip}>
            {[
              ["20K+", "Training Records"],
              ["4", "Cities"],
              ["AI", "Matching"],
              ["Rs 0", "Platform Fee"],
            ].map(([value, label]) => (
              <div key={label}>
                <div style={styles.statValue}>{value}</div>
                <div style={styles.statLabel}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.heroVisual}>
          <div style={styles.mockupCard}>
            <div style={styles.mockupTop}>Scheduled Trip</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>S</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Soumyadip Pal</div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>Trust Score 92</div>
              </div>
              <span className="badge badge-green" style={{ marginLeft: "auto" }}>Open</span>
            </div>
            <div className="tc-route">
              <div className="tc-rpt"><span className="tc-dot" style={{ background: "#00c896" }} /><span className="tc-rtext">Salt Lake, Kolkata</span></div>
              <div className="tc-rline" />
              <div className="tc-rpt"><span className="tc-dot" style={{ background: "#0084ff" }} /><span className="tc-rtext">Park Street, Kolkata</span></div>
            </div>
            <div className="divider" />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div><div style={styles.miniLabel}>Shared Fare</div><div style={styles.miniValue}>Rs 92</div></div>
              <div><div style={styles.miniLabel}>AI Match</div><div style={{ ...styles.miniValue, color: "#0084ff" }}>87%</div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" style={styles.section}>
        <div style={styles.sectionInner}>
          <h2 style={styles.sectionTitle}>Features</h2>
          <p style={styles.sectionSub}>Clean, focused tools for ride coordination.</p>
          <div style={styles.featureGrid}>
            {FEATURES.map((feature) => (
              <div key={feature.title} style={{ ...styles.featureCard, borderTop: `3px solid ${feature.color}` }}>
                <h3 style={styles.featureTitle}>{feature.title}</h3>
                <p style={styles.featureDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" style={{ ...styles.section, background: "var(--surface)" }}>
        <div style={styles.sectionInner}>
          <h2 style={styles.sectionTitle}>How It Works</h2>
          <div style={styles.stepsGrid}>
            {STEPS.map(([num, title]) => (
              <div key={num} style={styles.stepCard}>
                <div style={styles.stepNum}>{num}</div>
                <div style={styles.stepTitle}>{title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.ctaSection}>
        <h2 style={styles.ctaTitle}>Ready to share your first trip?</h2>
        <p style={styles.ctaSub}>Find a compatible route, coordinate safely, and split costs transparently.</p>
        <button className="btn btn-primary" style={{ padding: "14px 34px", fontSize: 16 }} onClick={() => navigate("/register")}>Get Started</button>
      </section>

      <footer style={styles.footer}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>TravelShare</div>
        <div style={{ color: "var(--text3)", fontSize: 13 }}>Developed by Soumyadip Pal, Rohit Paul, Saptarshi Ghosh and Jitendrio Saha</div>
      </footer>
    </div>
  );
}

const styles = {
  page: { background: "var(--bg)", minHeight: "100vh" },
  nav: { position: "sticky", top: 0, zIndex: 100, background: "rgba(10,15,30,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" },
  navInner: { maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
  brand: { display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0 },
  brandMark: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#0084ff,#00c896)", color: "#fff", fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 800 },
  brandText: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, background: "linear-gradient(90deg,#00c896,#0084ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  navLinks: { display: "flex", gap: 6 },
  navLink: { padding: "6px 14px", borderRadius: 8, fontSize: 14, color: "var(--text2)", textDecoration: "none" },
  hero: { position: "relative", overflow: "hidden", minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center", padding: "56px 24px", maxWidth: 1100, margin: "0 auto", gap: 56 },
  heroGlow1: { position: "absolute", top: -200, left: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,150,0.10) 0%, transparent 70%)", pointerEvents: "none" },
  heroGlow2: { position: "absolute", bottom: -200, right: -200, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,132,255,0.10) 0%, transparent 70%)", pointerEvents: "none" },
  heroContent: { flex: 1, position: "relative", zIndex: 2 },
  heroBadge: { display: "inline-block", background: "rgba(0,200,150,0.12)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "var(--accent)", marginBottom: 20, fontWeight: 600 },
  heroTitle: { fontFamily: "var(--font-display)", fontSize: 52, fontWeight: 800, lineHeight: 1.1, marginBottom: 18 },
  heroTitleAccent: { background: "linear-gradient(90deg,#00c896,#0084ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  heroSub: { fontSize: 17, color: "var(--text2)", lineHeight: 1.7, marginBottom: 32, maxWidth: 540 },
  heroCTAs: { display: "flex", gap: 14, marginBottom: 42, flexWrap: "wrap" },
  heroBtn: { padding: "14px 32px", fontSize: 16, borderRadius: 10 },
  statsStrip: { display: "flex", gap: 30, borderTop: "1px solid var(--border)", paddingTop: 24, flexWrap: "wrap" },
  statValue: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "var(--accent)" },
  statLabel: { fontSize: 12, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" },
  heroVisual: { width: 320, flexShrink: 0, position: "relative", zIndex: 2 },
  mockupCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" },
  mockupTop: { fontSize: 12, color: "var(--text3)", marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" },
  miniLabel: { fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" },
  miniValue: { fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--accent)" },
  section: { padding: "70px 24px" },
  sectionInner: { maxWidth: 1100, margin: "0 auto" },
  sectionTitle: { fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 800, textAlign: "center", marginBottom: 10 },
  sectionSub: { color: "var(--text2)", textAlign: "center", fontSize: 16, margin: "0 auto 36px" },
  featureGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 },
  featureCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 22 },
  featureTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, marginBottom: 8 },
  featureDesc: { fontSize: 13, color: "var(--text2)", lineHeight: 1.6 },
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 },
  stepCard: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 22, textAlign: "center" },
  stepNum: { fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, color: "var(--accent)", marginBottom: 8 },
  stepTitle: { fontFamily: "var(--font-display)", fontWeight: 700 },
  ctaSection: { padding: "82px 24px", textAlign: "center" },
  ctaTitle: { fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 800, marginBottom: 12 },
  ctaSub: { color: "var(--text2)", fontSize: 16, marginBottom: 28 },
  footer: { background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "26px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 8 },
};
