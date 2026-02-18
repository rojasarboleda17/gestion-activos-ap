import { useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { SaleForm, VoidForm } from "@/hooks/vehicle/types";

interface UseVehicleSalesMutationsParams {
  vehicleId: string;
  orgId?: string;
  userId?: string;
  refetch: () => Promise<void>;
  onRefresh?: () => void;
}

export function useVehicleSalesMutations({
  vehicleId,
  orgId,
  userId,
  refetch,
  onRefresh,
}: UseVehicleSalesMutationsParams) {
  const createDirectSale = useCallback(async (saleForm: SaleForm) => {
    if (!orgId || !userId) return false;

    const finalPrice = parseInt(saleForm.final_price_cop, 10);
    if (!saleForm.customer_id) {
      toast.error("Selecciona un cliente");
      return false;
    }
    if (!saleForm.final_price_cop || Number.isNaN(finalPrice) || finalPrice <= 0) {
      toast.error("El precio final debe ser mayor a 0");
      return false;
    }
    if (!saleForm.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return false;
    }

    try {
      logger.debug("[VehicleSalesTab] Creating direct sale...");
      const { data, error } = await supabase
        .from("sales")
        .insert({
          org_id: orgId,
          vehicle_id: vehicleId,
          customer_id: saleForm.customer_id,
          final_price_cop: finalPrice,
          payment_method_code: saleForm.payment_method_code,
          status: "active",
          created_by: userId,
          notes: saleForm.notes?.trim() || null,
        })
        .select()
        .single();

      if (error) {
        logger.error("[VehicleSalesTab] Sale error:", error);
        toast.error(`Error: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
        return false;
      }

      if (!data) {
        toast.error("Error: No se creó la venta");
        return false;
      }

      await supabase.rpc("mark_vehicle_sold", {
        p_vehicle_id: vehicleId,
        p_sale_id: data.id,
      });

      toast.success("Venta registrada");
      await refetch();
      onRefresh?.();
      return true;
    } catch (err: unknown) {
      logger.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
      return false;
    }
  }, [orgId, onRefresh, refetch, userId, vehicleId]);

  const voidSale = useCallback(async (saleId: string | null, voidForm: VoidForm) => {
    if (!saleId || !orgId || !userId) return false;

    if (!voidForm.void_reason.trim()) {
      toast.error("El motivo es requerido");
      return false;
    }

    try {
      logger.debug("[VehicleSalesTab] Voiding sale:", saleId);
      const { error, data } = await supabase
        .from("sales")
        .update({
          status: "voided",
          void_reason: voidForm.void_reason.trim(),
          voided_at: new Date().toISOString(),
          voided_by: userId,
          return_stage_code: voidForm.return_stage_code,
        })
        .eq("id", saleId)
        .select();

      if (error) {
        logger.error("[VehicleSalesTab] Void error:", error);
        toast.error(`Error: ${error.message}`);
        return false;
      }

      if (!data?.length) {
        toast.error("Error: No se anuló la venta");
        return false;
      }

      await supabase.rpc("transition_vehicle_stage", {
        p_vehicle_id: vehicleId,
        p_target_stage: voidForm.return_stage_code,
      });

      const refundAmount = parseInt(voidForm.refund_amount, 10);
      if (voidForm.refund_amount && !Number.isNaN(refundAmount) && refundAmount > 0 && voidForm.refund_method) {
        await supabase.from("sale_payments").insert({
          org_id: orgId,
          sale_id: saleId,
          amount_cop: refundAmount,
          direction: "out",
          payment_method_code: voidForm.refund_method,
          notes: "Reembolso por anulación",
          created_by: userId,
        });
      }

      toast.success("Venta anulada");
      await refetch();
      onRefresh?.();
      return true;
    } catch (err: unknown) {
      logger.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
      return false;
    }
  }, [orgId, onRefresh, refetch, userId, vehicleId]);

  return {
    createDirectSale,
    voidSale,
  };
}
