import { NextResponse } from "next/server";
import { z } from "zod";
import { adminClient } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/supabase-server";

const finishSchema = z.object({
  action: z.enum(["finish", "cancel"]),
  latitude: z.number().finite().nullable().optional(),
  longitude: z.number().finite().nullable().optional(),
  outcome: z.string().max(500).optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
  next_action: z.string().max(1000).optional().nullable(),
  next_contact_at: z.string().datetime().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "cliente") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    const { id } = await params;
    const parsed = finishSchema.parse(await request.json());
    const db = adminClient();
    let query = db.from("customer_visits").select("id,seller_id,created_by,status").eq("id", id);
    if (profile.role === "vendedor") query = query.eq("seller_id", profile.id);
    const { data: visit, error: visitError } = await query.maybeSingle();
    if (visitError) throw new Error(visitError.message);
    if (!visit) throw new Error("Visita não encontrada.");
    if (visit.status !== "em_andamento") throw new Error("Esta visita já foi encerrada.");

    const now = new Date().toISOString();
    const payload = parsed.action === "cancel"
      ? { status: "cancelada", finished_at: now, notes: parsed.notes?.trim() || null, updated_at: now }
      : {
          status: "concluida",
          finished_at: now,
          end_latitude: parsed.latitude ?? null,
          end_longitude: parsed.longitude ?? null,
          outcome: parsed.outcome?.trim() || "Visita concluída",
          notes: parsed.notes?.trim() || null,
          next_action: parsed.next_action?.trim() || null,
          next_contact_at: parsed.next_contact_at || null,
          updated_at: now,
        };

    const { data, error } = await db.from("customer_visits").update(payload).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível encerrar a visita." }, { status: 400 });
  }
}
