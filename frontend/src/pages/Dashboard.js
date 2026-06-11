import React, { useEffect, useState } from "react";
import SmartMatchSuggestions from "../components/SmartMatchSuggestions";
import { useNavigate } from "react-router-dom";
import { getMyTrips, getTrips } from "../utils/api";
import { useAuth } from "../utils/AuthContext";
import TripCard from "../components/TripCard";
import { SkeletonList } from "../components/UIComponents";

const QUICK_ACTIONS = [
  {
    label: "Share a Live Ride",
    sub: "Currently in a cab? Find co-travelers now",
    path: "/post-trip?type=live",
    color: "#ff6b35",
    icon: "🚗",
  },
  {
    label: "Need a Ride Partner",
    sub: "Find someone going your way",
    path: "/post-trip?type=need_partner",
    color: "#0084ff",
    icon: "🤝",
  },
  {
    label: "Schedule a Trip",
    sub: "Plan ahead with AI fare estimates",
    path: "/post-trip?type=scheduled",
    color: "#00c896",
    icon: "📅",
  },
  {
    label: "Smart Match",
    sub: "AI-scored route matching engine",
    path: "/trips?mode=match",
    color: "#8b5cf6",
    icon: "🧠",
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [myTrips, setMyTrips] = useState({ hosted: [], joined: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getTrips({ city: user?.city }), getMyTrips()])
      .then(([t, m]) => {
        setTrips(t.data.trips.slice(0, 4));
        setMyTrips(m.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const trust = user?.trustScore?.score || 82;
  const trustColor = trust >= 80 ? "var(--accent)" : trust >= 60 ? "var(--warning)" : "var(--error)";

  const stats = [
    { label: "Active Trips", value: trips.length, color: "#00c896" },
    { label: "My Posted", value: myTrips.hosted?.length || 0, color: "#0084ff" },
    { label: "Trips Joined", value: myTrips.joined?.length || 0, color: "#ff6b35" },
    { label: "Trust Score", value: trust, color: trustColor },
  ];

  return (
    <div className="page-wrap">
      {/* Welcome row */}
      <div className="welcome-row">
        <div>
          <h1 className="welcome-title">
            Hey, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-muted">Ready to coordinate your next shared ride?</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="city-badge">📍 {user?.city || "Kolkata"}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
            <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Trust score bar */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 32, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Your Trust Score</div>
          <div className="score-bar" style={{ height: 8 }}>
            <div className="score-bar-fill" style={{ width: `${trust}%`, background: `linear-gradient(90deg, var(--accent2), ${trustColor})` }} />
          </div>
        </div>
        <div style={{ fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 800, color: trustColor, flexShrink: 0 }}>
          {trust} <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 400 }}>/ 100</span>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="section-title">Quick Actions</h2>
      <div className="actions-grid" style={{ marginBottom: 32 }}>
        {QUICK_ACTIONS.map((a) => (
          <div
            key={a.label}
            className="action-card"
            style={{ borderLeft: `3px solid ${a.color}` }}
            onClick={() => navigate(a.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate(a.path)}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
            <div className="action-label">{a.label}</div>
            <div className="action-sub">{a.sub}</div>
            <span className="action-arrow" style={{ color: a.color }}>→</span>
          </div>
        ))}
      </div>

      {/* Smart Match Suggestions – auto-runs on last route + live socket */}
      <SmartMatchSuggestions />

      {/* Nearby trips */}
      <div className="section-hdr">
        <h2 className="section-title" style={{ marginBottom: 0 }}>Trips near {user?.city || "Kolkata"}</h2>
        <button className="btn btn-ghost" onClick={() => navigate("/trips")}>View all</button>
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : trips.length === 0 ? (
        <div className="empty-state">
          <div className="text-muted">No active trips in your city yet.</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/post-trip")}>
            Post the First Trip
          </button>
        </div>
      ) : (
        trips.map((t) => <TripCard key={t._id} trip={t} />)
      )}
    </div>
  );
}
