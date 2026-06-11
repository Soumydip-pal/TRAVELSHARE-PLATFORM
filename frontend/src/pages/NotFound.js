import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 72 }}>🛣️</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 800 }}>404</h1>
      <p style={{ color: "var(--text2)", fontSize: 18 }}>This road doesn't lead anywhere.</p>
      <button className="btn btn-primary" style={{ padding: "12px 28px" }} onClick={() => navigate("/")}>
        Go Home →
      </button>
    </div>
  );
}
