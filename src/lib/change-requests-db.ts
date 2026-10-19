/**
 * =====================================================================
 * CHANGE REQUESTS, IN THE DATABASE.
 * ---------------------------------------------------------------------
 * SERVER ONLY, like src/lib/quote-requests-db.ts: every function reaches
 * for the service-role client, and /api/change-requests is the boundary.
 *
 * These used to live in one browser's localStorage, so they vanished when
 * site data was cleared and nobody but that browser ever saw them, and the
 * browser wrote the staff name itself. Now they are rows in
 * `change_requests` (first migration), and every name — the one who raised
 * it and the one who moved its status — comes from the staff session,
 * passed in by the route. Status moves go to `status_changes` like every
 * other record's.
 *
 * Two kinds are written: `new_item` and `stock`. The table also allows
 * `price`, which the app no longer drafts (prices are edited directly in
 * the price editor); a `price` row would simply not be listed.
 * =====================================================================
 */

import "server-only";
import { makeRef } from "@/lib/format";
import { BUSINESS_ID, getSupabaseServiceRoleClient } from "@/lib/supabase";
import type {
  ChangeRequest,
  ChangeRequestStatus,
  NewItemRequest,
  StockChangeRequest,
} from "@/types";

export const CHANGE_REQUEST_STATUSES: ChangeRequestStatus[] = ["draft", "sent"];

/** What the route has validated; the server adds ref, status, time and name. */
export type NewChangeRequestInput =
  | Pick<
      NewItemRequest,
      "kind" | "note" | "name" | "categoryId" | "otherCategory" | "proposedPriceKes" | "description" | "photoNeeded"
    >
  | Pick<StockChangeRequest, "kind" | "note" | "subjectId" | "subjectLabel" | "intent">;

const LIST_SELECT =
  "id, ref, kind, status, raised_by, note, created_at, subject_id, subject_label, " +
  "proposed_price_kes, item_name, category_id, other_category, description, photo_needed, intent, " +
  "status_changes(to_status, changed_by, changed_at)";

interface Row {
  id: string;
  ref: string;
  kind: string;
  status: ChangeRequestStatus;
  raised_by: string;
  note: string;
  created_at: string;
  subject_id: string | null;
  subject_label: string | null;
  proposed_price_kes: number | null;
  item_name: string | null;
  category_id: string | null;
  other_category: string | null;
  description: string | null;
  photo_needed: boolean | null;
  intent: "out_of_stock" | "back_in_stock" | null;
  status_changes?: { to_status: string; changed_by: string; changed_at: string }[] | null;
}

function toIso(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function toChangeRequest(row: Row): ChangeRequest | null {
  const history = (row.status_changes ?? [])
    .slice()
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    .map((change) => ({ to: change.to_status, by: change.changed_by, at: toIso(change.changed_at) }));
  const base = {
    ref: row.ref,
    status: row.status,
    createdAt: toIso(row.created_at),
    by: row.raised_by,
    note: row.note,
    ...(history.length > 0 ? { history } : {}),
  };
  if (row.kind === "new_item") {
    return {
      ...base,
      kind: "new_item",
      name: row.item_name ?? "",
      categoryId: (row.category_id ?? "other") as NewItemRequest["categoryId"],
      otherCategory: row.other_category ?? "",
      proposedPriceKes: row.proposed_price_kes ?? 0,
      description: row.description ?? "",
      photoNeeded: Boolean(row.photo_needed),
    };
  }
  if (row.kind === "stock") {
    return {
      ...base,
      kind: "stock",
      subjectId: row.subject_id ?? "",
      subjectLabel: row.subject_label ?? "",
      intent: row.intent ?? "out_of_stock",
    };
  }
  return null;
}

/** Newest first: a to-do list, the thing just drafted on top. */
export async function listChangeRequests(): Promise<ChangeRequest[]> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("change_requests")
    .select(LIST_SELECT)
    .eq("business_id", BUSINESS_ID)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listChangeRequests: ${error.message}`);
  return ((data ?? []) as unknown as Row[])
    .map(toChangeRequest)
    .filter((request): request is ChangeRequest => request !== null);
}

export type CreateChangeRequestResult =
  | { ok: true; ref: string }
  | { ok: false; reason: "ref_exhausted" }
  | { ok: false; reason: "db_error"; detail: string };

const REF_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";

/**
 * Writes one request as a draft. `by` is the name on the staff session —
 * never a value from a request body.
 */
export async function createChangeRequest(
  input: NewChangeRequestInput,
  by: string,
): Promise<CreateChangeRequestResult> {
  const db = getSupabaseServiceRoleClient();
  const fields =
    input.kind === "new_item"
      ? {
          item_name: input.name,
          category_id: input.categoryId,
          other_category: input.categoryId === "other" ? input.otherCategory : null,
          proposed_price_kes: input.proposedPriceKes,
          description: input.description,
          photo_needed: input.photoNeeded,
        }
      : { subject_id: input.subjectId, subject_label: input.subjectLabel, intent: input.intent };

  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const ref = makeRef("CR");
    const { error } = await db.from("change_requests").insert({
      business_id: BUSINESS_ID,
      ref,
      kind: input.kind,
      status: "draft",
      raised_by: by,
      note: input.note,
      ...fields,
    });
    if (!error) return { ok: true, ref };
    if (error.code === UNIQUE_VIOLATION) continue;
    return { ok: false, reason: "db_error", detail: error.message };
  }
  return { ok: false, reason: "ref_exhausted" };
}

export type UpdateChangeRequestStatusResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "db_error"; detail: string };

/** Moves draft <-> sent and records who did, in `status_changes`. */
export async function updateChangeRequestStatus(
  ref: string,
  status: ChangeRequestStatus,
  by: string,
): Promise<UpdateChangeRequestStatusResult> {
  const db = getSupabaseServiceRoleClient();
  const updated = await db
    .from("change_requests")
    .update({ status })
    .eq("business_id", BUSINESS_ID)
    .eq("ref", ref)
    .select("id")
    .maybeSingle();
  if (updated.error) return { ok: false, reason: "db_error", detail: updated.error.message };
  if (!updated.data) return { ok: false, reason: "not_found" };

  const history = await db.from("status_changes").insert({
    change_request_id: updated.data.id as string,
    to_status: status,
    // From the staff session (src/lib/staff-guard.ts), never a request body.
    changed_by: by,
  });
  if (history.error) return { ok: false, reason: "db_error", detail: history.error.message };
  return { ok: true };
}
