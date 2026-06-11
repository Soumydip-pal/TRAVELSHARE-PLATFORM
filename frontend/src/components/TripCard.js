import React from "react";
import { useNavigate } from "react-router-dom";

const TYPE_CONFIG = {
  live: { label: "Live Now", badgeClass: "badge-orange" },
  need_partner: { label: "Needs Partner", badgeClass: "badge-blue" },
  scheduled: { label: "Scheduled", badgeClass: "badge-green" },
};

export default function TripCard({ trip, matchScore, routeMatchScore, showJoin = true, actions = null }) {
  const navigate = useNavigate();
  const cfg = TYPE_CONFIG[trip.tripType] || TYPE_CONFIG.scheduled;
  const seatsLeft = trip.availableSeats;
  const fare = trip.actualFare || trip.predictedFare?.median;
  const acceptedCount = trip.passengers?.filter((p) => p.status === "accepted").length || 0;
  const riderCount = trip.fareSplit?.riders || acceptedCount + 1;
  const perPersonFare = trip.fareSplit?.perPerson || (fare ? Math.ceil(fare / riderCount) : 0);
  const visibleRouteMatch = routeMatchScore ?? matchScore;
  const trustScore = trip.host?.trustScore?.score ?? 82;

  const fmt = (d) => new Date(d).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="trip-card fade-in" onClick={() => navigate(`/trips/${trip._id}`)}>
      <div className="tc-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="avatar">{trip.host?.name?.[0]?.toUpperCase()}</div>
          <div>
            <div className="tc-host-name">{trip.host?.name}</div>
            <div className="tc-host-meta">
              <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 700 }}>Trust Score {trustScore}</span>
              <span style={{ color: "var(--text3)", marginLeft: 8, fontSize: 12 }}>{trip.host?.gender}</span>
            </div>
          </div>
        </div>
        <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>
      </div>

      <div className="divider" />

      <div className="tc-route">
        <div className="tc-rpt">
          <span className="tc-dot" style={{ background: "#00c896" }} />
          <span className="tc-rtext">{trip.origin?.address || `${trip.origin?.lat?.toFixed(4)}, ${trip.origin?.lng?.toFixed(4)}`}</span>
        </div>
        <div className="tc-rline" />
        <div className="tc-rpt">
          <span className="tc-dot" style={{ background: "#0084ff" }} />
          <span className="tc-rtext">{trip.destination?.address || `${trip.destination?.lat?.toFixed(4)}, ${trip.destination?.lng?.toFixed(4)}`}</span>
        </div>
      </div>

      <div className="divider" />

      <div className="tc-meta">
        <span className="chip">{fmt(trip.departureTime)}</span>
        <span className="chip">{seatsLeft} seat{seatsLeft !== 1 ? "s" : ""} left</span>
        {trip.city && <span className="chip">{trip.city}</span>}
        {trip.genderPreference !== "Any" && <span className="chip">{trip.genderPreference} only</span>}
        {trip.rideMood?.conversation && <span className="chip">{trip.rideMood.conversation === "quiet" ? "Quiet ride" : trip.rideMood.conversation === "friendly" ? "Friendly talk" : "Any mood"}</span>}
        {trip.rideMood?.ac && <span className="chip">AC {trip.rideMood.ac}</span>}
      </div>

      <div className="tc-footer">
        <div>
          {fare ? (
            <div className="fare-block">
              <span className="fare-lbl">{trip.actualFare ? "Total Fare" : "Estimated Total"}</span>
              <span className="fare-val">Rs {fare}</span>
              <span className="fare-lbl">Per Person: Rs {perPersonFare} ({riderCount} rider{riderCount !== 1 ? "s" : ""})</span>
            </div>
          ) : (
            <span style={{ color: "var(--text3)", fontSize: 13 }}>Fare TBD</span>
          )}
        </div>

        {visibleRouteMatch !== undefined && (
          <div className="match-blk">
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>Route Match: {Math.round(visibleRouteMatch * 100)}%</div>
            <div className="score-bar" style={{ width: 80 }}>
              <div className="score-bar-fill" style={{ width: `${visibleRouteMatch * 100}%` }} />
            </div>
          </div>
        )}

        {showJoin && (
          <button
            className="btn btn-primary btn-sm"
            onClick={(e) => { e.stopPropagation(); navigate(`/trips/${trip._id}`); }}
          >
            View
          </button>
        )}
        {actions && (
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
