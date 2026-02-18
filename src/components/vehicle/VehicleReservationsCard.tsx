import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCOP, formatDate } from "@/lib/format";
import { Bookmark, ArrowRight, X } from "lucide-react";
import type { Reservation } from "@/hooks/vehicle/useVehicleSalesData";

interface Props {
  reservations: Reservation[];
  statusLabels: Record<string, string>;
  onConvertReservation: (reservation: Reservation) => void;
  onCancelReservation: (reservation: Reservation) => void;
}

export function VehicleReservationsCard({
  reservations,
  statusLabels,
  onConvertReservation,
  onCancelReservation,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Bookmark className="h-4 w-4" />
          Reservas ({reservations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin reservas</p>
        ) : (
          <div className="space-y-3">
            {reservations.map((r) => (
              <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{r.customers?.full_name || "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.reserved_at)} · {r.customers?.phone || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <Badge variant={r.status === "active" ? "default" : r.status === "converted" ? "secondary" : "destructive"}>
                      {statusLabels[r.status] || r.status}
                    </Badge>
                    <p className="text-sm">{formatCOP(r.deposit_amount_cop)}</p>
                  </div>
                  {r.status === "active" && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onConvertReservation(r)}
                        title="Convertir a venta"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => onCancelReservation(r)}
                        title="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
