import { NextResponse } from "next/server";
import { z } from "zod";
import { adminClient } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/supabase-server";

const coordinate = z.number().finite().min(-180).max(180).nullable().optional();
const startSchema = z.object({
  action: z.enum(["start", "note"]),
  customer_id: z.string().uuid(),
  latitude: coordinate,
  longitude: coordinate,
  accuracy: z.number().finite().min(0).nullable().optional(),
  notes: z.string().max(3000).optional().nullable(),
  outcome: z.string().max(500).optional().nullable(),
  next_action: z.string().max(1000).optional().nullable(),
  next_contact_at: z.string().datetime().optional().nullable(),
});

async function allowedCustomer(customerId: string, profile: any) {
  const db = adminClient();
  let query = db.from("customers").select("id,seller_id,name,trade_name").eq("id", customerId);
  if (profile.role === "vendedor") query = query.eq("seller_id", profile.id);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Empresa não encontrada ou fora da sua carteira.");
  return data;
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "cliente") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const parsed = startSchema.parse(await request.json());
    const customer = await allowedCustomer(parsed.customer_id, profile);
    const db = adminClient();
    const sellerId = profile.role === "vendedor" ? profile.id : customer.seller_id || profile.id;
    const now = new Date().toISOString();

    if (parsed.action === "start") {
      const { data: openVisit } = await db
        .from("customer_visits")
        .select("id")
        .eq("customer_id", parsed.customer_id)
        .eq("created_by", profile.id)
        .eq("status", "em_andamento")
        .maybeSingle();
      if (openVisit) throw new Error("Já existe uma visita em andamento para esta empresa.");

      const { data, error } = await db.from("customer_visits").insert({
        customer_id: parsed.customer_id,
        seller_id: sellerId,
        created_by: profile.id,
        started_at: now,
        start_latitude: parsed.latitude ?? null,
        start_longitude: parsed.longitude ?? null,
        accuracy_meters: parsed.accuracy ?? null,
        notes: parsed.notes?.trim() || null,
        status: "em_andamento",
        updated_at: now,
      }).select().single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data, { status: 201 });
    }

    const { data, error } = await db.from("customer_visits").insert({
      customer_id: parsed.customer_id,
      seller_id: sellerId,
      created_by: profile.id,
      started_at: now,
      finished_at: now,
      start_latitude: parsed.latitude ?? null,
      start_longitude: parsed.longitude ?? null,
      end_latitude: parsed.latitude ?? null,
      end_longitude: parsed.longitude ?? null,
      accuracy_meters: parsed.accuracy ?? null,
      notes: parsed.notes?.trim() || null,
      outcome: parsed.outcome?.trim() || "Observação comercial",
      next_action: parsed.next_action?.trim() || null,
      next_contact_at: parsed.next_contact_at || null,
      status: "concluida",
      updated_at: now,
    }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível registrar a visita." }, { status: 400 });
  }
}
