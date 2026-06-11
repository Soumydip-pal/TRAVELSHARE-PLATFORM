import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../utils/api";
import { useAuth } from "../utils/AuthContext";

export default function Register() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", gender: "", city: "Kolkata" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const hc = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
      gender: form.gender,
      city: form.city,
    };
    if (payload.name.length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!/^[+()\-\s\d]{8,16}$/.test(payload.phone)) {
      setError("Enter a valid phone number.");
      return;
    }
    if (payload.password.length < 8 || !/[A-Za-z]/.test(payload.password) || !/\d/.test(payload.password)) {
      setError("Use at least 8 characters with letters and numbers.");
      return;
    }
    setLoading(true);
    try { const r = await registerUser(payload); login({ token: r.data.token, refreshToken: r.data.refreshToken }, r.data.user); navigate("/dashboard"); }
    catch (e) { setError(e.response?.data?.error || e.response?.data?.errors?.[0]?.msg || "Registration failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0a0f1e,#0d1f3c)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "var(--surface)", borderRadius: "var(--radius)", padding: 36, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>🚗</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, background: "linear-gradient(90deg,#00c896,#0084ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>TravelShare</span>
          </Link>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700 }}>Create your account</h2>
          <p className="text-muted text-sm">Create your secure TravelShare profile</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Full Name</label><input name="name" placeholder="Your full name" value={form.name} onChange={hc} autoComplete="name" required /></div>
          <div className="form-row">
            <div className="form-group"><label>Email</label><input type="email" name="email" placeholder="you@example.com" value={form.email} onChange={hc} autoComplete="email" required /></div>
            <div className="form-group"><label>Phone</label><input name="phone" placeholder="+91 9XXXXXXXXX" value={form.phone} onChange={hc} autoComplete="tel" required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Gender</label>
              <select name="gender" value={form.gender} onChange={hc} required>
                <option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group"><label>City</label>
              <select name="city" value={form.city} onChange={hc}>
                {["Kolkata","Delhi","Mumbai","Bengaluru"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label>Password</label><input type="password" name="password" placeholder="8+ characters with letters and numbers" value={form.password} onChange={hc} autoComplete="new-password" required minLength={8} /></div>
          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          <button type="submit" className="btn btn-primary w-full" style={{ padding: 13, fontSize: 15 }} disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
          <p style={{ textAlign: "center", color: "var(--text2)", fontSize: 14, marginTop: 16 }}>
            Already have an account? <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Sign in</Link>
          </p>
          <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 12, marginTop: 14 }}>
            Developed by Soumyadip Pal, Rohit Paul, Saptarshi Ghosh and Jitendrio Saha
          </p>
        </form>
      </div>
    </div>
  );
}
