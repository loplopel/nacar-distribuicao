import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type ProductRow = {
  plu: string;
  ean: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  status: string;
  suggested_price: number;
  cost_price: number;
  stock: number;
  image_url: string | null;
  active: boolean;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }

  return rows;
}

function money(value: string): number {
  const normalized = value
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");

  const file = path.join(process.cwd(), "supabase", "products-seed.csv");
  if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);

  const rows = parseCsv(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  const headers = (rows.shift() ?? []).map((header) => header.trim().toLowerCase());
  const index = (name: string) => headers.indexOf(name);
  const read = (row: string[], name: string) => row[index(name)]?.trim() ?? "";

  const products: ProductRow[] = rows
    .map((row) => ({
      plu: read(row, "plu"),
      ean: read(row, "ean") || null,
      name: read(row, "name"),
      brand: read(row, "brand") || null,
      category: read(row, "category") || null,
      size: read(row, "size") || null,
      status: read(row, "status") || "Disponível",
      suggested_price: money(read(row, "suggested_price")),
      cost_price: money(read(row, "cost_price")),
      stock: Number(read(row, "stock")) || 0,
      image_url: read(row, "image_url") || null,
      active: !["false", "0", "não", "nao"].includes(read(row, "active").toLowerCase()),
    }))
    .filter((product) => product.plu && product.name);

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const batchSize = 300;

  for (let start = 0; start < products.length; start += batchSize) {
    const batch = products.slice(start, start + batchSize);
    const { error } = await supabase.from("products").upsert(batch, { onConflict: "plu" });
    if (error) throw error;
    console.log(`Importados ${Math.min(start + batch.length, products.length)} de ${products.length}`);
  }

  console.log(`Catálogo importado com sucesso: ${products.length} produtos.`);
}

main().catch((error) => {
  console.error("Erro ao importar produtos:");
  console.error(error);
  process.exit(1);
});
