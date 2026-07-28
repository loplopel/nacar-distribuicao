import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase-admin";

type ProductInput = {
  source_key: string;
  plu: string;
  ean: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  status: string;
  suggested_price: number;
  cost_price: number;
  minimum_price: number;
  stock: number;
  image_url: string | null;
  active: boolean;
  updated_at: string;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = []; value = "";
    } else value += char;
  }
  if (value.length || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function cleanText(value: string): string { return value.trim().replace(/\s+/g, " "); }
function money(value: string): number {
  const clean = value.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!clean) return 0;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
function integer(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}
function sourceKey(plu: string, ean: string | null, size: string | null): string {
  return ean ? `EAN:${ean}` : `PLU:${plu}|TAMANHO:${size || "SEM-TAMANHO"}`;
}

export async function POST() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const configuredUrl = process.env.GOOGLE_SHEET_CSV_URL?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  if (!configuredUrl) return NextResponse.redirect(new URL("/admin/produtos?error=url", appUrl), 303);

  const client = adminClient();
  const startedAt = new Date();
  const { data: log } = await client.from("sync_logs").insert({ started_at: startedAt.toISOString(), status: "running", created_by: profile.id }).select("id").single();

  try {
    const response = await fetch(configuredUrl, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0", Accept: "text/csv,text/plain,*/*" } });
    if (!response.ok) throw new Error(`A planilha respondeu com status ${response.status}. URL utilizada: ${configuredUrl}`);

    const rows = parseCsv((await response.text()).replace(/^\uFEFF/, ""));
    const headers = (rows.shift() ?? []).map(normalize);
    const column = (...names: string[]) => headers.findIndex((header) => names.map(normalize).includes(header));
    const read = (row: string[], ...names: string[]) => { const i = column(...names); return i >= 0 ? cleanText(row[i] ?? "") : ""; };

    const required = [["PLU"],["Produto"],["EAN"],["Nome"],["Marca"],["Tamanho"],["Status"],["Preço Sugerido","Preco Sugerido"],["Preço de custo","Preco de custo"],["Estoque"],["Imagem"]];
    const missing = required.filter((names) => column(...names) < 0).map((names) => names[0]);
    if (missing.length) throw new Error(`Colunas não encontradas: ${missing.join(", ")}.`);

    const now = new Date().toISOString();
    const parsed = rows.map((row): ProductInput => {
      const plu = read(row, "PLU");
      const ean = read(row, "EAN") || null;
      const size = read(row, "Tamanho") || null;
      return {
        source_key: sourceKey(plu, ean, size), plu, ean,
        category: read(row, "Produto") || null,
        name: read(row, "Nome"), brand: read(row, "Marca") || null, size,
        status: read(row, "Status") || "Consultar",
        suggested_price: money(read(row, "Preço Sugerido", "Preco Sugerido")),
        cost_price: money(read(row, "Preço de custo", "Preco de custo")),
        minimum_price: money(read(row, "Preço Mínimo Praticado", "Preço Minimo Praticado", "Preco Minimo Praticado")),
        stock: integer(read(row, "Estoque")), image_url: read(row, "Imagem") || null,
        active: true, updated_at: now,
      };
    }).filter((p) => p.plu && p.name && p.source_key);

    const products = Array.from(new Map(parsed.map((p) => [p.source_key, p])).values());
    if (!products.length) throw new Error("Nenhum produto válido foi localizado na planilha.");

    const { data: existingRows, error: existingError } = await client.from("products").select("source_key,active");
    if (existingError) throw existingError;
    const existing = new Map((existingRows || []).map((r) => [r.source_key as string, Boolean(r.active)]));
    const incomingKeys = new Set(products.map((p) => p.source_key));
    const created = products.filter((p) => !existing.has(p.source_key)).length;
    const updated = products.length - created;
    const disabled = [...existing.entries()].filter(([key, active]) => active && !incomingKeys.has(key)).length;

    const { error: deactivateError } = await client.from("products").update({ active: false, updated_at: now }).eq("active", true);
    if (deactivateError) throw deactivateError;

    for (let start = 0; start < products.length; start += 300) {
      const { error } = await client.from("products").upsert(products.slice(start, start + 300), { onConflict: "source_key" });
      if (error) throw error;
    }

    const brandNames = [...new Set(products.map((p) => p.brand).filter(Boolean))] as string[];
    if (brandNames.length) {
      await client.from("brands").upsert(brandNames.map((name, index) => ({ name, slug: normalize(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), display_order: index })), { onConflict: "name" });
    }

    const finishedAt = new Date();
    const duration = finishedAt.getTime() - startedAt.getTime();
    if (log?.id) await client.from("sync_logs").update({ finished_at: finishedAt.toISOString(), duration_ms: duration, products_read: products.length, products_created: created, products_updated: updated, products_disabled: disabled, status: "success" }).eq("id", log.id);

    const url = new URL("/admin/produtos", appUrl);
    url.searchParams.set("ok", "1"); url.searchParams.set("count", String(products.length));
    url.searchParams.set("created", String(created)); url.searchParams.set("updated", String(updated));
    url.searchParams.set("disabled", String(disabled)); url.searchParams.set("duration", String(duration));
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar o catálogo.";
    if (log?.id) await client.from("sync_logs").update({ finished_at: new Date().toISOString(), duration_ms: Date.now() - startedAt.getTime(), status: "error", error_message: message }).eq("id", log.id);
    const url = new URL("/admin/produtos", appUrl); url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  }
}
