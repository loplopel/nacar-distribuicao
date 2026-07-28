"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="system-state-page">
      <div className="system-state-card">
        <span className="system-state-badge">Grupo Nacar</span>
        <h1>Não foi possível carregar esta página</h1>
        <p>Tente novamente. Caso o problema continue, confira a conexão com o Supabase.</p>
        <button type="button" className="primary-button" onClick={reset}>Tentar novamente</button>
      </div>
    </main>
  );
}
