import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { formatCOP } from "@/lib/format";
import { DollarSign, X, ArrowRight, Eye } from "lucide-react";
import { logger } from "@/lib/logger";
import { useVehicleSalesData, type Reservation } from "@/hooks/vehicle/useVehicleSalesData";
import { useVehicleSalesUIState } from "@/hooks/vehicle/useVehicleSalesUIState";
import { useVehicleSalesMutations } from "@/hooks/vehicle/useVehicleSalesMutations";
import { VehicleSalesActions } from "@/components/vehicle/VehicleSalesActions";
import { VehicleReservationsCard } from "@/components/vehicle/VehicleReservationsCard";
import { VehicleSalesCard } from "@/components/vehicle/VehicleSalesCard";
import { VehicleCreateReservationDialog } from "@/components/vehicle/VehicleCreateReservationDialog";
import { VehicleQuickCustomerDialog } from "@/components/vehicle/VehicleQuickCustomerDialog";
import { VehicleConvertReservationDialog } from "@/components/vehicle/VehicleConvertReservationDialog";
import { VehicleCreateSaleDialog } from "@/components/vehicle/VehicleCreateSaleDialog";
import { VehicleCancelReservationDialog } from "@/components/vehicle/VehicleCancelReservationDialog";
import { VehicleVoidSaleDialog } from "@/components/vehicle/VehicleVoidSaleDialog";

interface Props {
  vehicleId: string;
  vehicleStageCode?: string;
  onRefresh?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  converted: "Convertida",
  cancelled: "Cancelada",
  expired: "Expirada",
  voided: "Anulada",
};

export function VehicleSalesTab({ vehicleId, vehicleStageCode, onRefresh }: Props) {
  const { profile } = useAuth();
  const {
    loading,
    reservations,
    sales,
    customers,
    paymentMethods,
    vehicleStages,
    refetch,
    appendCustomer,
  } = useVehicleSalesData({ vehicleId, orgId: profile?.org_id });

  const isSold = vehicleStageCode === "vendido";
  const activeReservation = reservations.find((r) => r.status === "active") || null;
  const hasActiveReservation = Boolean(activeReservation);

  const {
    createResOpen,
    setCreateResOpen,
    savingRes,
    setSavingRes,
    resForm,
    setResForm,
    quickCustomerOpen,
    setQuickCustomerOpen,
    quickCustomerForm,
    setQuickCustomerForm,
    cancelDialogOpen,
    setCancelDialogOpen,
    cancelingReservation,
    setCancelingReservation,
    cancelReason,
    setCancelReason,
    convertDialogOpen,
    setConvertDialogOpen,
    convertingReservation,
    setConvertingReservation,
    convertForm,
    setConvertForm,
    converting,
    setConverting,
    createSaleOpen,
    setCreateSaleOpen,
    savingSale,
    setSavingSale,
    saleForm,
    setSaleForm,
    voidDialogOpen,
    setVoidDialogOpen,
    voidingSale,
    setVoidingSale,
    voidForm,
    setVoidForm,
    voiding,
    setVoiding,
    openCreateReservation,
    openCancelReservation,
    openConvertDialog,
    openCreateSale,
    openVoidDialog,
  } = useVehicleSalesUIState(paymentMethods[0]?.code || "");

  const { createDirectSale, voidSale } = useVehicleSalesMutations({
    vehicleId,
    orgId: profile?.org_id,
    userId: profile?.id,
    refetch,
    onRefresh,
  });

  const handleCreateReservation = async () => {
    if (!profile?.org_id) return;

    if (!resForm.customer_id) {
      toast.error("Selecciona un cliente");
      return;
    }
    const depositAmount = parseInt(resForm.deposit_amount_cop);
    if (!resForm.deposit_amount_cop || isNaN(depositAmount) || depositAmount <= 0) {
      toast.error("El depósito debe ser mayor a 0");
      return;
    }
    if (!resForm.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return;
    }

    setSavingRes(true);
    try {
      logger.debug("[VehicleSalesTab] Creating reservation...");
      const { data, error } = await supabase
        .from("reservations")
        .insert({
          org_id: profile.org_id,
          vehicle_id: vehicleId,
          customer_id: resForm.customer_id,
          deposit_amount_cop: depositAmount,
          payment_method_code: resForm.payment_method_code,
          notes: resForm.notes?.trim() || null,
          status: "active",
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) {
        logger.error("[VehicleSalesTab] Reservation error:", error);
        toast.error(`Error: ${error.message}${error.details ? ` - ${error.details}` : ""}`);
        return;
      }

      if (!data) {
        toast.error("Error: No se creó la reserva");
        return;
      }

      // Update vehicle stage
      await supabase.rpc("transition_vehicle_stage", {
        p_vehicle_id: vehicleId,
        p_target_stage: "bloqueado",
      });      

      toast.success("Reserva creada");
      setCreateResOpen(false);
      refetch();
      onRefresh?.();
    } catch (err: unknown) {
      logger.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
    } finally {
      setSavingRes(false);
    }
  };

  // Quick customer
  const handleQuickCustomer = async () => {
    if (!profile?.org_id || !quickCustomerForm.full_name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          org_id: profile.org_id,
          full_name: quickCustomerForm.full_name.trim(),
          phone: quickCustomerForm.phone?.trim() || null,
        })
        .select()
        .single();

      if (error) {
        toast.error(`Error: ${error.message}`);
        return;
      }

      appendCustomer(data);
      setResForm({ ...resForm, customer_id: data.id });
      setSaleForm({ ...saleForm, customer_id: data.id });
      setQuickCustomerOpen(false);
      setQuickCustomerForm({ full_name: "", phone: "" });
      toast.success("Cliente creado");
    } catch (err: unknown) {
      toast.error(`Error: ${getErrorMessage(err)}`);
    }
  };

  // ===== CANCEL RESERVATION =====
  const handleCancelReservation = async () => {
    if (!cancelingReservation || !profile?.id) return;

    try {
      logger.debug("[VehicleSalesTab] Cancelling reservation:", cancelingReservation.id);
      const { error, data } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          cancel_reason: cancelReason?.trim() || null,
          cancelled_at: new Date().toISOString(),
          cancelled_by: profile.id,
        })
        .eq("id", cancelingReservation.id)
        .select();

      if (error) {
        logger.error("[VehicleSalesTab] Cancel error:", error);
        toast.error(`Error: ${error.message}`);
        return;
      }

      if (!data?.length) {
        toast.error("Error: No se actualizó la reserva");
        return;
      }

      // Check for other active reservations
      const { data: otherActive } = await supabase
        .from("reservations")
        .select("id")
        .eq("vehicle_id", vehicleId)
        .eq("status", "active")
        .neq("id", cancelingReservation.id);

        if (!otherActive?.length) {
          await supabase.rpc("transition_vehicle_stage", {
            p_vehicle_id: vehicleId,
            p_target_stage: "publicado",
          });
        } else {
          await supabase.rpc("transition_vehicle_stage", {
            p_vehicle_id: vehicleId,
            p_target_stage: "bloqueado",
          });
        }        

      toast.success("Reserva cancelada");
      setCancelDialogOpen(false);
      setCancelingReservation(null);
      refetch();
      onRefresh?.();
    } catch (err: unknown) {
      logger.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
    }
  };

  // ===== CONVERT RESERVATION TO SALE =====
  const handleConvertToSale = async () => {
    if (!profile?.org_id || !convertingReservation) return;

    const finalPrice = parseInt(convertForm.final_price_cop);
    if (!convertForm.final_price_cop || isNaN(finalPrice) || finalPrice <= 0) {
      toast.error("El precio final debe ser mayor a 0");
      return;
    }
    if (!convertForm.payment_method_code) {
      toast.error("Selecciona un método de pago");
      return;
    }

    setConverting(true);
    try {
      // Step 1: Create sale
      logger.debug("[VehicleSalesTab] Creating sale from reservation...");
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          org_id: profile.org_id,
          vehicle_id: vehicleId,
          customer_id: convertingReservation.customer_id,
          final_price_cop: finalPrice,
          payment_method_code: convertForm.payment_method_code,
          reservation_id: convertingReservation.id,
          status: "active",
          created_by: profile.id,
          notes: convertForm.notes?.trim() || null,
        })
        .select()
        .single();

      if (saleError) {
        logger.error("[VehicleSalesTab] Sale error:", saleError);
        toast.error(`Error al crear venta: ${saleError.message}`);
        return;
      }

      if (!saleData?.id) {
        toast.error("Error: No se creó la venta");
        return;
      }

      // Step 2: Register deposit as payment
      if (convertForm.registerDepositAsPayment) {
        const { error: paymentError } = await supabase.from("sale_payments").insert({
          org_id: profile.org_id,
          sale_id: saleData.id,
          amount_cop: convertingReservation.deposit_amount_cop,
          direction: "in",
          payment_method_code: convertingReservation.payment_method_code,
          notes: "Depósito de reserva",
          created_by: profile.id,
        });

        if (paymentError) {
          logger.error("[VehicleSalesTab] Payment error:", paymentError);
          toast.warning(`Venta creada, pero falló el pago: ${paymentError.message}`);
        }
      }

      // Step 3: Update vehicle
      await supabase.rpc("mark_vehicle_sold", {
        p_vehicle_id: vehicleId,
        p_sale_id: saleData.id,
      });      

      // Step 4: Update reservation
      await supabase.from("reservations").update({ status: "converted" }).eq("id", convertingReservation.id);

      toast.success("Venta registrada exitosamente");
      setConvertDialogOpen(false);
      setConvertingReservation(null);
      refetch();
      onRefresh?.();
    } catch (err: unknown) {
      logger.error("[VehicleSalesTab] Unexpected error:", err);
      toast.error(`Error: ${getErrorMessage(err)}`);
    } finally {
      setConverting(false);
    }
  };

  // ===== CREATE DIRECT SALE =====
  const handleCreateSale = async () => {
    setSavingSale(true);
    try {
      const success = await createDirectSale(saleForm);
      if (!success) return;

      setCreateSaleOpen(false);
    } finally {
      setSavingSale(false);
    }
  };

  // ===== VOID SALE =====
  const handleVoidSale = async () => {
    setVoiding(true);
    try {
      const success = await voidSale(voidingSale?.id || null, voidForm);
      if (!success) return;

      setVoidDialogOpen(false);
      setVoidingSale(null);
    } finally {
      setVoiding(false);
    }
  };

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-6">
      <VehicleSalesActions
        isSold={isSold}
        hasActiveReservation={hasActiveReservation}
        onOpenCreateSale={openCreateSale}
        onOpenCreateReservation={openCreateReservation}
        onOpenConvertActiveReservation={() => {
          if (activeReservation) openConvertDialog(activeReservation);
        }}
      />

      <VehicleReservationsCard
        reservations={reservations}
        statusLabels={STATUS_LABELS}
        onConvertReservation={openConvertDialog}
        onCancelReservation={openCancelReservation}
      />

      <VehicleSalesCard
        sales={sales}
        statusLabels={STATUS_LABELS}
        onVoidSale={openVoidDialog}
      />

      <VehicleCreateReservationDialog
        open={createResOpen}
        customers={customers}
        paymentMethods={paymentMethods}
        form={resForm}
        saving={savingRes}
        onOpenChange={setCreateResOpen}
        onFormChange={setResForm}
        onSubmit={handleCreateReservation}
        onOpenQuickCustomer={() => setQuickCustomerOpen(true)}
      />

      <VehicleQuickCustomerDialog
        open={quickCustomerOpen}
        form={quickCustomerForm}
        onOpenChange={setQuickCustomerOpen}
        onFormChange={setQuickCustomerForm}
        onSubmit={handleQuickCustomer}
      />

      <VehicleCancelReservationDialog
        open={cancelDialogOpen}
        reason={cancelReason}
        onOpenChange={setCancelDialogOpen}
        onReasonChange={setCancelReason}
        onConfirm={handleCancelReservation}
      />

      <VehicleConvertReservationDialog
        open={convertDialogOpen}
        converting={converting}
        reservation={convertingReservation}
        paymentMethods={paymentMethods}
        form={convertForm}
        onOpenChange={setConvertDialogOpen}
        onFormChange={setConvertForm}
        onSubmit={handleConvertToSale}
      />

      <VehicleCreateSaleDialog
        open={createSaleOpen}
        customers={customers}
        paymentMethods={paymentMethods}
        form={saleForm}
        saving={savingSale}
        onOpenChange={setCreateSaleOpen}
        onFormChange={setSaleForm}
        onSubmit={handleCreateSale}
        onOpenQuickCustomer={() => setQuickCustomerOpen(true)}
      />

      <VehicleVoidSaleDialog
        open={voidDialogOpen}
        form={voidForm}
        vehicleStages={vehicleStages}
        paymentMethods={paymentMethods}
        processing={voiding}
        onOpenChange={setVoidDialogOpen}
        onFormChange={setVoidForm}
        onConfirm={handleVoidSale}
      />
    </div>

  );
}
