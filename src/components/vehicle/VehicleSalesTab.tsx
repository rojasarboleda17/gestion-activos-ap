import { useAuth } from "@/contexts/useAuth";
import { LoadingState } from "@/components/ui/loading-state";
import { useVehicleSalesData } from "@/hooks/vehicle/useVehicleSalesData";
import { useVehicleSalesUIState } from "@/hooks/vehicle/useVehicleSalesUIState";
import { useVehicleSalesMutations } from "@/hooks/vehicle/useVehicleSalesMutations";
import { useVehicleReservationMutations } from "@/hooks/vehicle/useVehicleReservationMutations";
import { useVehicleCustomerMutations } from "@/hooks/vehicle/useVehicleCustomerMutations";
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

  const {
    createReservation,
    cancelReservation,
    convertReservationToSale,
  } = useVehicleReservationMutations({
    vehicleId,
    orgId: profile?.org_id,
    userId: profile?.id,
    defaultPaymentMethodCode: paymentMethods[0]?.code || "",
    refetch,
    onRefresh,
  });

  const { createQuickCustomer } = useVehicleCustomerMutations({
    orgId: profile?.org_id,
  });

  const handleCreateReservation = async () => {
    setSavingRes(true);
    try {
      const success = await createReservation(resForm);
      if (!success) return;

      setCreateResOpen(false);
    } finally {
      setSavingRes(false);
    }
  };

  // Quick customer
  const handleQuickCustomer = async () => {
    const customer = await createQuickCustomer(quickCustomerForm);
    if (!customer) return;

    appendCustomer(customer);
    setResForm({ ...resForm, customer_id: customer.id });
    setSaleForm({ ...saleForm, customer_id: customer.id });
    setQuickCustomerOpen(false);
    setQuickCustomerForm({ full_name: "", phone: "" });
  };

  // ===== CANCEL RESERVATION =====
  const handleCancelReservation = async () => {
    const reservationId = cancelingReservation?.id || null;

    const success = await cancelReservation(reservationId, cancelReason);
    if (!success) return;

    setCancelDialogOpen(false);
    setCancelingReservation(null);
  };

  // ===== CONVERT RESERVATION TO SALE =====
  const handleConvertToSale = async () => {
    setConverting(true);
    try {
      const success = await convertReservationToSale(convertingReservation, convertForm);
      if (!success) return;

      setConvertDialogOpen(false);
      setConvertingReservation(null);
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
