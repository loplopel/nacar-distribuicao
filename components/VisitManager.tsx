"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Clock3, MapPin, Navigation, NotebookPen, Trash2, XCircle } from "lucide-react";

type Visit = {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  outcome: string | null;
  notes: string | null;
  next_action: string | null;
  next_contact_at: string | null;
  start_latitude: number | string | null;
  start_longitude: number | string | null;
};

type Photo = {
  id: string;
  caption: string | null;
  created_at: string;
  signed_url: string | null;
  file_name: string;
};

type Props = {
  customerId: string;
  visits: Visit[];
  photos: Photo[];
};

type Position = { latitude: number | null; longitude: number | null; accuracy: number | null };

function getPosition(): Promise<Position> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null, accuracy: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => resolve({ latitude: null, longitude: null, accuracy: null }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function VisitManager({ customerId, visits, photos }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextContactAt, setNextContactAt] = useState("");
  const [noteText, setNoteText] = useState("");
  const [caption, setCaption] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const openVisit = useMemo(() => visits.find((visit) => visit.status === "em_andamento") || null, [visits]);

  async function api(url: string, options: RequestInit) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(url, options);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function startVisit() {
    try {
      const position = await getPosition();
      await api("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", customer_id: customerId, ...position }),
      });
      setMessage(position.latitude ? "Visita iniciada com localização registrada." : "Visita iniciada sem localização. Confira a permissão do navegador.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a visita.");
    }
  }

  async function finishVisit(action: "finish" | "cancel") {
    if (!openVisit) return;
    try {
      const position = await getPosition();
      await api(`/api/visits/${openVisit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...position,
          outcome,
          notes,
          next_action: nextAction,
          next_contact_at: nextContactAt ? new Date(nextContactAt).toISOString() : null,
        }),
      });
      setOutcome(""); setNotes(""); setNextAction(""); setNextContactAt("");
      setMessage(action === "finish" ? "Visita concluída e registrada." : "Visita cancelada.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível encerrar a visita.");
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    try {
      const position = await getPosition();
      await api("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "note", customer_id: customerId, notes: noteText, outcome: "Observação comercial", ...position }),
      });
      setNoteText("");
      setMessage("Observação registrada.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a observação.");
    }
  }

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setError("Selecione uma foto.");
      return;
    }
    form.set("customer_id", customerId);
    if (openVisit) form.set("visit_id", openVisit.id);
    form.set("caption", caption);
    try {
      await api("/api/customer-photos", { method: "POST", body: form });
      setCaption("");
      formRef.current?.reset();
      setMessage("Foto enviada com sucesso.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a foto.");
    }
  }

  async function removePhoto(id: string) {
    if (!confirm("Excluir esta foto da empresa?")) return;
    try {
      await api(`/api/customer-photos/${id}`, { method: "DELETE" });
      setMessage("Foto excluída.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir a foto.");
    }
  }

  return <>
    {(message || error) && <div className={error ? "alert error" : "alert success"}>{error || message}</div>}

    <div className="company360-grid two visit-grid">
      <section className="card visit-control">
        <div className="card-title"><div><h2>Visita comercial</h2><p>Registre presença, localização, resultado e próximo passo.</p></div><Navigation /></div>
        {!openVisit ? <button className="btn btn-primary visit-main-button" onClick={startVisit} disabled={busy}><MapPin size={18}/>{busy ? "Localizando..." : "Iniciar visita com GPS"}</button> : <>
          <div className="visit-running"><span className="pulse-dot"/><div><b>Visita em andamento</b><small>Iniciada em {dateTime.format(new Date(openVisit.started_at))}</small></div></div>
          <div className="form-grid two">
            <label>Resultado da visita<input value={outcome} onChange={(e)=>setOutcome(e.target.value)} placeholder="Ex.: Pedido encaminhado, cliente interessado"/></label>
            <label>Próximo contato<input type="datetime-local" value={nextContactAt} onChange={(e)=>setNextContactAt(e.target.value)}/></label>
            <label className="full">Observações<textarea value={notes} onChange={(e)=>setNotes(e.target.value)} rows={4} placeholder="Resumo da conversa, produtos apresentados e necessidades do cliente"/></label>
            <label className="full">Próxima ação<input value={nextAction} onChange={(e)=>setNextAction(e.target.value)} placeholder="Ex.: Enviar proposta da linha Shoei amanhã"/></label>
          </div>
          <div className="button-row"><button className="btn btn-primary" onClick={()=>finishVisit("finish")} disabled={busy}><CheckCircle2 size={17}/>Concluir visita</button><button className="btn danger" onClick={()=>finishVisit("cancel")} disabled={busy}><XCircle size={17}/>Cancelar</button></div>
        </>}
      </section>

      <section className="card">
        <div className="card-title"><div><h2>Observação rápida</h2><p>Registre uma informação sem iniciar uma visita completa.</p></div><NotebookPen/></div>
        <textarea className="quick-note" value={noteText} onChange={(e)=>setNoteText(e.target.value)} rows={7} placeholder="Ex.: Cliente pediu retorno quando chegar reposição Cardo..."/>
        <button className="btn" onClick={addNote} disabled={busy || !noteText.trim()}>Salvar observação</button>
      </section>
    </div>

    <section className="card photo-section">
      <div className="card-title"><div><h2>Fotos da loja</h2><p>Use a câmera do celular ou selecione imagens. Limite de 10 MB por foto.</p></div><Camera/></div>
      <form ref={formRef} className="photo-upload" onSubmit={uploadPhoto}>
        <label>Foto<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" required/></label>
        <label>Legenda<input value={caption} onChange={(e)=>setCaption(e.target.value)} placeholder="Ex.: Fachada, exposição Shoei, estoque da loja"/></label>
        <button className="btn btn-primary" disabled={busy}><Camera size={17}/>Enviar foto</button>
      </form>
      {!photos.length ? <div className="empty">Nenhuma foto registrada.</div> : <div className="photo-gallery">{photos.map((photo)=><article key={photo.id} className="photo-card">
        {photo.signed_url ? <a href={photo.signed_url} target="_blank"><img src={photo.signed_url} alt={photo.caption || photo.file_name}/></a> : <div className="photo-placeholder">Imagem indisponível</div>}
        <div><b>{photo.caption || "Foto da loja"}</b><small>{dateTime.format(new Date(photo.created_at))}</small></div>
        <button type="button" className="icon-danger" onClick={()=>removePhoto(photo.id)} aria-label="Excluir foto"><Trash2 size={16}/></button>
      </article>)}</div>}
    </section>

    <section className="card visit-history">
      <div className="card-title"><div><h2>Histórico de visitas</h2><p>{visits.length} registro(s) comercial(is).</p></div><Clock3/></div>
      {!visits.length ? <div className="empty">Nenhuma visita registrada.</div> : <div className="visit-history-list">{visits.map((visit)=><article key={visit.id}>
        <span className={`visit-status ${visit.status}`}>{visit.status.replaceAll("_", " ")}</span>
        <div><b>{visit.outcome || (visit.status === "em_andamento" ? "Visita em andamento" : "Registro comercial")}</b><p>{visit.notes || "Sem observações."}</p>{visit.next_action&&<small>Próxima ação: {visit.next_action}</small>}</div>
        <div className="visit-meta"><strong>{dateTime.format(new Date(visit.started_at))}</strong>{visit.start_latitude&&visit.start_longitude&&<a href={`https://www.google.com/maps?q=${visit.start_latitude},${visit.start_longitude}`} target="_blank">Ver no mapa</a>}</div>
      </article>)}</div>}
    </section>
  </>;
}
