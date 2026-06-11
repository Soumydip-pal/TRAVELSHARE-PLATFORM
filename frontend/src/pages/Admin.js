import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminReports, getAdminSummary, getHealth, getTrips, updateAdminReport } from "../utils/api";
import { useAuth } from "../utils/AuthContext";
import { SkeletonList } from "../components/UIComponents";
import { useToast } from "../utils/ToastContext";

const TYPE_COLOR = { live: "#ff6b35", need_partner: "#0084ff", scheduled: "#00c896" };
const STATUS_COLOR = { active: "#00c896", full: "#f59e0b", completed: "#8b5cf6", cancelled: "#ef4444" };

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [trips, setTrips] = useState([]);
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([getTrips({ upcomingOnly: "false" }), getAdminSummary(), getAdminReports(), getHealth()])
      .then(([tripsRes, summaryRes, reportsRes, healthRes]) => {
        setTrips(tripsRes.data.trips || []);
        setSummary(summaryRes.data);
        setReports(reportsRes.data.reports || []);
        setHealth(healthRes.data);
      })
      .catch((err) => toast?.show(err.response?.data?.error || "Admin data could not be loaded", "error"))
      .finally(() => setLoading(false));
  }, [isAdmin, toast]);

  if (!isAdmin) {
    return (
      <div style={styles.noAccess}>
        <h2 style={{ fontFamily: "var(--font-display)", margin: "12px 0" }}>Admin Access Only</h2>
        <p className="text-muted">This page is restricted to administrators.</p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
      </div>
    );
  }

  const stats = [
    { label: "Total Trips", value: summary?.totalTrips ?? trips.length, color: "#0084ff" },
    { label: "Active Trips", value: summary?.activeTrips ?? 0, color: "#00c896" },
    { label: "Cancelled", value: summary?.cancelledTrips ?? 0, color: "#ef4444" },
    { label: "Users", value: summary?.users ?? 0, color: "#f59e0b" },
    { label: "Open Reports", value: summary?.openReports ?? reports.length, color: "#ff6b35" },
    { label: "Unread Alerts", value: summary?.unreadNotifications ?? 0, color: "#8b5cf6" },
  ];

  const formatTime = (d) => new Date(d).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const updateReport = async (report, status) => {
    try {
      const res = await updateAdminReport(report._id, { status, severity: report.severity });
      setReports((items) => items.map((item) => item._id === report._id ? { ...item, ...res.data.report } : item));
      toast?.show("Report updated", "success");
    } catch {
      toast?.show("Could not update report", "error");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Admin Dashboard</h2>
          <p className="text-muted text-sm">Platform monitoring, reports, and system health</p>
        </div>
        <span className="badge badge-green">Admin: {user?.name}</span>
      </div>

      <div style={styles.tabs}>
        {[
          { id: "overview", label: "Overview" },
          { id: "trips", label: "Trips" },
          { id: "reports", label: "Reports" },
          { id: "system", label: "System" },
        ].map((item) => (
          <button key={item.id} style={{ ...styles.tab, ...(tab === item.id ? styles.tabActive : {}) }} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <SkeletonList count={3} /> : tab === "overview" && (
        <div className="fade-in">
          <div style={styles.statsGrid}>
            {stats.map((s) => (
              <div key={s.label} style={{ ...styles.statCard, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tab === "trips" && (
        <div className="fade-in">
          <div style={styles.tableCard}>
            <h3 style={styles.cardTitle}>All Trips ({trips.length})</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead><tr>{["Host", "Route", "Type", "Seats", "Fare", "Departure", "Status"].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {trips.map((trip) => (
                    <tr key={trip._id} style={styles.tr} onClick={() => navigate(`/trips/${trip._id}`)}>
                      <td style={styles.td}>{trip.host?.name || "-"}</td>
                      <td style={{ ...styles.td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trip.origin?.address?.slice(0, 22)} to {trip.destination?.address?.slice(0, 22)}</td>
                      <td style={styles.td}><span style={{ color: TYPE_COLOR[trip.tripType], fontWeight: 700, fontSize: 12 }}>{trip.tripType?.replace("_", " ").toUpperCase()}</span></td>
                      <td style={styles.td}>{trip.availableSeats}/{trip.totalSeats}</td>
                      <td style={styles.td}>{trip.actualFare ? `Rs ${trip.actualFare}` : trip.predictedFare ? `Rs ${trip.predictedFare.median}` : "-"}</td>
                      <td style={{ ...styles.td, fontSize: 12 }}>{formatTime(trip.departureTime)}</td>
                      <td style={styles.td}><span style={{ color: STATUS_COLOR[trip.status] || "var(--text2)", fontWeight: 700, fontSize: 12 }}>{trip.status?.toUpperCase()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && tab === "reports" && (
        <div className="fade-in">
          <div style={styles.tableCard}>
            <h3 style={styles.cardTitle}>Safety Reports ({reports.length})</h3>
            {reports.length === 0 ? <p className="text-muted text-sm">No safety reports yet.</p> : reports.map((report) => (
              <div key={report._id} style={styles.reportRow}>
                <div>
                  <div style={{ fontWeight: 700 }}>{report.reason}</div>
                  <div className="text-muted text-sm">Reporter: {report.reporter?.name || "-"} | Target: {report.target?.name || "-"}</div>
                  <div className="text-muted text-sm">Severity: {report.severity} | Status: {report.status}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => updateReport(report, "reviewing")}>Review</button>
                  <button className="btn btn-primary btn-sm" onClick={() => updateReport(report, "resolved")}>Resolve</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tab === "system" && (
        <div className="fade-in">
          <div style={styles.sysGrid}>
            {[
              { label: "Backend API", status: health?.status || "unknown", detail: `DB ${health?.db || "unknown"}`, color: "#68a063" },
              { label: "Environment", status: health?.env || "development", detail: `Uptime ${health?.uptimeSec || 0}s`, color: "#0084ff" },
              { label: "SWTARS", status: "worker enabled", detail: "Auto-cancel/rebook queue", color: "#f59e0b" },
              { label: "Realtime", status: "Socket.IO", detail: "Alerts and ride updates", color: "#00c896" },
            ].map((item) => (
              <div key={item.label} style={styles.sysCard}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>{item.label}</div>
                <div style={{ color: item.color, fontWeight: 700, margin: "8px 0" }}>{item.status}</div>
                <div className="text-muted text-sm">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 1000, margin: "0 auto", padding: "24px 20px" },
  noAccess: { textAlign: "center", padding: "80px 20px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, marginBottom: 4 },
  tabs: { display: "flex", gap: 8, marginBottom: 24, overflowX: "auto" },
  tab: { padding: "10px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--text2)", fontSize: 14, fontFamily: "var(--font-body)", transition: "all 0.15s", whiteSpace: "nowrap" },
  tabActive: { background: "var(--surface2)", color: "var(--text)", borderColor: "var(--accent)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 },
  statCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4 },
  statLabel: { fontSize: 12, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" },
  tableCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 },
  cardTitle: { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 16 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 12px", fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" },
  td: { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid var(--border)", color: "var(--text)" },
  tr: { cursor: "pointer", transition: "background 0.15s" },
  reportRow: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", borderTop: "1px solid var(--border)", padding: "14px 0" },
  sysGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 },
  sysCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, textAlign: "center" },
};
