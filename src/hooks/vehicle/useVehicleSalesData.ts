import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import type {
  Customer,
  PaymentMethod,
  Reservation,
  Sale,
  VehicleStage,
} from "@/hooks/vehicle/types";

interface UseVehicleSalesDataParams {
  vehicleId: string;
  orgId?: string;
}

export function useVehicleSalesData({ vehicleId, orgId }: UseVehicleSalesDataParams) {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [vehicleStages, setVehicleStages] = useState<VehicleStage[]>([]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      logger.debug("[VehicleSalesTab] Fetching data for vehicle:", vehicleId);
      const [resRes, salesRes, custRes, pmRes, stagesRes] = await Promise.all([
        supabase
          .from("reservations")
          .select("*, customers(full_name, phone)")
          .eq("vehicle_id", vehicleId)
          .order("reserved_at", { ascending: false }),
        supabase
          .from("sales")
          .select("*, customers(full_name, phone)")
          .eq("vehicle_id", vehicleId)
          .order("sale_date", { ascending: false }),
        supabase
          .from("customers")
          .select("id, full_name, phone")
          .eq("org_id", orgId)
          .order("full_name"),
        supabase
          .from("payment_methods")
          .select("code, name")
          .eq("is_active", true),
        supabase
          .from("vehicle_stages")
          .select("code, name")
          .eq("is_terminal", false)
          .order("sort_order"),
      ]);

      setReservations((resRes.data || []) as Reservation[]);
      setSales((salesRes.data || []) as Sale[]);
      setCustomers((custRes.data || []) as Customer[]);
      setPaymentMethods((pmRes.data || []) as PaymentMethod[]);
      setVehicleStages((stagesRes.data || []) as VehicleStage[]);
    } catch (err) {
      logger.error("[VehicleSalesTab] Error fetching data:", err);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [orgId, vehicleId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const appendCustomer = useCallback((customer: Customer) => {
    setCustomers((prev) => [...prev, customer]);
  }, []);

  return {
    loading,
    reservations,
    sales,
    customers,
    paymentMethods,
    vehicleStages,
    refetch,
    appendCustomer,
  };
}
