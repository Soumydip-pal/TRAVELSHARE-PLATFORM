import React, { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../utils/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim().toLowerCase());
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || "Reset request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h2 style={S.title}>Reset password</h2>
        <p className="text-muted text-sm" style={{ marginBottom: 22 }}>Enter your account email to receive a reset link.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          {message && <div className="success-banner">{message}</div>}
          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary w-full" style={{ padding: 13 }} disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
        </form>
        <p style={S.footer}><Link to="/login" style={S.link}>Back to sign in</Link></p>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0a0f1e,#0d1f3c)", padding: 20 },
  card: { width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 34, boxShadow: "var(--shadow)" },
  title: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, marginBottom: 6 },
  footer: { textAlign: "center", color: "var(--text2)", fontSize: 14, marginTop: 18 },
  link: { color: "var(--accent)", fontWeight: 700 },
};
