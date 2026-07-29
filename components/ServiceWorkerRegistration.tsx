"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

type UpdateState = "hidden" | "available" | "blocked" | "updating";

export default function ServiceWorkerRegistration() {
  const [state, setState] = useState<UpdateState>("hidden");
  const waitingWorker = useRef<ServiceWorker | null>(null);
  const dirtyRef = useRef(false);
  const reloadingRef = useRef(false);

  const applyUpdate = useCallback(() => {
    const worker = waitingWorker.current;
    if (!worker) return;

    if (dirtyRef.current) {
      setState("blocked");
      return;
    }

    setState("updating");
    worker.postMessage({ type: "SKIP_WAITING" });
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    const markDirty = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) dirtyRef.current = true;
    };
    const markSafeAfterSubmit = () => {
      window.setTimeout(() => { dirtyRef.current = false; }, 1200);
    };

    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("submit", markSafeAfterSubmit, true);

    let registration: ServiceWorkerRegistration | null = null;
    let intervalId: number | undefined;

    const offerUpdate = (worker: ServiceWorker | null) => {
      if (!worker) return;
      waitingWorker.current = worker;
      setState(dirtyRef.current ? "blocked" : "available");
    };

    const inspectInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        offerUpdate(registration.waiting);
        inspectInstallingWorker(registration.installing);
        registration.addEventListener("updatefound", () => inspectInstallingWorker(registration?.installing || null));

        const check = () => registration?.update().catch(() => undefined);
        intervalId = window.setInterval(check, 30 * 60 * 1000);
        window.addEventListener("focus", check);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
          if (document.visibilityState === "hidden" && waitingWorker.current && !dirtyRef.current) applyUpdate();
        });
      } catch (error) {
        console.error("Falha ao registrar a PWA:", error);
      }
    };

    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    register();

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("submit", markSafeAfterSubmit, true);
    };
  }, [applyUpdate]);

  if (state === "hidden") return null;

  const forceAfterConfirmation = () => {
    if (state === "blocked") {
      const confirmed = window.confirm("Existem dados ainda não enviados nesta tela. Atualizar agora pode descartá-los. Deseja continuar?");
      if (!confirmed) return;
      dirtyRef.current = false;
    }
    applyUpdate();
  };

  return (
    <aside className="pwa-update" role="status" aria-live="polite">
      <div className="pwa-update-icon"><RefreshCw size={20} className={state === "updating" ? "spin" : ""}/></div>
      <div className="pwa-update-copy">
        <strong>{state === "blocked" ? "Atualização aguardando" : state === "updating" ? "Atualizando aplicativo" : "Nova versão disponível"}</strong>
        <span>{state === "blocked" ? "Conclua ou salve o que está preenchendo antes de atualizar." : state === "updating" ? "A página será recarregada em instantes." : "Atualize para usar a versão mais recente e evitar arquivos antigos."}</span>
      </div>
      {state !== "updating" && <button className="pwa-update-button" onClick={forceAfterConfirmation}>Atualizar agora</button>}
      {state !== "updating" && <button className="pwa-update-close" onClick={() => setState("hidden")} aria-label="Lembrar depois"><X size={18}/></button>}
    </aside>
  );
}
