import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Capture les erreurs de rendu pour éviter l'écran blanc et proposer un redémarrage propre.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Erreur capturée par ErrorBoundary :', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="w-16 h-16 rounded-full bg-rose-500/15 ring-1 ring-rose-500/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </span>
        <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
        <p className="text-neutral-400 max-w-md">
          L'application a rencontré un problème inattendu. Rechargez pour continuer ; si le problème
          persiste, contactez le support.
        </p>
        {import.meta.env.DEV && (
          <pre className="max-w-md overflow-auto text-left text-xs text-rose-300 bg-neutral-950 border border-neutral-800 rounded-lg p-3">
            {this.state.error.message}
          </pre>
        )}
        <button
          onClick={() => window.location.reload()}
          className="bg-gold-400 hover:bg-gold-300 text-black font-bold px-5 py-2.5 rounded-xl transition"
        >
          Recharger l'application
        </button>
      </div>
    );
  }
}
