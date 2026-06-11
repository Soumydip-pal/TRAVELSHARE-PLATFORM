import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getFareSplit, getMessages, getTripById, joinTrip, managePassenger, sendMessage } from "../utils/api";
import { useAuth } from "../utils/AuthContext";
import { useSocket } from "../utils/SocketContext";
import { useToast } from "../utils/ToastContext";
import { SkeletonList } from "../components/UIComponents";

const TYPE_LABEL = { live: "Live", need_partner: "Needs Partner", scheduled: "Scheduled" };
const TYPE_BADGE = { live: "badge-orange", need_partner: "badge-blue", scheduled: "badge-green" };

export default function TripDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { socket } = useSocket() || {};
  const toast = useToast();
  const [trip, setTrip] = useState(null);
  const [split, setSplit] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [tab, setTab] = useState(() => searchParams.get("tab") || "info");
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef(null);

  const isHost = trip?.host?._id === user?._id;
  const myEntry = trip?.passengers?.find((p) => p.user?._id === user?._id);
  const isAccepted = myEntry?.status === "accepted";
  const isPending = myEntry?.status === "pending";
  const canChat = isHost || isAccepted;

  useEffect(() => {
    setLoading(true);
    getTripById(id)
      .then((r) => setTrip(r.data.trip))
      .catch((e) => setError(e.response?.data?.error || "Trip could not be loaded"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!trip) return;
    getFareSplit(id).then((r) => setSplit(r.data.split)).catch(() => {});
    if (canChat) getMessages(id).then((r) => setMsgs(r.data.messages)).catch(() => {});
  }, [trip?._id, canChat, id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (!socket || !id) return undefined;
    socket.emit("join_trip", id);
    const refreshTrip = ({ tripId }) => {
      if (tripId !== id) return;
      getTripById(id).then((r) => setTrip(r.data.trip)).catch(() => {});
      getFareSplit(id).then((r) => setSplit(r.data.split)).catch(() => {});
    };
    const handleDeleted = ({ tripId }) => {
      if (tripId !== id) return;
      toast?.show("This trip was deleted", "warning");
      navigate("/my-trips");
    };
    const handleMessage = (message) => {
      if (message.trip !== id) return;
      setMsgs((current) => current.some((m) => m._id === message._id) ? current : [...current, message]);
    };
    socket.on("new_message", handleMessage);
    socket.on("join_requested", refreshTrip);
    socket.on("passenger_updated", refreshTrip);
    socket.on("trip_updated", refreshTrip);
    socket.on("ride_update", refreshTrip);
    socket.on("trip_deleted", handleDeleted);
    return () => {
      socket.off("new_message", handleMessage);
      socket.off("join_requested", refreshTrip);
      socket.off("passenger_updated", refreshTrip);
      socket.off("trip_updated", refreshTrip);
      socket.off("ride_update", refreshTrip);
      socket.off("trip_deleted", handleDeleted);
    };
  }, [socket, id, navigate, toast]);

  const handleJoin = async () => {
    setJoinLoading(true);
    setError("");
    try {
      const r = await joinTrip(id);
      setTrip(r.data.trip);
      toast?.show("Join request sent", "success");
    } catch (e) {
      setError(e.response?.data?.error || "Could not join trip");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleManage = async (userId, action) => {
    try {
      const r = await managePassenger(id, userId, action);
      setTrip(r.data.trip);
      toast?.show(action === "accept" ? "Passenger accepted" : "Passenger declined", "success");
    } catch (e) {
      setError(e.response?.data?.error || "Action failed");
    }
  };

  const handleSend = async () => {
    if (!msgText.trim()) return;
    try {
      const r = await sendMessage(id, msgText);
      setMsgs((m) => [...m, r.data.message]);
      setMsgText("");
    } catch {
      toast?.show("Message could not be sent", "error");
    }
  };

  const fmt = (d) => new Date(d).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const fare = trip?.actualFare || trip?.predictedFare?.median || 0;
  const fareSummary = trip?.fareSplit || split;

  if (loading) return <div className="page-wrap"><SkeletonList count={2} /></div>;
  if (!trip) return <div className="page-wrap"><div className="empty-state"><p className="text-muted">{error || "Trip not found."}</p></div></div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button className="td-back" onClick={() => navigate(-1)}>Back</button>
        <span className={`badge ${TYPE_BADGE[trip.tripType] || "badge-green"}`}>{TYPE_LABEL[trip.tripType] || "Trip"}</span>
      </div>

      <div className="host-card">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="avatar" style={{ width: 52, height: 52, fontSize: 20 }}>{trip.host?.name?.[0]?.toUpperCase()}</div>
          <div>
            <div className="host-name">{trip.host?.name}</div>
            <div style={{ color: "var(--text2)", fontSize: 13 }}>
              Trust Score {trip.host?.trustScore?.score || 82} - {trip.host?.gender}
            </div>
            {isAccepted && <div style={{ color: "var(--text2)", fontSize: 13 }}>{trip.host?.phone}</div>}
          </div>
        </div>
        <div style={{ fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--accent)" }}>
          {trip.availableSeats} seat{trip.availableSeats !== 1 ? "s" : ""} left
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Route</h3>
        <div className="tc-route">
          <div className="tc-rpt"><span className="tc-dot" style={{ background: "#00c896" }} /><span className="tc-rtext">{trip.origin?.address || `${trip.origin?.lat}, ${trip.origin?.lng}`}</span></div>
          <div className="tc-rline" />
          <div className="tc-rpt"><span className="tc-dot" style={{ background: "#0084ff" }} /><span className="tc-rtext">{trip.destination?.address || `${trip.destination?.lat}, ${trip.destination?.lng}`}</span></div>
        </div>
      </div>

      <div className="tabs">
        {["info", "passengers", "fare", ...(canChat ? ["chat"] : [])].map((t) => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "info" ? "Info" : t === "passengers" ? "Riders" : t === "fare" ? "Fare" : "Chat"}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="card fade-in">
          <div className="info-grid">
            <div><div className="info-lbl">Departure</div><div className="info-val">{fmt(trip.departureTime)}</div></div>
            <div><div className="info-lbl">City</div><div className="info-val">{trip.city}</div></div>
            <div><div className="info-lbl">Gender Pref.</div><div className="info-val">{trip.genderPreference}</div></div>
            <div><div className="info-lbl">Status</div><div className="info-val">{trip.status}</div></div>
            <div><div className="info-lbl">Mood</div><div className="info-val">{trip.rideMood?.conversation || "any"}</div></div>
            <div><div className="info-lbl">Comfort</div><div className="info-val">AC {trip.rideMood?.ac || "any"}</div></div>
            {trip.distanceKm && <div><div className="info-lbl">Distance</div><div className="info-val">{trip.distanceKm} km</div></div>}
            {trip.durationMin && <div><div className="info-lbl">Duration</div><div className="info-val">~{trip.durationMin} min</div></div>}
          </div>
          <div className="divider" />
          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          {!isHost && !myEntry && trip.status === "active" && (
            <button className="btn btn-primary w-full" style={{ padding: 12 }} onClick={handleJoin} disabled={joinLoading}>
              {joinLoading ? "Sending request..." : "Request to Join"}
            </button>
          )}
          {isPending && <div className="pending-banner">Your join request is pending host approval.</div>}
          {isAccepted && !isHost && <div className="accepted-banner">You are in. Use Chat to coordinate.</div>}
          {isHost && <div className="accepted-banner">You are the host of this trip.</div>}
        </div>
      )}

      {tab === "passengers" && (
        <div className="card fade-in">
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Riders ({trip.passengers?.length || 0})</h3>
          {trip.passengers?.length === 0 && <p className="text-muted text-sm">No join requests yet.</p>}
          {trip.passengers?.map((p) => (
            <div key={p.user?._id || p._id} className="pax-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{p.user?.name?.[0]?.toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.user?.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>{p.user?.gender} - Trust {p.user?.trustScore?.score || 82}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`badge ${p.status === "accepted" ? "badge-green" : p.status === "rejected" ? "badge-gray" : "badge-orange"}`}>{p.status}</span>
                {isHost && p.status === "pending" && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => handleManage(p.user?._id, "accept")}>Accept</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleManage(p.user?._id, "reject")}>Reject</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "fare" && (
        <div className="card fade-in">
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Cost Breakdown</h3>
          {trip.actualFare && <div className="fare-row"><span className="text-muted">Total Ride Fare</span><span className="fare-big">Rs {trip.actualFare}</span></div>}
          {trip.predictedFare && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, background: trip.predictedFare.modelUsed === "gradient_boosting" ? "rgba(0,200,150,.12)" : "rgba(255,165,0,.12)", color: trip.predictedFare.modelUsed === "gradient_boosting" ? "var(--accent)" : "var(--warning)", borderRadius: 20, padding: "2px 10px", fontWeight: 700 }}>
                  {trip.predictedFare.modelUsed === "gradient_boosting" ? "🤖 ML Prediction" : "📐 Rule-based Estimate"}
                </span>
              </div>
              <div className="fare-row">
                <span className="text-muted">Fare Range</span>
                <span style={{ fontSize: 13, color: "var(--text2)" }}>₹{trip.predictedFare.lower} – ₹{trip.predictedFare.upper}</span>
              </div>
              <div className="fare-row"><span className="text-muted">Estimated Total</span><span className="fare-big" style={{ color: "#0084ff" }}>₹{trip.predictedFare.median}</span></div>
            </>
          )}
          {fareSummary && (
            <>
              <div className="divider" />
              <div className="fare-row"><span className="text-muted">Total Riders</span><span className="fare-big">{fareSummary.passengers || fareSummary.riders}</span></div>
              <div style={{ background: "rgba(0,200,150,.08)", border: "1px solid rgba(0,200,150,.2)", borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontWeight: 700 }}>Per Person</span>
                <span style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--accent)" }}>Rs {fareSummary.perPerson}</span>
              </div>
            </>
          )}
          {!fare && <p className="text-muted text-sm">No fare information available yet.</p>}
        </div>
      )}

      {tab === "chat" && canChat && (
        <div className="card fade-in" style={{ display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Group Chat</h3>
          <div className="chat-msgs">
            {msgs.length === 0 && <p className="text-muted text-sm" style={{ margin: "auto" }}>No messages yet.</p>}
            {msgs.map((m) => {
              const mine = m.sender?._id === user?._id;
              return (
                <div key={m._id} className="msg-row" style={{ justifyContent: mine ? "flex-end" : "flex-start" }}>
                  {!mine && <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>{m.sender?.name?.[0]}</div>}
                  <div className={`bubble ${mine ? "bubble-mine" : "bubble-theirs"}`}>
                    {!mine && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{m.sender?.name}</div>}
                    {m.text}
                    <div style={{ fontSize: 10, opacity: .6, marginTop: 3, textAlign: mine ? "right" : "left" }}>
                      {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-inp-row">
            <input value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === "Enter" && handleSend()} style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={handleSend}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
