"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CheckCircle2, Clock3, MapPin, Navigation, NotebookPen, Settings, Trash2, X, XCircle } from "lucide-react";

type Visit = {
  id: string; status: string; started_at: string; finished_at: string | null;
  outcome: string | null; outcome_code?: string | null; order_id?: string | null; proposal_id?: string | null;
  notes: string | null; next_action: string | null; next_contact_at: string | null;
  start_latitude: number | string | null; start_longitude: number | string | null;
};
type Photo = { id: string; caption: string | null; created_at: string; signed_url: string | null; file_name: string };
type Props = { customerId: string; visits: Visit[]; photos: Photo[] };
type Position = { latitude: number; longitude: number; accuracy: number };
type GeoFailure = { code: "unsupported" | "permission_denied" | "position_unavailable" | "timeout" | "unknown"; message: string };
type GpsPhase = "start-info" | "start-fallback" | "finish-fallback" | null;

const gpsReasonOptions = [
  ["gps_desligado", "GPS/localização desligado"],
  ["permissao_bloqueada", "Permissão bloqueada no aparelho"],
  ["sem_sinal", "Sem sinal ou localização indisponível"],
  ["endereco_diferente", "Atendimento em endereço diferente"],
  ["problema_aparelho", "Problema no aparelho"],
  ["outro", "Outro"],
] as const;

function geoFailure(error?: GeolocationPositionError): GeoFailure {
  if (!navigator.geolocation) return { code: "unsupported", message: "Este aparelho ou navegador não oferece suporte à localização." };
  if (!error) return { code: "unknown", message: "Não foi possível identificar a localização." };
  if (error.code === error.PERMISSION_DENIED) return { code: "permission_denied", message: "A localização está bloqueada. Libere a permissão do site/app nas configurações do aparelho." };
  if (error.code === error.POSITION_UNAVAILABLE) return { code: "position_unavailable", message: "A localização está indisponível. Ative o GPS e tente novamente em um local com sinal." };
  if (error.code === error.TIMEOUT) return { code: "timeout", message: "O GPS demorou para responder. Aguarde alguns segundos e tente novamente." };
  return { code: "unknown", message: error.message || "Não foi possível identificar a localização." };
}

function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(geoFailure());
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => reject(geoFailure(e)),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function VisitManager({ customerId, visits, photos }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState(""); const [outcomeCode, setOutcomeCode] = useState("");
  const [orderId, setOrderId] = useState(""); const [proposalId, setProposalId] = useState("");
  const [notes, setNotes] = useState(""); const [nextAction, setNextAction] = useState(""); const [nextContactAt, setNextContactAt] = useState("");
  const [noteText, setNoteText] = useState(""); const [caption, setCaption] = useState("");
  const [gpsPhase, setGpsPhase] = useState<GpsPhase>(null); const [gpsFailure, setGpsFailure] = useState<GeoFailure | null>(null);
  const [gpsReason, setGpsReason] = useState(""); const [gpsDetails, setGpsDetails] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const openVisit = useMemo(() => visits.find(v => v.status === "em_andamento") || null, [visits]);

  async function api(url: string, options: RequestInit) {
    setBusy(true); setError(null); setMessage(null);
    try { const response = await fetch(url, options); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação."); return result; }
    finally { setBusy(false); }
  }

  function resetGpsModal() { setGpsPhase(null); setGpsFailure(null); setGpsReason(""); setGpsDetails(""); }
  function showGpsHelp() { alert("Android/Chrome: toque no cadeado ou controles ao lado do endereço > Permissões > Localização > Permitir.\n\niPhone/Safari: Ajustes > Privacidade e Segurança > Serviços de Localização > Safari Sites > Durante o Uso."); }

  async function saveStart(position: Position | null, fallback?: { reason: string; details: string; failure: GeoFailure | null }) {
    await api("/api/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "start", customer_id: customerId,
      latitude: position?.latitude ?? null, longitude: position?.longitude ?? null, accuracy: position?.accuracy ?? null,
      gps_error_code: fallback?.failure?.code ?? null, without_gps_reason: fallback?.reason ?? null, without_gps_details: fallback?.details ?? null,
    }) });
    setMessage(position ? "Visita iniciada com localização registrada." : "Visita iniciada sem GPS, com justificativa registrada para o administrador.");
    resetGpsModal(); router.refresh();
  }

  async function requestStartGps() {
    setBusy(true); setError(null);
    try { const position = await getPosition(); setBusy(false); await saveStart(position); }
    catch (cause) { setBusy(false); const failure = cause as GeoFailure; setGpsFailure(failure); setGpsPhase("start-fallback"); }
  }

  async function finishWithPosition(action: "finish" | "cancel", position: Position | null, fallback?: { reason: string; details: string; failure: GeoFailure | null }) {
    if (!openVisit) return;
    await api(`/api/visits/${openVisit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action, latitude: position?.latitude ?? null, longitude: position?.longitude ?? null, accuracy: position?.accuracy ?? null,
      gps_error_code: fallback?.failure?.code ?? null, without_gps_reason: fallback?.reason ?? null, without_gps_details: fallback?.details ?? null,
      outcome, outcome_code: outcomeCode || null, order_id: orderId || null, proposal_id: proposalId || null, notes, next_action: nextAction,
      next_contact_at: nextContactAt ? new Date(nextContactAt).toISOString() : null,
    }) });
    setOutcome(""); setOutcomeCode(""); setOrderId(""); setProposalId(""); setNotes(""); setNextAction(""); setNextContactAt("");
    setMessage(action === "finish" ? (position ? "Visita concluída com GPS final registrado." : "Visita concluída sem GPS final, com justificativa registrada.") : "Visita cancelada.");
    resetGpsModal(); router.refresh();
  }

  async function finishVisit(action: "finish" | "cancel") {
    if (!openVisit) return;
    if (action === "cancel") { try { await finishWithPosition("cancel", null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível cancelar a visita."); } return; }
    setBusy(true); setError(null);
    try { const position = await getPosition(); setBusy(false); await finishWithPosition("finish", position); }
    catch (cause) { setBusy(false); setGpsFailure(cause as GeoFailure); setGpsPhase("finish-fallback"); }
  }

  async function continueWithoutGps() {
    if (!gpsReason) { setError("Selecione o motivo para continuar sem GPS."); return; }
    if (gpsReason === "outro" && gpsDetails.trim().length < 5) { setError("Descreva o motivo para continuar sem GPS."); return; }
    try {
      const fallback = { reason: gpsReason, details: gpsDetails.trim(), failure: gpsFailure };
      if (gpsPhase === "start-fallback") await saveStart(null, fallback);
      if (gpsPhase === "finish-fallback") await finishWithPosition("finish", null, fallback);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a justificativa."); }
  }

  async function retryGps() { if (gpsPhase === "start-fallback") await requestStartGps(); else if (gpsPhase === "finish-fallback") { setGpsPhase(null); await finishVisit("finish"); } }

  async function addNote() {
    if (!noteText.trim()) return;
    try { let position: Position | null = null; try { position = await getPosition(); } catch {}
      await api("/api/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", customer_id: customerId, notes: noteText, outcome: "Observação comercial", latitude: position?.latitude ?? null, longitude: position?.longitude ?? null, accuracy: position?.accuracy ?? null }) });
      setNoteText(""); setMessage("Observação registrada."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar a observação."); }
  }

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const file = form.get("file");
    if (!(file instanceof File) || !file.size) { setError("Selecione uma foto."); return; }
    form.set("customer_id", customerId); if (openVisit) form.set("visit_id", openVisit.id); form.set("caption", caption);
    try { await api("/api/customer-photos", { method: "POST", body: form }); setCaption(""); formRef.current?.reset(); setMessage("Foto enviada com sucesso."); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível enviar a foto."); }
  }
  async function removePhoto(id: string) { if (!confirm("Excluir esta foto da empresa?")) return; try { await api(`/api/customer-photos/${id}`, { method: "DELETE" }); setMessage("Foto excluída."); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir a foto."); } }

  return <>
    {(message || error) && <div className={error ? "alert error" : "alert success"}>{error || message}</div>}

    <div className="company360-grid two visit-grid">
      <section className="card visit-control">
        <div className="card-title"><div><h2>Visita comercial</h2><p>Registre presença, localização, resultado e próximo passo.</p></div><Navigation /></div>
        {!openVisit ? <button className="btn btn-primary visit-main-button" onClick={() => { setError(null); setGpsPhase("start-info"); }} disabled={busy}><MapPin size={18}/>Iniciar visita com GPS</button> : <>
          <div className="visit-running"><span className="pulse-dot"/><div><b>Visita em andamento</b><small>Iniciada em {dateTime.format(new Date(openVisit.started_at))}</small></div></div>
          <div className="form-grid two">
            <label>Resultado padronizado<select value={outcomeCode} onChange={e=>setOutcomeCode(e.target.value)} required><option value="">Selecione...</option><option value="pedido_realizado">Pedido realizado</option><option value="proposta_enviada">Proposta enviada</option><option value="cliente_interessado">Cliente interessado</option><option value="retornar_depois">Retornar depois</option><option value="sem_interesse">Sem interesse</option><option value="cliente_fechado">Cliente fechado</option><option value="nao_localizado">Cliente não localizado</option><option value="sem_contato_responsavel">Sem contato com responsável</option><option value="outro">Outro</option></select></label>
            <label>Resumo do resultado<input value={outcome} onChange={e=>setOutcome(e.target.value)} placeholder="Ex.: Pedido encaminhado, cliente interessado"/></label>
            <label>Próximo contato<input type="datetime-local" value={nextContactAt} onChange={e=>setNextContactAt(e.target.value)}/></label>
            <label className="full">Observações<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} placeholder="Resumo da conversa, produtos apresentados e necessidades do cliente"/></label>
            <label>ID do pedido relacionado (opcional)<input value={orderId} onChange={e=>setOrderId(e.target.value)} placeholder="UUID do pedido"/></label>
            <label>ID da proposta relacionada (opcional)<input value={proposalId} onChange={e=>setProposalId(e.target.value)} placeholder="UUID da proposta"/></label>
            <label className="full">Próxima ação<input value={nextAction} onChange={e=>setNextAction(e.target.value)} placeholder="Ex.: Enviar proposta da linha Shoei amanhã"/></label>
          </div>
          <div className="button-row"><button className="btn btn-primary" onClick={()=>finishVisit("finish")} disabled={busy || !outcomeCode}><CheckCircle2 size={17}/>{busy ? "Localizando..." : "Concluir visita"}</button><button className="btn danger" onClick={()=>finishVisit("cancel")} disabled={busy}><XCircle size={17}/>Cancelar</button></div>
        </>}
      </section>

      <section className="card"><div className="card-title"><div><h2>Observação rápida</h2><p>Registre uma informação sem iniciar uma visita completa.</p></div><NotebookPen/></div><textarea className="quick-note" value={noteText} onChange={e=>setNoteText(e.target.value)} rows={7} placeholder="Ex.: Cliente pediu retorno quando chegar reposição Cardo..."/><button className="btn" onClick={addNote} disabled={busy || !noteText.trim()}>Salvar observação</button></section>
    </div>

    <section className="card photo-section"><div className="card-title"><div><h2>Fotos da loja</h2><p>Use a câmera do celular ou selecione imagens. Limite de 10 MB por foto.</p></div><Camera/></div><form ref={formRef} className="photo-upload" onSubmit={uploadPhoto}><label>Foto<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" required/></label><label>Legenda<input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Ex.: Fachada, exposição Shoei, estoque da loja"/></label><button className="btn btn-primary" disabled={busy}><Camera size={17}/>Enviar foto</button></form>{!photos.length ? <div className="empty">Nenhuma foto registrada.</div> : <div className="photo-gallery">{photos.map(photo=><article key={photo.id} className="photo-card">{photo.signed_url ? <a href={photo.signed_url} target="_blank"><img src={photo.signed_url} alt={photo.caption || photo.file_name}/></a> : <div className="photo-placeholder">Imagem indisponível</div>}<div><b>{photo.caption || "Foto da loja"}</b><small>{dateTime.format(new Date(photo.created_at))}</small></div><button type="button" className="icon-danger" onClick={()=>removePhoto(photo.id)} aria-label="Excluir foto"><Trash2 size={16}/></button></article>)}</div>}</section>

    <section className="card visit-history"><div className="card-title"><div><h2>Histórico de visitas</h2><p>{visits.length} registro(s) comercial(is).</p></div><Clock3/></div>{!visits.length ? <div className="empty">Nenhuma visita registrada.</div> : <div className="visit-history-list">{visits.map(visit=><article key={visit.id}><span className={`visit-status ${visit.status}`}>{visit.status.replaceAll("_", " ")}</span><div><b>{visit.outcome || (visit.status === "em_andamento" ? "Visita em andamento" : "Registro comercial")}</b><p>{visit.notes || "Sem observações."}</p>{visit.next_action&&<small>Próxima ação: {visit.next_action}</small>}</div><div className="visit-meta"><strong>{dateTime.format(new Date(visit.started_at))}</strong>{visit.start_latitude&&visit.start_longitude&&<a href={`https://www.google.com/maps?q=${visit.start_latitude},${visit.start_longitude}`} target="_blank">Ver no mapa</a>}</div></article>)}</div>}</section>

    {gpsPhase && <div className="gps-modal-backdrop" role="dialog" aria-modal="true"><div className="gps-modal">
      <button className="gps-modal-close" onClick={resetGpsModal} aria-label="Fechar"><X size={20}/></button>
      {gpsPhase === "start-info" ? <>
        <div className="gps-modal-icon"><MapPin size={28}/></div><h2>Registrar localização da visita</h2><p>Ao continuar, o celular solicitará acesso ao GPS. A localização será registrada somente no início e no término da visita, junto com horário e precisão.</p><div className="gps-privacy-note"><CheckCircle2 size={18}/>Não há rastreamento contínuo do vendedor.</div><button className="btn btn-primary gps-modal-main" onClick={requestStartGps} disabled={busy}>{busy ? "Obtendo localização..." : "Permitir localização e iniciar"}</button><button className="btn" onClick={showGpsHelp}><Settings size={17}/>Como liberar o GPS</button>
      </> : <>
        <div className="gps-modal-icon warning"><AlertTriangle size={28}/></div><h2>Não foi possível registrar o GPS</h2><p>{gpsFailure?.message}</p><button className="btn btn-primary gps-modal-main" onClick={retryGps} disabled={busy}>{busy ? "Tentando..." : "Tentar novamente"}</button><button className="btn" onClick={showGpsHelp}><Settings size={17}/>Como liberar o GPS</button><div className="gps-fallback"><h3>Continuar excepcionalmente sem GPS</h3><p>O motivo ficará visível no relatório do administrador.</p><label>Motivo<select value={gpsReason} onChange={e=>setGpsReason(e.target.value)}><option value="">Selecione...</option>{gpsReasonOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Detalhes<textarea rows={3} value={gpsDetails} onChange={e=>setGpsDetails(e.target.value)} placeholder="Explique brevemente o ocorrido"/></label><button className="btn danger gps-modal-main" onClick={continueWithoutGps} disabled={busy || !gpsReason}>Continuar sem GPS e registrar justificativa</button></div>
      </>}
    </div></div>}
  </>;
}
