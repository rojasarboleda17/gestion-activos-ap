import { useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { ConvertForm, Reservation, ReservationForm } from "@/hooks/vehicle/types";

interface UseVehicleReservationMutationsParams {
  vehicleId: string;
  orgId?: string;
  userId?: string;
  defaultPaymentMethodCode?: string;
  refetch: () => Promise<void>;
  onRefresh?: () => void;
}


export function useVehicleReservationMutations({
  vehicleId,
  orgId,
  userId,
  defaultPaymentMethodCode,
  refetch,
  onRefresh,
}: UseVehicleReservationMutationsParams) {
  const createReservation = useCallback(async (form: ReservationForm) => {
    if (!orgId || !userId) return false;

    if (!form.customer_id) {
      toast.error("Selecciona un cliente");
      return false;
    }

    const depositAmount = parseInt(form.deposit_amount_cop, 10);
    if (!form.deposit_amount_cop || Number.isNaN(depositAmount) || depositAmount <= 0) {
      toast.error("El depósito debe ser mayor a 0");
      return false;
    }

    if (!form.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return false;
    }

    try {
      logger.debug("[VehicleSalesTab] Creating reservation...");
      const { data, error } = await supabase
        .from("reservations")
        .insert({
          org_id: orgId,
          vehicle_id: vehicleId,
          customer_id: form.customer_id,
          deposit_amount_cop: depositAmount,
          payment_method_code: form.payment_method_code,
          notes: form.notes?.trim() || null,
          status: "active",
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        logger.error("[VehicleSalesTab] Reservation error:", error);
        toast.error(`Error: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
        return false;
      }

      if (!data) {
        toast.error("Error: No se creó la reserva");
        return false;
      }

      await supabase.rpc("transition_vehicle_stage", {
        p_vehicle_id: vehicleId,
        p_target_stage: "bloqueado",
      });

      toast.success("Reserva creada");
      await refetch();
      onRefresh?.();
      return true;
    } catch (err: unknown) {
      logger.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
      return false;
    }
  }, [orgId, onRefresh, refetch, userId, vehicleId]);

  const cancelReservation = useCallback(async (reservationId: string | null, reason: string) => {
    if (!reservationId || !userId) return false;

    try {
      logger.debug("[VehicleSalesTab] Cancelling reservation:", reservationId);
      const { error, data } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          cancel_reason: reason?.trim() || null,
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
        })
        .eq("id", reservationId)
        .select();

      if (error) {
        logger.error("[VehicleSalesTab] Cancel error:", error);
        toast.error(`Error: ${error.message}`);
        return false;
      }

      if (!data?.length) {
        toast.error("Error: No se actualizó la reserva");
        return false;
      }

      const { data: otherActive } = await supabase
        .from("reservations")
        .select("id")
        .eq("vehicle_id", vehicleId)
        .eq("status", "active")
        .neq("id", reservationId);

      await supabase.rpc("transition_vehicle_stage", {
        p_vehicle_id: vehicleId,
        p_target_stage: otherActive?.length ? "bloqueado" : "publicado",
      });

      toast.success("Reserva cancelada");
      await refetch();
      onRefresh?.();
      return true;
    } catch (err: unknown) {
      logger.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
      return false;
    }
  }, [onRefresh, refetch, userId, vehicleId]);

  const convertReservationToSale = useCallback(async (reservation: Reservation | null, form: ConvertForm) => {
    if (!orgId || !userId || !reservation) return false;

    const finalPrice = parseInt(form.final_price_cop, 10);
    if (!form.final_price_cop || Number.isNaN(finalPrice) || finalPrice <= 0) {
      toast.error("El precio final debe ser mayor a 0");
      return false;
    }
    if (!form.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return false;
    }

    try {
      logger.debug("[VehicleSalesTab] Creating sale from reservation...");
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          org_id: orgId,
          vehicle_id: vehicleId,
          customer_id: reservation.customer_id,
          final_price_cop: finalPrice,
          payment_method_code: form.payment_method_code,
          reservation_id: reservation.id,
          status: "active",
          created_by: userId,
          notes: form.notes?.trim() || null,
        })
        .select()
        .single();

      if (saleError) {
        logger.error("[VehicleSalesTab] Sale error:", saleError);
        toast.error(`Error al crear venta: ${saleError.message}`);
        return false;
      }

      if (!saleData?.id) {
        toast.error("Error: No se creó la venta");
        return false;
      }

      if (form.registerDepositAsPayment) {
        const { error: paymentError } = await supabase.from("sale_payments").insert({
          org_id: orgId,
          sale_id: saleData.id,
          amount_cop: reservation.deposit_amount_cop,
          direction: "in",
          payment_method_code: reservation.payment_method_code || defaultPaymentMethodCode || null,
          notes: "Depósito de reserva",
          created_by: userId,
        });

        if (paymentError) {
          logger.error("[VehicleSalesTab] Payment error:", paymentError);
          toast.warning(`Venta creada, pero falló el pago: ${paymentError.message}`);
        }
      }

      await supabase.rpc("mark_vehicle_sold", {
        p_vehicle_id: vehicleId,
        p_sale_id: saleData.id,
      });

      await supabase
        .from("reservations")
        .update({ status: "converted" })
        .eq("id", reservation.id);

      toast.success("Venta registrada exitosamente");
      await refetch();
      onRefresh?.();
      return true;
    } catch (err: unknown) {
      logger.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
      return false;
    }
  }, [defaultPaymentMethodCode, onRefresh, orgId, refetch, userId, vehicleId]);

  return {
    createReservation,
    cancelReservation,
    convertReservationToSale,
  };
}
