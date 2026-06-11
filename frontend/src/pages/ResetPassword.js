import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resetPassword } from "../utils/api";
import { useAuth } from "../utils/AuthContext";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      login({ token: res.data.token, refreshToken: res.data.refreshToken }, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h2 style={S.title}>Create new password</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </div>
          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary w-full" style={{ padding: 13 }} disabled={loading}>{loading ? "Updating..." : "Update Password"}</button>
        </form>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0a0f1e,#0d1f3c)", padding: 20 },
  card: { width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 34, boxShadow: "var(--shadow)" },
  title: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, marginBottom: 18 },
};
