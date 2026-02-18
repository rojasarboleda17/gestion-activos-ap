import { useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseVehicleCustomerMutationsParams {
  orgId?: string;
}

interface QuickCustomerForm {
  full_name: string;
  phone: string;
}

interface CreatedCustomer {
  id: string;
  full_name: string;
  phone: string | null;
}

export function useVehicleCustomerMutations({ orgId }: UseVehicleCustomerMutationsParams) {
  const createQuickCustomer = useCallback(async (form: QuickCustomerForm): Promise<CreatedCustomer | null> => {
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
      return data as CreatedCustomer;
    } catch (err: unknown) {
      toast.error(`Error: ${getErrorMessage(err)}`);
      return null;
    }
  }, [orgId]);

  return {
    createQuickCustomer,
  };
}
