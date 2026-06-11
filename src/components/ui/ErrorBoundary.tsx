import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-6 font-sans text-center">
          <h1 className="text-xl mb-2">Something went wrong</h1>
          <p className="text-sm text-[#666] mb-4">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleRestart}
            type="button"
            className="px-4 py-2 rounded-md border border-[#ccc] bg-[#f5f5f5] cursor-pointer text-sm"
          >
            Click to restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
