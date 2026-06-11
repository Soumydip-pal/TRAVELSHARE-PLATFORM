import React, { useCallback, useEffect, useState } from "react";
import { deleteTrip, getMyTrips, managePassenger, updateTrip } from "../utils/api";
import TripCard from "../components/TripCard";
import { SkeletonList } from "../components/UIComponents";
import { useSocket } from "../utils/SocketContext";
import { useToast } from "../utils/ToastContext";

function TripEditor({ trip, onCancel, onSaved }) {
  const [form, setForm] = useState({
    departureTime: new Date(trip.departureTime).toISOString().slice(0, 16),
    city: trip.city || "Kolkata",
    totalSeats: String(trip.totalSeats || trip.availableSeats || 1),
    genderPreference: trip.genderPreference || "Any",
    actualFare: trip.actualFare || "",
    visibility: trip.visibility || "public",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hc = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await updateTrip(trip._id, {
        departureTime: form.departureTime,
        city: form.city,
        totalSeats: Number(form.totalSeats),
        genderPreference: form.genderPreference,
        actualFare: form.actualFare ? Number(form.actualFare) : undefined,
        visibility: form.visibility,
      });
      onSaved(res.data.trip);
    } catch (err) {
      setError(err.response?.data?.error || "Trip could not be updated");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card fade-in" style={{ marginBottom: 16 }} onSubmit={save}>
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
          <label>Passenger Seats</label>
          <select name="totalSeats" value={form.totalSeats} onChange={hc}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
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
      <div className="form-row">
        <div className="form-group">
          <label>Total Fare</label>
          <input type="number" name="actualFare" value={form.actualFare} onChange={hc} min="1" placeholder="Total fare" />
        </div>
        <div className="form-group">
          <label>Visibility</label>
          <select name="visibility" value={form.visibility} onChange={hc}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function MyTrips() {
  const [data, setData] = useState({ hosted: [], joined: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("hosted");
  const [editingId, setEditingId] = useState(null);
  const { socket } = useSocket() || {};
  const toast = useToast();

  const load = useCallback(() => {
    return getMyTrips().then((r) => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on("join_requested", load);
    socket.on("trip_updated", load);
    socket.on("trip_deleted", load);
    socket.on("passenger_updated", load);
    socket.on("ride_update", load);
    return () => {
      socket.off("join_requested", load);
      socket.off("trip_updated", load);
      socket.off("trip_deleted", load);
      socket.off("passenger_updated", load);
      socket.off("ride_update", load);
    };
  }, [socket, load]);

  const trips = tab === "hosted" ? data.hosted : data.joined;

  const replaceHosted = (updated) => {
    setData((current) => ({
      ...current,
      hosted: current.hosted.map((trip) => trip._id === updated._id ? updated : trip),
    }));
    setEditingId(null);
    toast?.show("Trip updated", "success");
  };

  const handleDelete = async (trip) => {
    const ok = window.confirm("Delete this trip? Accepted riders will be notified.");
    if (!ok) return;
    try {
      await deleteTrip(trip._id);
      setData((current) => ({
        hosted: current.hosted.filter((t) => t._id !== trip._id),
        joined: current.joined.filter((t) => t._id !== trip._id),
      }));
      toast?.show("Trip deleted", "success");
    } catch (err) {
      toast?.show(err.response?.data?.error || "Trip could not be deleted", "error");
    }
  };

  const handlePassenger = async (tripId, userId, action) => {
    try {
      await managePassenger(tripId, userId, action);
      await load();
      toast?.show(action === "accept" ? "Passenger accepted" : "Passenger declined", "success");
    } catch (err) {
      toast?.show(err.response?.data?.error || "Request could not be updated", "error");
    }
  };

  return (
    <div className="page-wrap">
      <h2 className="page-title">My Trips</h2>
      <div className="my-tabs">
        <button className={`my-tab ${tab === "hosted" ? "active" : ""}`} onClick={() => setTab("hosted")}>
          Posted ({data.hosted?.length || 0})
        </button>
        <button className={`my-tab ${tab === "joined" ? "active" : ""}`} onClick={() => setTab("joined")}>
          Joined ({data.joined?.length || 0})
        </button>
      </div>
      {loading ? (
        <SkeletonList count={3} />
      ) : trips.length === 0 ? (
        <div className="empty-state">
          <p className="text-muted">
            {tab === "hosted" ? "You have not posted any trips yet." : "You have not joined any trips yet."}
          </p>
        </div>
      ) : trips.map((t) => (
        <React.Fragment key={t._id}>
          <TripCard
            trip={t}
            actions={tab === "hosted" ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingId((id) => id === t._id ? null : t._id)}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t)}>Delete</button>
              </>
            ) : null}
          />
          {tab === "hosted" && editingId === t._id && (
            <TripEditor trip={t} onCancel={() => setEditingId(null)} onSaved={replaceHosted} />
          )}
          {tab === "hosted" && t.passengers?.some((p) => p.status === "pending") && (
            <div className="card fade-in" style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Join Requests</h3>
              {t.passengers.filter((p) => p.status === "pending").map((p) => (
                <div key={p.user?._id || p._id} className="pax-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{p.user?.name?.[0]?.toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.user?.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>{p.user?.gender} - Trust {p.user?.trustScore?.score || 82}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handlePassenger(t._id, p.user?._id, "accept")}>Accept</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handlePassenger(t._id, p.user?._id, "reject")}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
