import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/supabase-server";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "cliente") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    const { id } = await params;
    const db = adminClient();
    let query = db.from("customer_photos").select("id,storage_path,customer_id,customers!inner(seller_id)").eq("id", id);
    const { data: photo, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!photo) throw new Error("Foto não encontrada.");
    const sellerId = (photo.customers as any)?.seller_id;
    if (profile.role === "vendedor" && sellerId !== profile.id) throw new Error("Acesso negado.");

    const { error: storageError } = await db.storage.from("customer-photos").remove([photo.storage_path]);
    if (storageError) throw new Error(storageError.message);
    const { error: deleteError } = await db.from("customer_photos").delete().eq("id", id);
    if (deleteError) throw new Error(deleteError.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível excluir a foto." }, { status: 400 });
  }
}
