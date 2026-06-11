import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import { getNotifications, markAllNotificationsRead, deleteNotification, deleteAllNotifications } from "../utils/api";
import { useSocket } from "../utils/SocketContext";
import { useToast } from "../utils/ToastContext";

const NAV_LINKS = [
  { to: "/dashboard",  label: "Dashboard" },
  { to: "/trips",      label: "Browse" },
  { to: "/post-trip",  label: "Post Trip" },
  { to: "/my-trips",   label: "My Trips" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { socket } = useSocket();
  const toast = useToast();
  const [open, setOpen]             = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]         = useState(0);
  const [isMobile, setIsMobile]     = useState(false);
  const dropdownRef = useRef(null);

  const isActive  = (path) => location.pathname === path;
  const handleLogout = () => { logout(); navigate("/login"); };

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getNotifications()
      .then((res) => {
        if (!alive) return;
        setNotifications(res.data.notifications || []);
        setUnread(res.data.unread || 0);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const onNotification = (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 20));
      setUnread((c) => c + 1);
      toast?.show(n.title || "New notification", n.type === "safety" ? "warning" : "info");
    };
    socket.on("notification", onNotification);
    socket.on("trip_created", () => toast?.show("New nearby trip posted", "info"));
    socket.on("ride_update", (ev) => {
      if (ev?.type === "trip_cancelled") toast?.show("A trip in your area was cancelled", "warning");
    });
    // Sync read/delete state pushed from other tabs or server
    socket.on("notification_read", ({ _id }) => {
      setNotifications((prev) => prev.map((n) => n._id === _id ? { ...n, readAt: new Date().toISOString() } : n));
      setUnread((c) => Math.max(0, c - 1));
    });
    socket.on("notification_deleted", ({ _id }) => {
      setNotifications((prev) => prev.filter((n) => n._id !== _id));
    });
    socket.on("notifications_cleared", () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      setUnread(0);
    });
    return () => {
      socket.off("notification", onNotification);
      socket.off("trip_created");
      socket.off("ride_update");
      socket.off("notification_read");
      socket.off("notification_deleted");
      socket.off("notifications_cleared");
    };
  }, [socket, toast]);

  useEffect(() => {
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const sync = () => setIsMobile(window.innerWidth <= 820);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const openNotifications = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setProfileOpen(false);
    if (next && unread) {
      setUnread(0);
      markAllNotificationsRead().catch(() => {});
    }
  };

  const handleDeleteNotif = async (e, id) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    setUnread((c) => Math.max(0, c - 1));
    deleteNotification(id).catch(() => {});
  };

  const handleClearAll = async () => {
    setNotifications([]);
    setUnread(0);
    deleteAllNotifications().catch(() => {});
  };

  const handleOpenNotification = (item) => {
    setNotifOpen(false);
    if (item.data?.tripId) {
      const tab = item.title?.toLowerCase().includes("join request") ? "?tab=passengers" : "";
      navigate(`/trips/${item.data.tripId}${tab}`);
      return;
    }
    navigate("/my-trips");
  };

  if (!user) return null;

  return (
    <nav style={S.nav}>
      <div style={S.inner}>
        {/* Brand */}
        <Link to="/dashboard" style={S.brand}>
          <span style={S.brandMark}>TS</span>
          {!isMobile && <span style={S.brandText}>TravelShare</span>}
        </Link>

        {/* Desktop links */}
        {!isMobile && (
          <div style={S.links}>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                style={{ ...S.link, ...(isActive(l.to) ? S.linkActive : {}) }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}

        {/* Right actions */}
        <div style={S.right} ref={dropdownRef}>
          {/* Notifications */}
          <button
            style={S.iconBtn}
            onClick={openNotifications}
            aria-label="Notifications"
            title="Notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && <span style={S.count}>{unread > 9 ? "9+" : unread}</span>}
          </button>

          {/* Avatar / profile */}
          <button
            style={S.avatarBtn}
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            aria-label="Profile menu"
          >
            <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
              {user.name?.[0]?.toUpperCase()}
            </div>
          </button>

          {/* Mobile hamburger */}
          {isMobile && (
            <button style={S.ham} onClick={() => setOpen(!open)} aria-label="Menu">
              {open
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              }
            </button>
          )}

          {/* Notification dropdown */}
          {notifOpen && (
            <div style={S.dropdown}>
              <div style={{ ...S.dropTitle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 11 }}
                    title="Clear all"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div style={S.dropMuted}>No alerts yet.</div>
              ) : (
                notifications.slice(0, 8).map((item) => {
                  const icon = item.type === "match" ? "🤝" : item.type === "trip" ? "🚗" : item.type === "wallet" ? "💰" : "🔔";
                  const isUnread = !item.readAt;
                  const timeAgo = (() => {
                    const diff = Date.now() - new Date(item.createdAt);
                    if (diff < 60000) return "just now";
                    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
                    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
                    return `${Math.round(diff / 86400000)}d ago`;
                  })();
                  return (
                    <div
                      key={item._id}
                      onClick={() => handleOpenNotification(item)}
                      style={{
                        ...S.notifItem,
                        background: isUnread ? "rgba(0,200,150,.06)" : "transparent",
                        borderLeft: isUnread ? "3px solid var(--accent)" : "3px solid transparent",
                        paddingLeft: 10,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...S.notifTitle, color: isUnread ? "var(--text1)" : "var(--text2)" }}>
                            {item.title}
                          </div>
                          {item.message && (
                            <div style={{ ...S.dropMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {item.message}
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>{timeAgo}</div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteNotif(e, item._id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 14, padding: "0 2px", flexShrink: 0 }}
                          title="Dismiss"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Profile dropdown */}
          {profileOpen && (
            <div style={S.dropdown}>
              <div style={S.dropTitle}>{user.name}</div>
              <div style={{ ...S.dropMuted, marginBottom: 8 }}>
                Trust Score <span style={{ color: "var(--warning)", fontWeight: 700 }}>{user.trustScore?.score || 82}</span>
                &nbsp;· {user.city || "Kolkata"}
              </div>
              <Link to="/profile"  style={S.dropLink} onClick={() => setProfileOpen(false)}>Profile Settings</Link>
              <Link to="/my-trips" style={S.dropLink} onClick={() => setProfileOpen(false)}>My Trips</Link>
              <button onClick={handleLogout} style={{ ...S.dropLink, color: "var(--error)", width: "100%", textAlign: "left" }}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {isMobile && open && (
        <div style={S.mobileMenu}>
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} style={S.mobileLink} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <Link to="/profile" style={S.mobileLink} onClick={() => setOpen(false)}>Profile</Link>
          <button
            onClick={handleLogout}
            style={{ ...S.mobileLink, background: "none", border: "none", color: "var(--error)", cursor: "pointer", textAlign: "left" }}
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}

const S = {
  nav: {
    position: "sticky", top: 0, zIndex: 1000,
    background: "rgba(10,15,30,.95)", backdropFilter: "blur(14px)",
    borderBottom: "1px solid var(--border)",
  },
  inner: {
    maxWidth: 1100, margin: "0 auto", padding: "0 20px",
    height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  brandMark: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 9,
    background: "linear-gradient(135deg,#0084ff,#00c896)",
    color: "#fff", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800,
  },
  brandText: {
    fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20,
    background: "linear-gradient(90deg,#00c896,#0084ff)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  links: { display: "flex", gap: 2 },
  link: {
    padding: "6px 13px", borderRadius: 8, fontSize: 14,
    color: "var(--text2)", textDecoration: "none", fontWeight: 500,
    transition: "all .15s",
  },
  linkActive: { background: "var(--surface2)", color: "var(--text)" },
  right: { display: "flex", alignItems: "center", gap: 8, position: "relative" },
  avatarBtn: { background: "none", border: "none", padding: 0, cursor: "pointer" },
  iconBtn: {
    position: "relative", background: "var(--surface2)", border: "1px solid var(--border)",
    color: "var(--text2)", borderRadius: 8, padding: "8px 10px", display: "flex",
    alignItems: "center", cursor: "pointer",
  },
  count: {
    position: "absolute", top: -6, right: -6, minWidth: 17, height: 17,
    borderRadius: 9, background: "var(--accent3)", color: "#fff", fontSize: 10,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
    fontWeight: 700,
  },
  ham: {
    background: "none", border: "none", color: "var(--text)", cursor: "pointer",
    display: "flex", alignItems: "center", padding: 4,
  },
  dropdown: {
    position: "absolute", top: 54, right: 0, width: 270,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "12px 14px",
    zIndex: 9999,
  },
  dropTitle: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 6 },
  dropMuted: { color: "var(--text2)", fontSize: 12, lineHeight: 1.4 },
  notifItem: { padding: "9px 0", borderTop: "1px solid var(--border)" },
  notifTitle: { fontWeight: 600, fontSize: 13, marginBottom: 2, color: "var(--text)" },
  dropLink: {
    display: "block", padding: "9px 0", color: "var(--text)", textDecoration: "none",
    borderTop: "1px solid var(--border)", background: "none",
    borderLeft: "none", borderRight: "none", borderBottom: "none", fontSize: 14,
    cursor: "pointer",
  },
  mobileMenu: {
    background: "var(--surface)", borderTop: "1px solid var(--border)",
    padding: "12px 20px", display: "flex", flexDirection: "column", gap: 2,
  },
  mobileLink: {
    padding: "10px 0", color: "var(--text)", textDecoration: "none",
    borderBottom: "1px solid var(--border)", fontSize: 15,
  },
};
