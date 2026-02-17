import { Button } from "@/components/ui/button";
import { DollarSign, Plus, ArrowRight, AlertTriangle } from "lucide-react";

interface Props {
  isSold: boolean;
  hasActiveReservation: boolean;
  onOpenCreateSale: () => void;
  onOpenCreateReservation: () => void;
  onOpenConvertActiveReservation: () => void;
}

export function VehicleSalesActions({
  isSold,
  hasActiveReservation,
  onOpenCreateSale,
  onOpenCreateReservation,
  onOpenConvertActiveReservation,
}: Props) {
  return (
    <>
      {isSold && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            Este vehículo ha sido vendido. No se pueden crear nuevas reservas o ventas.
          </p>
        </div>
      )}

      {!isSold && hasActiveReservation && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Vehículo bloqueado por reserva activa. Convierte o cancela la reserva para liberar.
          </p>
        </div>
      )}

      {!isSold && (
        <div className="flex flex-wrap gap-2">
          {hasActiveReservation ? (
            <Button onClick={onOpenConvertActiveReservation}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Convertir reserva activa
            </Button>
          ) : (
            <Button onClick={onOpenCreateSale}>
              <DollarSign className="h-4 w-4 mr-2" />
              Venta directa
            </Button>
          )}

          <Button
            variant="outline"
            onClick={onOpenCreateReservation}
            disabled={hasActiveReservation}
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear Reserva
          </Button>
        </div>
      )}
    </>
  );
}
