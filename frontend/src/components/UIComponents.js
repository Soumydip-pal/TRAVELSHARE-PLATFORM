import React from "react";

export function LoadingSpinner({ text = "Loading…", size = 32 }) {
  return (
    <div style={styles.wrap}>
      <div style={{ ...styles.spinner, width: size, height: size }} />
      {text && <div style={styles.text}>{text}</div>}
    </div>
  );
}

export function EmptyState({ icon = "🛣️", title = "Nothing here yet", desc = "", action = null }) {
  return (
    <div style={styles.empty}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <h3 style={styles.emptyTitle}>{title}</h3>
      {desc && <p style={styles.emptyDesc}>{desc}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-card" aria-hidden="true">
          <div className="skeleton-row">
            <span className="skeleton-avatar" />
            <span className="skeleton-line wide" />
            <span className="skeleton-pill" />
          </div>
          <span className="skeleton-line" />
          <span className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={styles.errorBanner}>
      <span>⚠️ {message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={styles.dismissBtn}>✕</button>
      )}
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div style={styles.successBanner}>✅ {message}</div>
  );
}

export function SectionCard({ title, children, action }) {
  return (
    <div style={styles.sectionCard}>
      {(title || action) && (
        <div style={styles.sectionHeader}>
          {title && <h3 style={styles.sectionTitle}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 40 },
  spinner: {
    border: "3px solid var(--border)",
    borderTop: "3px solid var(--accent)",
    borderRadius: "50%",
    animation: "spin 0.9s linear infinite",
  },
  text: { color: "var(--text2)", fontSize: 14 },
  empty: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 48, textAlign: "center",
  },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 8 },
  emptyDesc: { color: "var(--text2)", fontSize: 14 },
  errorBanner: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--error)",
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
  },
  dismissBtn: { background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: 14 },
  successBanner: {
    background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)",
    borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--accent)", marginBottom: 12,
  },
  sectionCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 16 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 },
};
