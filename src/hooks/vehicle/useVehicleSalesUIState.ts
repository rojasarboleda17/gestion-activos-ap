import { useState } from "react";
import type {
  ConvertForm,
  QuickCustomerForm,
  Reservation,
  ReservationForm,
  Sale,
  SaleForm,
  VoidForm,
} from "@/hooks/vehicle/types";

export function useVehicleSalesUIState(defaultPaymentMethodCode: string) {
  const [createResOpen, setCreateResOpen] = useState(false);
  const [savingRes, setSavingRes] = useState(false);
  const [resForm, setResForm] = useState<ReservationForm>({
    customer_id: "",
    deposit_amount_cop: "",
    payment_method_code: "",
    notes: "",
  });

  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>({ full_name: "", phone: "" });

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingReservation, setCancelingReservation] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertingReservation, setConvertingReservation] = useState<Reservation | null>(null);
  const [convertForm, setConvertForm] = useState<ConvertForm>({
    final_price_cop: "",
    payment_method_code: "",
    notes: "",
    registerDepositAsPayment: true,
  });
  const [converting, setConverting] = useState(false);

  const [createSaleOpen, setCreateSaleOpen] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [saleForm, setSaleForm] = useState<SaleForm>({
    customer_id: "",
    final_price_cop: "",
    payment_method_code: "",
    notes: "",
  });

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [voidForm, setVoidForm] = useState<VoidForm>({
    void_reason: "",
    return_stage_code: "publicado",
    refund_amount: "",
    refund_method: "",
  });
  const [voiding, setVoiding] = useState(false);

  const openCreateReservation = () => {
    setResForm({
      customer_id: "",
      deposit_amount_cop: "",
      payment_method_code: defaultPaymentMethodCode,
      notes: "",
    });
    setCreateResOpen(true);
  };

  const openCancelReservation = (reservation: Reservation) => {
    setCancelingReservation(reservation);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const openConvertDialog = (reservation: Reservation) => {
    setConvertingReservation(reservation);
    setConvertForm({
      final_price_cop: "",
      payment_method_code: reservation.payment_method_code || defaultPaymentMethodCode,
      notes: "",
      registerDepositAsPayment: true,
    });
    setConvertDialogOpen(true);
  };

  const openCreateSale = () => {
    setSaleForm({
      customer_id: "",
      final_price_cop: "",
      payment_method_code: defaultPaymentMethodCode,
      notes: "",
    });
    setCreateSaleOpen(true);
  };

  const openVoidDialog = (sale: Sale) => {
    setVoidingSale(sale);
    setVoidForm({
      void_reason: "",
      return_stage_code: "publicado",
      refund_amount: "",
      refund_method: defaultPaymentMethodCode,
    });
    setVoidDialogOpen(true);
  };

  return {
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
  };
}
