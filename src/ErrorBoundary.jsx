import { Component } from 'react';

/** Évite l'écran blanc : si l'interface plante, on affiche un message clair et un bouton pour recharger. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Point d'entrée unique pour brancher un outil de suivi (Sentry, etc.) plus tard.
    console.error('DOBI UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: 480, margin: '15vh auto', padding: 24, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Un problème est survenu</h1>
        <p style={{ marginBottom: 16 }}>L’application a rencontré une erreur inattendue. Vos données ne sont pas perdues.</p>
        <button type="button" onClick={() => window.location.assign('/')} style={{ padding: '10px 18px', borderRadius: 8, border: 0, background: '#d5f06a', fontWeight: 700, cursor: 'pointer' }}>
          Recharger l’application
        </button>
      </div>
    );
  }
}
