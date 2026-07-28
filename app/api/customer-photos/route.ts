import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/supabase-server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "cliente") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    const form = await request.formData();
    const customerId = String(form.get("customer_id") || "");
    const visitId = String(form.get("visit_id") || "").trim() || null;
    const caption = String(form.get("caption") || "").trim() || null;
    const file = form.get("file");
    if (!customerId) throw new Error("Empresa não informada.");
    if (!(file instanceof File)) throw new Error("Selecione uma imagem.");
    if (file.size > MAX_FILE_SIZE) throw new Error("A imagem deve ter no máximo 10 MB.");
    if (!allowedTypes.has(file.type)) throw new Error("Formato de imagem não permitido.");

    const db = adminClient();
    let customerQuery = db.from("customers").select("id,seller_id").eq("id", customerId);
    if (profile.role === "vendedor") customerQuery = customerQuery.eq("seller_id", profile.id);
    const { data: customer } = await customerQuery.maybeSingle();
    if (!customer) throw new Error("Empresa não encontrada ou fora da sua carteira.");

    if (visitId) {
      const { data: visit } = await db.from("customer_visits").select("id,customer_id").eq("id", visitId).eq("customer_id", customerId).maybeSingle();
      if (!visit) throw new Error("A visita selecionada não pertence à empresa.");
    }

    const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const storagePath = `${customerId}/${new Date().getFullYear()}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await db.storage.from("customer-photos").upload(storagePath, buffer, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: photo, error: photoError } = await db.from("customer_photos").insert({
      customer_id: customerId,
      visit_id: visitId,
      uploaded_by: profile.id,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      caption,
    }).select().single();

    if (photoError) {
      await db.storage.from("customer-photos").remove([storagePath]);
      throw new Error(photoError.message);
    }

    const { data: signed } = await db.storage.from("customer-photos").createSignedUrl(storagePath, 3600);
    return NextResponse.json({ ...photo, signed_url: signed?.signedUrl || null }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível enviar a foto." }, { status: 400 });
  }
}
