import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional label for which part of the app failed */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches render crashes so the UI shows a recoverable error
 * instead of a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected rendering error occurred.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', this.props.label ?? 'app', error, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="page fade-in error-boundary-page" role="alert">
        <div className="alert alert-error">
          <strong>{this.props.label ? `${this.props.label} failed` : 'Something went wrong'}</strong>
          <p style={{ margin: '0.5rem 0 0' }}>{this.state.message}</p>
        </div>
        <div className="error-boundary-actions">
          <button type="button" className="btn btn-secondary" onClick={this.retry}>
            Try again
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              window.location.assign('/farmers');
            }}
          >
            Go to farmers
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
