import Link from "next/link";

export default function NotFound() {
  return (
    <main className="system-state-page">
      <div className="system-state-card">
        <span className="system-state-badge">Erro 404</span>
        <h1>Página não encontrada</h1>
        <p>O endereço acessado não existe ou foi alterado.</p>
        <Link className="primary-button" href="/">Voltar ao sistema</Link>
      </div>
    </main>
  );
}
