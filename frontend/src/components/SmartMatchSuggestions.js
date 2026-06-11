/**
 * SmartMatchSuggestions.js
 *
 * Two exported pieces:
 *  1. <SmartMatchSuggestions /> — Dashboard widget that auto-runs a match
 *     search using the user's last known route (stored in localStorage) and
 *     shows a compact list of the best results.
 *
 *  2. <LiveMatchWatcher city onNewTrip /> — Invisible component that joins
 *     the socket room `match_watch_<city>` and calls onNewTrip whenever a
 *     new trip is broadcast that might be a match.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { findMatches } from "../utils/api";
import { useSocket } from "../utils/SocketContext";
import { useAuth } from "../utils/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LAST_ROUTE_KEY = "ts_last_match_route";

export function saveLastRoute(route) {
  try {
    localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify(route));
  } catch {}
}

export function loadLastRoute() {
  try {
    return JSON.parse(localStorage.getItem(LAST_ROUTE_KEY));
  } catch {
    return null;
  }
}

// ─── LiveMatchWatcher ─────────────────────────────────────────────────────────
// Invisible component. Joins socket room and calls onNewTrip on new events.

export function LiveMatchWatcher({ city, onNewTrip }) {
  const { socket, connected } = useSocket();
  const cityRef = useRef(city);

  useEffect(() => {
    cityRef.current = city;
  }, [city]);

  useEffect(() => {
    if (!socket || !connected || !city) return;

    socket.emit("join_match_watch", { city });

    const handler = (data) => {
      if (onNewTrip) onNewTrip(data);
    };

    socket.on("match_suggestion", handler);

    return () => {
      socket.off("match_suggestion", handler);
      socket.emit("leave_match_watch", { city });
    };
  }, [socket, connected, city, onNewTrip]);

  return null;
}

// ─── ScorePill ────────────────────────────────────────────────────────────────

function ScorePill({ score }) {
  const pct = Math.round(score * 100);
  const bg =
    pct >= 75
      ? "rgba(0,200,150,.15)"
      : pct >= 50
      ? "rgba(0,132,255,.15)"
      : "rgba(255,107,53,.15)";
  const color =
    pct >= 75 ? "var(--accent)" : pct >= 50 ? "var(--accent2)" : "var(--warning)";
  return (
    <span
      style={{
        background: bg,
        color,
        fontWeight: 700,
        fontSize: 12,
        borderRadius: 20,
        padding: "2px 10px",
        flexShrink: 0,
      }}
    >
      {pct}% match
    </span>
  );
}

// ─── SuggestionRow ────────────────────────────────────────────────────────────

function SuggestionRow({ m, onDismiss }) {
  const navigate = useNavigate();
  const trip = m.trip;
  const fmt = (d) =>
    new Date(d).toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
      }}
      onClick={() => navigate(`/trips/${trip._id}`)}
    >
      {/* Avatar */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {trip.host?.name?.[0]?.toUpperCase() || "?"}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text1)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {trip.origin?.address?.split(",")[0] || "Origin"} →{" "}
          {trip.destination?.address?.split(",")[0] || "Destination"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
          {fmt(trip.departureTime)} · {trip.availableSeats} seat
          {trip.availableSeats !== 1 ? "s" : ""} · Trust{" "}
          {trip.host?.trustScore?.score ?? "—"}
        </div>
        {m.pickupSuggestion?.note && (
          <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
            📍 {m.pickupSuggestion.note}
          </div>
        )}
      </div>

      <ScorePill score={m.finalScore} />

      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(trip._id);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text3)",
            fontSize: 16,
            padding: "0 4px",
            flexShrink: 0,
          }}
          title="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── LiveBadge ────────────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "rgba(0,200,150,.12)",
        color: "var(--accent)",
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 20,
        padding: "2px 8px",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--accent)",
          display: "inline-block",
          animation: "pulse 1.5s infinite",
        }}
      />
      LIVE
    </span>
  );
}

// ─── SmartMatchSuggestions (main export) ──────────────────────────────────────

export default function SmartMatchSuggestions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [liveAlert, setLiveAlert] = useState(null); // { trip }
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(true);
  const autoFetched = useRef(false);
  const alertTimer = useRef(null);

  const city = user?.city || "Kolkata";
  const lastRoute = loadLastRoute();

  // ── Auto-fetch on mount if we have a last route ──────────────────────────
  useEffect(() => {
    if (autoFetched.current || !lastRoute?.origin?.lat || !lastRoute?.destination?.lat) return;
    autoFetched.current = true;
    setLoading(true);

    const departureTime =
      lastRoute.departureTime || new Date(Date.now() + 30 * 60 * 1000).toISOString();

    findMatches({
      origin: lastRoute.origin,
      destination: lastRoute.destination,
      routeLine: lastRoute.routeLine,
      departureTime,
      genderPreference: user?.gender || "Any",
      city,
    })
      .then((res) => {
        setSuggestions(res.data.matches?.slice(0, 5) || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lastRoute, city, user]);

  // ── Live socket callback ─────────────────────────────────────────────────
  const handleNewTrip = useCallback(
    (data) => {
      if (!lastRoute?.origin?.lat) return;

      // Show a brief "new compatible ride" banner
      if (alertTimer.current) clearTimeout(alertTimer.current);
      setLiveAlert(data.trip);
      alertTimer.current = setTimeout(() => setLiveAlert(null), 7000);

      // Refresh suggestions quietly
      const departureTime =
        lastRoute.departureTime || new Date(Date.now() + 30 * 60 * 1000).toISOString();

      findMatches({
        origin: lastRoute.origin,
        destination: lastRoute.destination,
        routeLine: lastRoute.routeLine,
        departureTime,
        genderPreference: user?.gender || "Any",
        city,
      })
        .then((res) => {
          setSuggestions(res.data.matches?.slice(0, 5) || []);
        })
        .catch(() => {});
    },
    [lastRoute, city, user]
  );

  const handleDismiss = (tripId) => {
    setDismissed((prev) => new Set(prev).add(tripId));
  };

  const visibleSuggestions = suggestions.filter((m) => !dismissed.has(m.trip._id));

  // Don't render if no last route and nothing to show
  if (!lastRoute?.origin?.lat && !loading) return null;

  return (
    <>
      {/* Live socket watcher (invisible) */}
      <LiveMatchWatcher city={city} onNewTrip={handleNewTrip} />

      {/* Live alert banner */}
      {liveAlert && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(0,200,150,.12), rgba(0,132,255,.08))",
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius)",
            padding: "10px 16px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
            animation: "fadeIn .3s ease",
          }}
          onClick={() => navigate(`/trips/${liveAlert._id}`)}
        >
          <span style={{ fontSize: 18 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
              New ride just posted near your route!
            </div>
            <div style={{ fontSize: 11, color: "var(--text2)" }}>
              {liveAlert.origin?.address?.split(",")[0] || "Origin"} →{" "}
              {liveAlert.destination?.address?.split(",")[0] || "Destination"}
            </div>
          </div>
          <LiveBadge />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLiveAlert(null);
            }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Suggestions panel */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          marginBottom: 28,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: expanded ? "1px solid var(--border)" : "none",
            cursor: "pointer",
          }}
          onClick={() => setExpanded((v) => !v)}
        >
          <span style={{ fontSize: 18 }}>🧠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text1)" }}>
              Smart Match Suggestions
            </div>
            <div style={{ fontSize: 11, color: "var(--text2)" }}>
              Based on your last searched route
            </div>
          </div>
          {!loading && visibleSuggestions.length > 0 && (
            <span
              style={{
                background: "var(--accent)",
                color: "#fff",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
              }}
            >
              {visibleSuggestions.length}
            </span>
          )}
          <LiveBadge />
          <span style={{ color: "var(--text3)", fontSize: 16, marginLeft: 4 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>

        {expanded && (
          <div style={{ padding: "0 16px" }}>
            {loading ? (
              <div
                style={{
                  padding: "20px 0",
                  textAlign: "center",
                  color: "var(--text2)",
                  fontSize: 13,
                }}
              >
                <span style={{ marginRight: 8 }}>⚡</span>Running match algorithm…
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <div
                style={{
                  padding: "20px 0",
                  textAlign: "center",
                  color: "var(--text2)",
                  fontSize: 13,
                }}
              >
                No compatible rides right now.{" "}
                <span
                  style={{ color: "var(--accent)", cursor: "pointer" }}
                  onClick={() => navigate("/trips?mode=match")}
                >
                  Try the full matcher →
                </span>
              </div>
            ) : (
              <>
                {visibleSuggestions.map((m) => (
                  <SuggestionRow key={m.trip._id} m={m} onDismiss={handleDismiss} />
                ))}
                <div
                  style={{
                    padding: "12px 0",
                    textAlign: "center",
                  }}
                >
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => navigate("/trips?mode=match")}
                  >
                    Open Smart Match →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
