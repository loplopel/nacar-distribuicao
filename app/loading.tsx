export default function Loading() {
  return (
    <main className="system-state-page">
      <div className="system-state-card">
        <div className="system-spinner" aria-label="Carregando" />
        <h1>Carregando informações</h1>
        <p>Aguarde enquanto o sistema consulta os dados.</p>
      </div>
    </main>
  );
}
