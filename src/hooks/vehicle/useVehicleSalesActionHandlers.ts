import { useCallback } from "react";

interface ReservationForm {
  customer_id: string;
  deposit_amount_cop: string;
  payment_method_code: string;
  notes: string;
}

interface QuickCustomerForm {
  full_name: string;
  phone: string;
}

interface ConvertForm {
  final_price_cop: string;
  payment_method_code: string;
  notes: string;
  registerDepositAsPayment: boolean;
}

interface SaleForm {
  customer_id: string;
  final_price_cop: string;
  payment_method_code: string;
  notes: string;
}

interface VoidForm {
  void_reason: string;
  return_stage_code: string;
  refund_amount: string;
  refund_method: string;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

import type { Reservation, Sale } from "@/hooks/vehicle/useVehicleSalesData";

interface UseVehicleSalesActionHandlersParams {
  resForm: ReservationForm;
  saleForm: SaleForm;
  quickCustomerForm: QuickCustomerForm;
  convertForm: ConvertForm;
  voidForm: VoidForm;
  cancelReason: string;
  cancelingReservation: Reservation | null;
  convertingReservation: Reservation | null;
  voidingSale: Sale | null;

  setSavingRes: (value: boolean) => void;
  setCreateResOpen: (value: boolean) => void;
  setQuickCustomerOpen: (value: boolean) => void;
  setQuickCustomerForm: (value: QuickCustomerForm) => void;
  setResForm: (value: ReservationForm) => void;
  setSaleForm: (value: SaleForm) => void;

  setCancelDialogOpen: (value: boolean) => void;
  setCancelingReservation: (value: Reservation | null) => void;

  setConverting: (value: boolean) => void;
  setConvertDialogOpen: (value: boolean) => void;
  setConvertingReservation: (value: Reservation | null) => void;

  setSavingSale: (value: boolean) => void;
  setCreateSaleOpen: (value: boolean) => void;

  setVoiding: (value: boolean) => void;
  setVoidDialogOpen: (value: boolean) => void;
  setVoidingSale: (value: Sale | null) => void;

  createReservation: (form: ReservationForm) => Promise<boolean>;
  createQuickCustomer: (form: QuickCustomerForm) => Promise<Customer | null>;
  appendCustomer: (customer: Customer) => void;
  cancelReservation: (reservationId: string | null, reason: string) => Promise<boolean>;
  convertReservationToSale: (reservation: Reservation | null, form: ConvertForm) => Promise<boolean>;
  createDirectSale: (form: SaleForm) => Promise<boolean>;
  voidSale: (saleId: string | null, form: VoidForm) => Promise<boolean>;
}

export function useVehicleSalesActionHandlers({
  resForm,
  saleForm,
  quickCustomerForm,
  convertForm,
  voidForm,
  cancelReason,
  cancelingReservation,
  convertingReservation,
  voidingSale,
  setSavingRes,
  setCreateResOpen,
  setQuickCustomerOpen,
  setQuickCustomerForm,
  setResForm,
  setSaleForm,
  setCancelDialogOpen,
  setCancelingReservation,
  setConverting,
  setConvertDialogOpen,
  setConvertingReservation,
  setSavingSale,
  setCreateSaleOpen,
  setVoiding,
  setVoidDialogOpen,
  setVoidingSale,
  createReservation,
  createQuickCustomer,
  appendCustomer,
  cancelReservation,
  convertReservationToSale,
  createDirectSale,
  voidSale,
}: UseVehicleSalesActionHandlersParams) {
  const handleCreateReservation = useCallback(async () => {
    setSavingRes(true);
    try {
      const success = await createReservation(resForm);
      if (!success) return;
      setCreateResOpen(false);
    } finally {
      setSavingRes(false);
    }
  }, [createReservation, resForm, setCreateResOpen, setSavingRes]);

  const handleQuickCustomer = useCallback(async () => {
    const customer = await createQuickCustomer(quickCustomerForm);
    if (!customer) return;

    appendCustomer(customer);
    setResForm({ ...resForm, customer_id: customer.id });
    setSaleForm({ ...saleForm, customer_id: customer.id });
    setQuickCustomerOpen(false);
    setQuickCustomerForm({ full_name: "", phone: "" });
  }, [appendCustomer, createQuickCustomer, quickCustomerForm, resForm, saleForm, setQuickCustomerForm, setQuickCustomerOpen, setResForm, setSaleForm]);

  const handleCancelReservation = useCallback(async () => {
    const success = await cancelReservation(cancelingReservation?.id || null, cancelReason);
    if (!success) return;

    setCancelDialogOpen(false);
    setCancelingReservation(null);
  }, [cancelReason, cancelReservation, cancelingReservation, setCancelDialogOpen, setCancelingReservation]);

  const handleConvertToSale = useCallback(async () => {
    setConverting(true);
    try {
      const success = await convertReservationToSale(convertingReservation, convertForm);
      if (!success) return;

      setConvertDialogOpen(false);
      setConvertingReservation(null);
    } finally {
      setConverting(false);
    }
  }, [convertForm, convertReservationToSale, convertingReservation, setConvertDialogOpen, setConverting, setConvertingReservation]);

  const handleCreateSale = useCallback(async () => {
    setSavingSale(true);
    try {
      const success = await createDirectSale(saleForm);
      if (!success) return;

      setCreateSaleOpen(false);
    } finally {
      setSavingSale(false);
    }
  }, [createDirectSale, saleForm, setCreateSaleOpen, setSavingSale]);

  const handleVoidSale = useCallback(async () => {
    setVoiding(true);
    try {
      const success = await voidSale(voidingSale?.id || null, voidForm);
      if (!success) return;

      setVoidDialogOpen(false);
      setVoidingSale(null);
    } finally {
      setVoiding(false);
    }
  }, [setVoidDialogOpen, setVoiding, setVoidingSale, voidForm, voidSale, voidingSale]);

  return {
    handleCreateReservation,
    handleQuickCustomer,
    handleCancelReservation,
    handleConvertToSale,
    handleCreateSale,
    handleVoidSale,
  };
}
