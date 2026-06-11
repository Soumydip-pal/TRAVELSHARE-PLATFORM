import React from "react";

/**
 * Global error boundary — catches unhandled React render errors
 * and shows a friendly fallback instead of a blank screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
    window.location.href = "/dashboard";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>💥</div>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.sub}>
            An unexpected error occurred. Your session and data are safe.
          </p>

          {this.state.error && (
            <details style={styles.details}>
              <summary style={styles.summary}>Technical details</summary>
              <pre style={styles.pre}>
                {this.state.error.toString()}
                {this.state.info?.componentStack}
              </pre>
            </details>
          )}

          <div style={styles.actions}>
            <button
              className="btn btn-primary"
              style={{ padding: "11px 28px" }}
              onClick={this.handleReset}
            >
              Back to Dashboard
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: "11px 28px" }}
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    padding: 20,
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 40,
    maxWidth: 520,
    width: "100%",
    textAlign: "center",
    boxShadow: "var(--shadow)",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: 26,
    fontWeight: 800,
    marginBottom: 10,
  },
  sub: {
    color: "var(--text2)",
    fontSize: 15,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  details: {
    textAlign: "left",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 14,
    marginBottom: 24,
  },
  summary: {
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text2)",
    marginBottom: 8,
  },
  pre: {
    fontSize: 11,
    color: "var(--error)",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    marginTop: 8,
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
};
