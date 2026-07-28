import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const db = adminClient();
    const { error } = await db.from("app_settings").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      version: "2.9.4",
      response_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        version: "2.9.4",
        message: error instanceof Error ? error.message : "Falha desconhecida",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
