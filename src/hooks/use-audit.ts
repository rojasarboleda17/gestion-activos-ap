import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { useCallback } from "react";
import { logger } from "@/lib/logger";

type AuditAction =
  | "stage_change"
  | "vehicle_archive_toggle"
  | "vehicle_delete"
  | "vehicle_quick_edit"
  | "vehicle_info_update"
  | "work_order_create"
  | "work_order_close"
  | "work_order_item_status"
  | "expense_create"
  | "reservation_create"
  | "reservation_cancel"
  | "reservation_convert"
  | "sale_create"
  | "sale_void"
  | "file_upload"
  | "file_delete"
  | "payment_create"
  | "customer_create"
  | "customer_update";

type AuditEntity =
  | "vehicle"
  | "work_order"
  | "work_order_item"
  | "vehicle_expense"
  | "reservation"
  | "sale"
  | "sale_payment"
  | "vehicle_file"
  | "deal_document"
  | "customer";

interface AuditPayload {
  action: AuditAction;
  entity: AuditEntity;
  entity_id?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Hook para registrar acciones en audit_log
 * Se usa para instrumentar acciones críticas en el sistema
 */
export function useAudit() {
  const { profile } = useAuth();

  const log = useCallback(
    async ({ action, entity, entity_id, payload = {} }: AuditPayload) => {
      if (!profile?.org_id || !profile?.id) {
        logger.warn("[Audit] No profile/org_id, skipping audit log");
        return;
      }

      try {
        const { error } = await supabase.from("audit_log").insert({
          org_id: profile.org_id,
          actor_id: profile.id,
          action,
          entity,
          entity_id: entity_id || null,
          payload,
        });

        if (error) {
          logger.error("[Audit] Error inserting audit log:", error.message, error.details);
        } else {
          logger.debug(`[Audit] ${action} on ${entity}`, { entity_id, payload });
        }
      } catch (err) {
        logger.error("[Audit] Exception:", err);
      }
    },
    [profile?.org_id, profile?.id]
  );

  return { log };
}

/**
 * Utility function for logging audits outside of React components
 * Requires org_id and actor_id to be passed explicitly
 */
export async function logAudit({
  org_id,
  actor_id,
  action,
  entity,
  entity_id,
  payload = {},
}: {
  org_id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    const { error } = await supabase.from("audit_log").insert({
      org_id,
      actor_id,
      action,
      entity,
      entity_id: entity_id || null,
      payload,
    });

    if (error) {
      logger.error("[Audit] Error inserting audit log:", error.message, error.details);
    } else {
      logger.debug(`[Audit] ${action} on ${entity}`, { entity_id, payload });
    }
  } catch (err) {
    logger.error("[Audit] Exception:", err);
  }
}
