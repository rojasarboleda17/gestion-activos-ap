export interface Reservation {
  id: string;
  status: string;
  deposit_amount_cop: number;
  payment_method_code: string;
  reserved_at: string;
  customer_id: string;
  customers?: { full_name: string; phone: string | null };
}

export interface Sale {
  id: string;
  status: string;
  final_price_cop: number;
  sale_date: string;
  customer_id: string;
  customers?: { full_name: string; phone: string | null };
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

export interface PaymentMethod {
  code: string;
  name: string;
}

export interface VehicleStage {
  code: string;
  name: string;
}

export interface ReservationForm {
  customer_id: string;
  deposit_amount_cop: string;
  payment_method_code: string;
  notes: string;
}

export interface QuickCustomerForm {
  full_name: string;
  phone: string;
}

export interface ConvertForm {
  final_price_cop: string;
  payment_method_code: string;
  notes: string;
  registerDepositAsPayment: boolean;
}

export interface SaleForm {
  customer_id: string;
  final_price_cop: string;
  payment_method_code: string;
  notes: string;
}

export interface VoidForm {
  void_reason: string;
  return_stage_code: string;
  refund_amount: string;
  refund_method: string;
}
