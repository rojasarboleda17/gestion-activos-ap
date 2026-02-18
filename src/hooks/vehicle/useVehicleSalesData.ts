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

      const [reservationsResponse, salesResponse, paymentMethodsResponse, vehicleStagesResponse] = await Promise.all([
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
          .from("payment_methods")
          .select("code, name")
          .eq("is_active", true),
        supabase
          .from("vehicle_stages")
          .select("code, name")
          .eq("is_terminal", false)
          .order("sort_order"),
      ]);

      const customersResponse = orgId
        ? await supabase
            .from("customers")
            .select("id, full_name, phone")
            .eq("org_id", orgId)
            .order("full_name")
        : { data: [], error: null };

      if (
        reservationsResponse.error ||
        salesResponse.error ||
        paymentMethodsResponse.error ||
        vehicleStagesResponse.error ||
        customersResponse.error
      ) {
        const error =
          reservationsResponse.error ||
          salesResponse.error ||
          paymentMethodsResponse.error ||
          vehicleStagesResponse.error ||
          customersResponse.error;

        logger.error("[VehicleSalesTab] Error fetching data:", error);
        toast.error("Error al cargar datos");
        return;
      }

      setReservations((reservationsResponse.data || []) as Reservation[]);
      setSales((salesResponse.data || []) as Sale[]);
      setCustomers((customersResponse.data || []) as Customer[]);
      setPaymentMethods((paymentMethodsResponse.data || []) as PaymentMethod[]);
      setVehicleStages((vehicleStagesResponse.data || []) as VehicleStage[]);
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
    setCustomers((prev) => [...prev, customer].sort((a, b) => a.full_name.localeCompare(b.full_name)));
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
