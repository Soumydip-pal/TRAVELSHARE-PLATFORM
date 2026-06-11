import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../utils/api";
import { useAuth } from "../utils/AuthContext";

const FEATURES = [
  { icon: "🧠", text: "AI-powered route matching" },
  { icon: "🛡️", text: "Trust Score safety profiles" },
  { icon: "🔔", text: "Real-time notifications and ride updates" },
  { icon: "💸", text: "Smart fare split estimation" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!form.password) {
      setError("Enter your password.");
      return;
    }
    setLoading(true);
    try {
      const r = await loginUser({ ...form, email });
      login({ token: r.data.token, refreshToken: r.data.refreshToken }, r.data.user);
      navigate("/dashboard");
    } catch (e) {
      setError(e.response?.data?.error || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      {/* Left hero */}
      <div style={S.hero}>
        <div style={S.heroContent}>
          {/* Brand — same as Navbar */}
          <div style={S.brandRow}>
            <span style={S.brandMark}>TS</span>
            <span style={S.brandText}>TravelShare</span>
          </div>
          <p style={S.heroSub}>
            Connect with co-travelers, split costs,<br />and travel smarter together.
          </p>
          <div style={S.featureList}>
            {FEATURES.map((f) => (
              <div key={f.text} style={S.featureItem}>
                <span style={S.featureIcon}>{f.icon}</span>
                <span style={{ color: "var(--text)", fontSize: 14 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={S.glow} />
        <div style={S.glowTop} />
      </div>

      {/* Right form */}
      <div style={S.formPanel}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <h2 style={S.formTitle}>Welcome back</h2>
          <p style={S.formSub}>Sign in to coordinate your next shared ride.</p>

          <form onSubmit={handleSubmit} autoComplete="on">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group" style={{ position: "relative" }}>
              <label>Password</label>
              <input
                type={showPw ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={S.eyeBtn}
                tabIndex={-1}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>

            <div style={{ textAlign: "right", marginBottom: 16, marginTop: -8 }}>
              <Link to="/forgot-password" style={{ color: "var(--text2)", fontSize: 13 }}>
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="error-text" style={{ marginBottom: 14, padding: "8px 12px", background: "rgba(239,68,68,.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,.2)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              style={{ padding: 13, fontSize: 15 }}
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p style={{ textAlign: "center", color: "var(--text2)", fontSize: 14, marginTop: 22 }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { display: "flex", minHeight: "100vh" },
  hero: {
    flex: 1,
    background: "linear-gradient(135deg, #0a0f1e 0%, #0d1f3c 50%, #091428 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 48, position: "relative", overflow: "hidden",
  },
  heroContent: { position: "relative", zIndex: 2, maxWidth: 440 },
  brandRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 28 },
  brandMark: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 44, height: 44, borderRadius: 12,
    background: "linear-gradient(135deg,#0084ff,#00c896)",
    color: "#fff", fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800,
    flexShrink: 0,
  },
  brandText: {
    fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 800,
    background: "linear-gradient(90deg,#00c896,#0084ff)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  heroSub: { color: "var(--text2)", fontSize: 16, lineHeight: 1.7, marginBottom: 32 },
  featureList: { display: "flex", flexDirection: "column", gap: 14 },
  featureItem: { display: "flex", gap: 12, alignItems: "center" },
  featureIcon: { fontSize: 18, width: 28, flexShrink: 0 },
  glow: {
    position: "absolute", bottom: -180, right: -180, width: 480, height: 480,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,200,150,.1) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  glowTop: {
    position: "absolute", top: -120, left: -120, width: 360, height: 360,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,132,255,.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  formPanel: {
    width: 460, background: "var(--surface)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 40,
  },
  formTitle: {
    fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, marginBottom: 6,
  },
  formSub: { color: "var(--text2)", fontSize: 14, marginBottom: 28 },
  eyeBtn: {
    position: "absolute", right: 12, top: "50%", transform: "translateY(4px)",
    background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0,
  },
};
