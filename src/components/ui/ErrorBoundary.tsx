import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "[FluxNet] React crash caught by ErrorBoundary:",
      error,
      errorInfo.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 16,
            fontFamily: "monospace",
            fontSize: 12,
            color: "#f87171",
            background: "#1a1020",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 24 }}>⚠️</div>
          <div>Something went wrong</div>
          <div style={{ color: "#a8a4c8", maxWidth: 300 }}>
            {this.state.error?.message || "Unknown error"}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8,
              padding: "6px 16px",
              background: "#6c5ce7",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
