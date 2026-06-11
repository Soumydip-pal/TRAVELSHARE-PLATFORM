import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getTrips, findMatches } from "../utils/api";
import { LiveMatchWatcher, saveLastRoute } from "../components/SmartMatchSuggestions";
import { useAuth } from "../utils/AuthContext";
import TripCard from "../components/TripCard";
import RouteMapPicker from "../components/RouteMapPicker";
import { SkeletonList } from "../components/UIComponents";
import { useToast } from "../utils/ToastContext";
import { useSocket } from "../utils/SocketContext";

function useDebouncedValue(value, delayMs) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return dv;
}

function ScoreBar({ value, color = "var(--accent)" }) {
  return (
    <div style={{ background: "var(--border)", borderRadius: 3, height: 5, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${Math.round(value * 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width .4s" }} />
    </div>
  );
}

function MatchCard({ m }) {
  const pct = Math.round(m.finalScore * 100);
  const color = pct >= 75 ? "var(--accent)" : pct >= 50 ? "var(--accent2)" : "var(--warning)";
  return (
    <div style={MS.wrapper}>
      {/* Score header */}
      <div style={MS.header}>
        <div style={MS.scoreBig}>
          <span style={{ color, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800 }}>{pct}%</span>
          <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 6 }}>match</span>
        </div>
        <div style={MS.scoreBreakdown}>
          {[
            { label: "Route",   val: m.overlapScore,     color: "var(--accent)" },
            { label: "Time",    val: m.timeScore,         color: "var(--accent2)" },
            { label: "Pickup",  val: m.pickupScore,       color: "var(--warning)" },
          ].map((s) => (
            <div key={s.label} style={MS.scoreRow}>
              <span style={{ fontSize: 11, color: "var(--text2)", width: 40 }}>{s.label}</span>
              <ScoreBar value={s.val} color={s.color} />
              <span style={{ fontSize: 11, color: "var(--text2)", width: 30, textAlign: "right" }}>{Math.round(s.val * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Smart pickup suggestion */}
      {m.pickupSuggestion && (
        <div style={MS.pickup}>
          <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>📍 Smart Pickup</span>
          <span style={{ fontSize: 11, color: "var(--text2)", marginLeft: 8 }}>
            {m.pickupSuggestion.note || `~${m.pickupSuggestion.distanceFromA}m from your location`}
          </span>
        </div>
      )}

      {/* Proximity chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "8px 14px" }}>
        {m.pickupDistanceM !== undefined && (
          <span className="chip" style={{ fontSize: 11 }}>🚶 {m.pickupDistanceM < 1000 ? `${m.pickupDistanceM}m` : `${(m.pickupDistanceM/1000).toFixed(1)}km`} pickup</span>
        )}
        {m.timeDiffMin !== undefined && (
          <span className="chip" style={{ fontSize: 11 }}>⏱ {m.timeDiffMin} min apart</span>
        )}
        {m.destinationDistanceM !== undefined && (
          <span className="chip" style={{ fontSize: 11 }}>🏁 {m.destinationDistanceM < 1000 ? `${m.destinationDistanceM}m` : `${(m.destinationDistanceM/1000).toFixed(1)}km`} drop</span>
        )}
      </div>

      <TripCard trip={m.trip} matchScore={m.finalScore} routeMatchScore={m.overlapScore} />
    </div>
  );
}

const MS = {
  wrapper: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: 16, overflow: "hidden" },
  header: { display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 14px 0", borderBottom: "1px solid var(--border)", paddingBottom: 12 },
  scoreBig: { display: "flex", alignItems: "baseline", flexShrink: 0 },
  scoreBreakdown: { flex: 1, display: "flex", flexDirection: "column", gap: 6 },
  scoreRow: { display: "flex", alignItems: "center", gap: 8 },
  pickup: { background: "rgba(0,200,150,.06)", borderBottom: "1px solid var(--border)", padding: "7px 14px", display: "flex", alignItems: "center" },
};

export default function BrowseTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [matches, setMatches] = useState([]);
  const [clusterInfo, setClusterInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [mode, setMode] = useState(() => new URLSearchParams(location.search).get("mode") === "match" ? "match" : "browse");
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [filters, setFilters] = useState({ city: user?.city || "Kolkata", tripType: "", gender: "" });
  const debouncedFilters = useDebouncedValue(filters, 350);
  const [matchRoute, setMatchRoute] = useState({ origin: {}, destination: {} });
  const [matchForm, setMatchForm] = useState({ departureTime: "", genderPreference: "Any" });
  const toast = useToast();
  const { socket, connected } = useSocket() || {};
  const [liveNewTrip, setLiveNewTrip] = useState(null);
  const liveTimer = React.useRef(null);

  const loadTrips = useCallback(() => {
    setLoading(true);
    const p = {};
    if (debouncedFilters.city)     p.city     = debouncedFilters.city;
    if (debouncedFilters.tripType) p.tripType = debouncedFilters.tripType;
    if (debouncedFilters.gender)   p.gender   = debouncedFilters.gender;
    return getTrips(p)
      .then((r) => setTrips(r.data.trips))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [debouncedFilters]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (!socket || !connected || !filters.city) return undefined;
    socket.emit("join_city", filters.city);
    const refresh = () => loadTrips();
    socket.on("trip_created", refresh);
    socket.on("trip_updated", refresh);
    socket.on("trip_deleted", refresh);
    socket.on("ride_update", refresh);
    return () => {
      socket.off("trip_created", refresh);
      socket.off("trip_updated", refresh);
      socket.off("trip_deleted", refresh);
      socket.off("ride_update", refresh);
    };
  }, [socket, connected, filters.city, loadTrips]);

  const handleMatch = async (e) => {
    e.preventDefault();
    setMatchError("");
    if (!matchRoute.origin?.lat || !matchRoute.destination?.lat) {
      setMatchError("Choose both origin and destination on the map.");
      return;
    }
    setMatchLoading(true);
    try {
      const res = await findMatches({
        origin: matchRoute.origin,
        destination: matchRoute.destination,
        routeLine: matchRoute.routeLine,
        departureTime: matchForm.departureTime,
        genderPreference: matchForm.genderPreference,
        city: filters.city,
      });
      setMatches(res.data.matches);
      // Persist route so Dashboard auto-suggests next time
      saveLastRoute({
        origin: matchRoute.origin,
        destination: matchRoute.destination,
        routeLine: matchRoute.routeLine,
        departureTime: matchForm.departureTime,
      });
      setClusterInfo(res.data.clusterSummary || []);
      const count = res.data.matches.length;
      toast?.show(
        count > 0
          ? `${count} compatible ride${count !== 1 ? "s" : ""} found`
          : "No matches found — try broadening your route",
        count > 0 ? "success" : "warning"
      );
    } catch {
      setMatchError("Could not run matching right now. Please try again.");
    } finally {
      setMatchLoading(false);
    }
  };

  const mfc = (e) => setMatchForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleNewTrip = React.useCallback((data) => {
    if (mode !== "match") return;
    if (liveTimer.current) clearTimeout(liveTimer.current);
    setLiveNewTrip(data.trip);
    liveTimer.current = setTimeout(() => setLiveNewTrip(null), 8000);
  }, [mode]);

  return (
    <div className="page-wrap">
      <h2 className="page-title">Browse Trips</h2>
      <p className="page-sub">Find available rides or run AI-powered route matching</p>

      {/* Live watcher – joins socket room when in match mode */}
      {mode === "match" && (
        <LiveMatchWatcher city={filters.city} onNewTrip={handleNewTrip} />
      )}

      {/* Live alert – a new trip just posted near user's route */}
      {liveNewTrip && mode === "match" && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(0,200,150,.1), rgba(0,132,255,.07))",
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius)",
            padding: "10px 16px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
          }}
          onClick={() => {
            setLiveNewTrip(null);
            // Re-run match to refresh results
            if (matchRoute.origin?.lat) handleMatch({ preventDefault: () => {} });
          }}
        >
          <span style={{ fontSize: 20 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
              New ride posted — tap to refresh matches!
            </div>
            <div style={{ fontSize: 11, color: "var(--text2)" }}>
              {liveNewTrip.origin?.address?.split(",")[0] || "Origin"} →{" "}
              {liveNewTrip.destination?.address?.split(",")[0] || "Destination"} ·{" "}
              {liveNewTrip.availableSeats} seat{liveNewTrip.availableSeats !== 1 ? "s" : ""} available
            </div>
          </div>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(0,200,150,.15)", color: "var(--accent)",
              fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            LIVE
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setLiveNewTrip(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18 }}
          >×</button>
        </div>
      )}

      <div className="mode-tabs" style={{ marginTop: 4 }}>
        <button className={`mode-tab ${mode === "browse" ? "active" : ""}`} onClick={() => setMode("browse")}>
          Browse All
        </button>
        <button className={`mode-tab ${mode === "match" ? "active" : ""}`} onClick={() => setMode("match")}>
          Smart Match
        </button>
      </div>

      {/* ── Browse Mode ── */}
      {mode === "browse" && (
        <>
          <div className="filters-bar">
            <select className="filter-sel" value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}>
              {["Kolkata", "Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select className="filter-sel" value={filters.tripType} onChange={(e) => setFilters((f) => ({ ...f, tripType: e.target.value }))}>
              <option value="">All Types</option>
              <option value="live">Live Now</option>
              <option value="need_partner">Needs Partner</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <select className="filter-sel" value={filters.gender} onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">Any Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 14 }}>
            {loading ? "Loading…" : `${trips.length} trip${trips.length !== 1 ? "s" : ""} in ${filters.city}`}
          </div>
          {loading ? (
            <SkeletonList count={4} />
          ) : trips.length === 0 ? (
            <div className="empty-state">
              <p className="text-muted">No trips found. Try different filters or be the first to post.</p>
            </div>
          ) : (
            trips.map((t) => <TripCard key={t._id} trip={t} />)
          )}
        </>
      )}

      {/* ── Smart Match Mode ── */}
      {mode === "match" && (
        <>
          <div className="match-form-box">
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
              AI Route Matching
            </h3>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
              Enter your route — the engine scores overlap, time proximity, pickup distance, and ride mood compatibility.
            </p>
            <form onSubmit={handleMatch}>
              <RouteMapPicker city={filters.city} value={matchRoute} onChange={setMatchRoute} compact />
              <div className="form-row" style={{ marginTop: 16 }}>
                <div className="form-group">
                  <label>Departure Time</label>
                  <input type="datetime-local" name="departureTime" value={matchForm.departureTime} onChange={mfc} required />
                </div>
                <div className="form-group">
                  <label>My Gender</label>
                  <select name="genderPreference" value={matchForm.genderPreference} onChange={mfc}>
                    <option value="Any">Any</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              {matchError && (
                <div className="error-text" style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,.08)", borderRadius: 8 }}>
                  {matchError}
                </div>
              )}
              <button type="submit" className="btn btn-primary w-full" style={{ padding: 13 }} disabled={matchLoading}>
                {matchLoading ? "Running matching algorithm…" : "Find Best Matches"}
              </button>
            </form>
          </div>

          {/* Cluster summary */}
          {clusterInfo.length > 0 && (
            <div style={{ background: "rgba(0,132,255,.06)", border: "1px solid rgba(0,132,255,.2)", borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent2)", marginBottom: 6 }}>
                🧩 {clusterInfo.length} Passenger Cluster{clusterInfo.length !== 1 ? "s" : ""} Near Your Route
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>
                {clusterInfo.map((c, i) => (
                  <span key={i} style={{ marginRight: 12 }}>
                    Cluster {i + 1}: {c.count} rider{c.count !== 1 ? "s" : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {matches.length > 0 ? (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
                {matches.length} Ride Match{matches.length !== 1 ? "es" : ""} Found
              </div>
              {matches.map((m) => (
                <MatchCard key={m.trip._id} m={m} />
              ))}
            </>
          ) : !matchLoading && (
            <div className="empty-state" style={{ marginTop: 20 }}>
              <p className="text-muted text-sm">Fill in your route above to find AI-matched rides.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
