import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createTrip } from "../utils/api";
import { useAuth } from "../utils/AuthContext";
import RouteMapPicker from "../components/RouteMapPicker";

const TYPES = [
  { id: "live", label: "I'm riding now", desc: "Already in a cab and ready to split the ride" },
  { id: "need_partner", label: "Need a ride partner", desc: "Find someone going the same way" },
  { id: "scheduled", label: "Schedule a future trip", desc: "Plan ahead and match with compatible riders" },
];

export default function PostTrip() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [tripType, setTripType] = useState(params.get("type") || "live");
  const [route, setRoute] = useState({ origin: {}, destination: {} });
  const [form, setForm] = useState({
    departureTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    totalSeats: "3",
    genderPreference: "Any",
    city: user?.city || "Kolkata",
    actualFare: "",
    conversation: user?.rideMood?.conversation || "any",
    music: user?.rideMood?.music || "any",
    ac: user?.rideMood?.ac || "any",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hc = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!route.origin?.lat || !route.destination?.lat) {
      setError("Choose both origin and destination on the map.");
      return;
    }

    if (tripType !== "scheduled" && !form.actualFare) {
      setError("Enter the total fare for this ride.");
      return;
    }

    setLoading(true);
    try {
      const res = await createTrip({
        tripType,
        origin: route.origin,
        destination: route.destination,
        routeLine: route.routeLine,
        departureTime: form.departureTime,
        totalSeats: parseInt(form.totalSeats, 10),
        genderPreference: form.genderPreference,
        rideMood: {
          conversation: form.conversation,
          music: form.music,
          ac: form.ac,
          safeDriving: true,
        },
        city: form.city,
        actualFare: tripType === "scheduled" ? undefined : parseFloat(form.actualFare),
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
      });
      navigate(`/trips/${res.data.trip._id}`);
    } catch (e2) {
      setError(e2.response?.data?.error || "Failed to create trip");
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "24px 20px" }}>
        <div className="post-container">
          <h3 className="page-title" style={{ fontSize: 22, marginBottom: 4 }}>Post a Trip</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Choose your travel situation</p>
          <div className="type-grid">
            {TYPES.map((t, index) => (
              <div key={t.id} className={`type-card ${tripType === t.id ? "selected" : ""}`} onClick={() => setTripType(t.id)}>
                <span className={`badge ${index === 0 ? "badge-orange" : index === 1 ? "badge-blue" : "badge-green"}`}>
                  {index === 0 ? "Now" : index === 1 ? "Partner" : "Plan"}
                </span>
                <div className="type-label">{t.label}</div>
                <div className="type-desc">{t.desc}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary w-full" style={{ padding: 13 }} onClick={() => setStep(2)}>Continue</button>
        </div>
      </div>
    );
  }

  const cfg = TYPES.find((t) => t.id === tripType);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
      <div className="post-container" style={{ maxWidth: 720 }}>
        <button
          type="button"
          style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", marginBottom: 16, fontSize: 14 }}
          onClick={() => setStep(1)}
        >
          Back
        </button>
        <div className="type-indicator">{cfg.label}</div>

        <form onSubmit={handleSubmit}>
          <div className="section-label">Route</div>
          <RouteMapPicker city={form.city} value={route} onChange={setRoute} />

          <div className="section-label">Trip Details</div>
          <div className="form-row">
            <div className="form-group">
              <label>Departure Time</label>
              <input type="datetime-local" name="departureTime" value={form.departureTime} onChange={hc} required />
            </div>
            <div className="form-group">
              <label>City</label>
              <select name="city" value={form.city} onChange={hc}>
                {["Kolkata", "Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ride Mood</label>
              <select name="conversation" value={form.conversation} onChange={hc}>
                <option value="any">Any mood</option>
                <option value="quiet">Quiet ride</option>
                <option value="friendly">Friendly talk</option>
              </select>
            </div>
            <div className="form-group">
              <label>Music</label>
              <select name="music" value={form.music} onChange={hc}>
                <option value="any">Any music</option>
                <option value="low">Low music</option>
                <option value="none">No music</option>
              </select>
            </div>
          </div>
          <div className="form-group">
              <label>Comfort</label>
              <select name="ac" value={form.ac} onChange={hc}>
                <option value="any">Any AC setting</option>
                <option value="on">AC on</option>
                <option value="off">AC off</option>
              </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Total Seats</label>
              <select name="totalSeats" value={form.totalSeats} onChange={hc}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} seat{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Gender Preference</label>
              <select name="genderPreference" value={form.genderPreference} onChange={hc}>
                <option value="Any">Any</option>
                <option value="Male">Male only</option>
                <option value="Female">Female only</option>
              </select>
            </div>
          </div>

          {tripType !== "scheduled" && (
            <div className="form-group">
              <label>Total Ride Fare</label>
              <input type="number" name="actualFare" placeholder="e.g. 250" value={form.actualFare} onChange={hc} min="1" required />
            </div>
          )}

          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          <button type="submit" className="btn btn-primary w-full" style={{ padding: 13, fontSize: 15, marginTop: 8 }} disabled={loading}>
            {loading ? "Posting trip..." : "Post Trip"}
          </button>
        </form>
      </div>
    </div>
  );
}
