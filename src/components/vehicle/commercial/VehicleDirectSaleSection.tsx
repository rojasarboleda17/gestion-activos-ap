import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";

interface Props {
  disabled?: boolean;
  onDirectSale: () => void;
}

export function VehicleDirectSaleSection({ disabled, onDirectSale }: Props) {
  return (
    <Button onClick={onDirectSale} disabled={disabled}>
      <DollarSign className="h-4 w-4 mr-2" />
      Venta directa
    </Button>
  );
}
