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
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden bg-app p-4 text-center"
      >
        <div className="text-body font-semibold text-fg">
          Something went wrong
        </div>
        <div className="max-w-[360px] text-caption text-fg-secondary select-text">
          {this.state.error?.message || "Unknown error"}
        </div>
        <button
          type="button"
          onClick={() => this.setState({ hasError: false, error: null })}
          className="mt-2 h-8 rounded-control bg-accent px-4 text-body text-on-accent hover:bg-accent-hover active:bg-accent-pressed"
        >
          Try again
        </button>
      </div>
    );
  }
}
