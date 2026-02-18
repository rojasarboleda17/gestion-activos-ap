import { useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Customer, QuickCustomerForm } from "@/hooks/vehicle/types";

interface UseVehicleCustomerMutationsParams {
  orgId?: string;
}

export function useVehicleCustomerMutations({ orgId }: UseVehicleCustomerMutationsParams) {
  const createQuickCustomer = useCallback(async (form: QuickCustomerForm): Promise<Customer | null> => {
    if (!orgId || !form.full_name.trim()) {
      toast.error("El nombre es requerido");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          org_id: orgId,
          full_name: form.full_name.trim(),
          phone: form.phone?.trim() || null,
        })
        .select("id, full_name, phone")
        .single();

      if (error) {
        toast.error(`Error: ${error.message}`);
        return null;
      }

      toast.success("Cliente creado");
      return data as Customer;
    } catch (err: unknown) {
      toast.error(`Error: ${getErrorMessage(err)}`);
      return null;
    }
  }, [orgId]);

  return {
    createQuickCustomer,
  };
}
