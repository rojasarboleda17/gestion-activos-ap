import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface Props {
  disabled?: boolean;
  onConvertToSale: () => void;
}

export function VehicleReservationConversionSection({ disabled, onConvertToSale }: Props) {
  return (
    <Button onClick={onConvertToSale} disabled={disabled}>
      <ArrowRight className="h-4 w-4 mr-2" />
      Convertir a venta
    </Button>
  );
}
