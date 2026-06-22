import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

const uploadSchema = z.object({
  provider_id: z.string().uuid(),
  document_type: z.string(),
});

const requestSchema = z.object({
  provider_id: z.string().uuid(),
  action: z.literal("request_contracts"),
});

/** POST — initiate document upload (placeholder for storage integration). */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, uploadSchema);
  if (error) return error;

  const { data: doc, error: dbErr } = await supabaseAdmin
    .from("provider_documents")
    .upsert(
      {
        provider_id: data.provider_id,
        document_type: data.document_type,
        file_url: null,
        verified: false,
      },
      { onConflict: "provider_id,document_type", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (dbErr) {
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("provider_documents")
      .insert({
        provider_id: data.provider_id,
        document_type: data.document_type,
      })
      .select()
      .single();
    if (insertErr) return dbError(insertErr);
    return ok({ document: inserted, upload_url: null }, 201);
  }

  return ok({ document: doc, upload_url: null }, 201);
}

/** PATCH — request new contracts. */
export async function PATCH(req: NextRequest) {
  const { data, error } = await parseBody(req, requestSchema);
  if (error) return error;

  const { error: dbErr } = await supabaseAdmin.from("contracts").insert({
    provider_id: data.provider_id,
    contract_kind: "ica",
    status: "pending",
  });

  if (dbErr) return dbError(dbErr);
  return ok({ requested: true });
}
