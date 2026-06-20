import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level error boundary.
 *
 * Prevents a render-time exception from blanking the whole page and shows a
 * recoverable fallback instead. Errors are logged generically — no stack
 * traces or internals are surfaced to the user.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In a real app this would go to an error-reporting service.
    if (import.meta.env.DEV) {
      console.error('Unhandled UI error:', error, info.componentStack);
    }
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-lg font-semibold text-text-primary">
            Something went wrong
          </h2>
          <p className="max-w-sm text-sm text-text-secondary">
            The chat ran into an unexpected error. Reloading should put things right.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
