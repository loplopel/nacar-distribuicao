import Image from 'next/image';
import { redirect } from 'next/navigation';
import { DatabaseBackup, ExternalLink, FileSpreadsheet, Mail, Palette, Save, Settings, ShieldCheck, Smartphone } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { adminClient } from '@/lib/supabase-admin';
import { getCurrentProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== 'admin') redirect('/catalogo');

  const params = await searchParams;
  const db = adminClient();
  const { data, error } = await db
    .from('app_settings')
    .select('*')
    .eq('id', 'main')
    .maybeSingle();

  const settings: any = data || {};
  const sheetUrl = settings.sheet_url || process.env.GOOGLE_SHEET_CSV_URL || '';

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <span className="eyebrow">SISTEMA</span>
          <h1>Configurações</h1>
          <p>Centralize a identidade, os contatos, o catálogo e a segurança do Grupo Nacar.</p>
        </div>
      </div>

      {params.ok && <div className="notice success">Configurações salvas com sucesso.</div>}
      {(params.error || error) && (
        <div className="notice error">{params.error || error?.message}</div>
      )}

      <div className="settings-overview">
        <section className="card settings-brand-preview">
          <div className="settings-logo-box">
            <Image src="/grupo-nacar.png" alt="Grupo Nacar" width={265} height={112} priority />
          </div>
          <div>
            <span className="eyebrow">IDENTIDADE ATUAL</span>
            <h2>{settings.system_name || 'Nacar Distribuição B2B'}</h2>
            <p>{settings.company_name || 'Grupo Nacar'}</p>
          </div>
        </section>

        <section className="card settings-status-card">
          <ShieldCheck size={24} />
          <div><span>Banco e autenticação</span><strong>Supabase conectado</strong></div>
          <div><span>Fonte do catálogo</span><strong>{sheetUrl ? 'Google Sheets configurado' : 'Não configurada'}</strong></div>
          <div><span>Ambiente</span><strong>Produção preparada</strong></div>
        </section>
      </div>

      <form className="card settings-form settings-form-pro" action="/api/admin/settings" method="post">
        <div className="settings-section">
          <div className="settings-title">
            <Settings size={22} />
            <div><h2>Dados institucionais</h2><p>Informações utilizadas no painel, nos relatórios e nos documentos.</p></div>
          </div>
          <div className="form-grid three">
            <label>Nome da empresa<input name="company_name" defaultValue={settings.company_name || 'Grupo Nacar'} required /></label>
            <label>Nome do sistema<input name="system_name" defaultValue={settings.system_name || 'Nacar Distribuição B2B'} required /></label>
            <label>CNPJ<input name="company_cnpj" defaultValue={settings.company_cnpj || ''} placeholder="00.000.000/0000-00" /></label>
            <label><span className="settings-label-icon"><Mail size={14}/> E-mail</span><input type="email" name="company_email" defaultValue={settings.company_email || ''} /></label>
            <label><span className="settings-label-icon"><Smartphone size={14}/> WhatsApp</span><input name="company_whatsapp" defaultValue={settings.company_whatsapp || ''} placeholder="5511999999999" /></label>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-title">
            <FileSpreadsheet size={22} />
            <div><h2>Catálogo e sincronização</h2><p>Defina a fonte oficial que alimenta produtos, estoque, preços e imagens.</p></div>
          </div>
          <div className="settings-sheet-row">
            <label>URL pública CSV do Google Sheets<input name="sheet_url" defaultValue={sheetUrl} /></label>
            {sheetUrl && <a href={sheetUrl} target="_blank" rel="noreferrer" className="btn btn-light"><ExternalLink size={16}/> Testar endereço</a>}
          </div>
          <small className="settings-hint">A configuração do <code>.env.local</code> continua sendo a fonte usada pelo sincronizador até a migração definitiva para as configurações do banco.</small>
        </div>

        <div className="settings-section">
          <div className="settings-title">
            <Palette size={22} />
            <div><h2>Identidade visual</h2><p>Cores oficiais usadas como referência nos painéis e documentos.</p></div>
          </div>
          <div className="color-grid">
            <label>Cor principal<div className="color-input"><input type="color" name="primary_color" defaultValue={settings.primary_color || '#f15a24'} /><input name="primary_color_text" defaultValue={settings.primary_color || '#f15a24'} /></div></label>
            <label>Cor secundária<div className="color-input"><input type="color" name="secondary_color" defaultValue={settings.secondary_color || '#353638'} /><input name="secondary_color_text" defaultValue={settings.secondary_color || '#353638'} /></div></label>
          </div>
        </div>

        <button className="btn btn-primary settings-save" type="submit"><Save size={17}/> Salvar configurações</button>
      </form>

      <section className="settings-bottom-grid">
        <div className="card settings-info">
          <DatabaseBackup size={24}/><div><h2>Backup do banco</h2><p>O backup é administrado no Supabase em <b>Database → Backups</b>. Antes de mudanças estruturais, gere um backup ou uma branch.</p></div>
        </div>
        <div className="card settings-info">
          <ShieldCheck size={24}/><div><h2>Proteção de credenciais</h2><p>Nunca publique o <code>.env.local</code>, a chave <code>service_role</code> ou senhas no GitHub, em prints ou em mensagens.</p></div>
        </div>
      </section>
    </AppShell>
  );
}
