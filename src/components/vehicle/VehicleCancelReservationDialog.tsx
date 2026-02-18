import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  reason: string;
  onOpenChange: (open: boolean) => void;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
}

export function VehicleCancelReservationDialog({
  open,
  reason,
  onOpenChange,
  onReasonChange,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar reserva?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción cancelará la reserva y liberará el vehículo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label>Motivo (opcional)</Label>
          <Textarea value={reason} onChange={(e) => onReasonChange(e.target.value)} className="mt-2" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cancelar Reserva</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
