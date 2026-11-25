import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Alirada ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          friendly = `Database operation (${parsed.operationType} on ${parsed.path || 'record'}): ${parsed.error}`;
        }
      } catch {
        // Plain error message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-[#0B0D10] p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-4">
            <h2 className="font-cinzel text-xl font-bold text-stone-900 dark:text-stone-100">
              Alirada Workspace Notice
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
              {friendly}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 transition-opacity"
            >
              Return to Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
