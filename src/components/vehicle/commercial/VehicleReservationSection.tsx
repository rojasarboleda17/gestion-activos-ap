import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP, formatDate } from "@/lib/format";
import { ArrowRight, Bookmark, Plus, X } from "lucide-react";

interface Reservation {
  id: string;
  status: string;
  deposit_amount_cop: number;
  reserved_at: string;
  customers?: { full_name: string; phone: string | null };
}

interface Props {
  reservations: Reservation[];
  statusLabels: Record<string, string>;
  canManage: boolean;
  showCreateButton?: boolean;
  showList?: boolean;
  onCreateReservation: () => void;
  onConvertReservation: (reservation: Reservation) => void;
  onCancelReservation: (reservation: Reservation) => void;
}

export function VehicleReservationSection({
  reservations,
  statusLabels,
  canManage,
  showCreateButton = true,
  showList = true,
  onCreateReservation,
  onConvertReservation,
  onCancelReservation,
}: Props) {
  return (
    <>
      {showCreateButton && (
        <Button variant="outline" onClick={onCreateReservation} disabled={!canManage}>
          <Plus className="h-4 w-4 mr-2" />
          Reserva
        </Button>
      )}

      {showList && (
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
                {reservations.map((reservation) => (
                  <div key={reservation.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{reservation.customers?.full_name || "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(reservation.reserved_at)} · {reservation.customers?.phone || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <Badge
                          variant={
                            reservation.status === "active"
                              ? "default"
                              : reservation.status === "converted"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {statusLabels[reservation.status] || reservation.status}
                        </Badge>
                        <p className="text-sm">{formatCOP(reservation.deposit_amount_cop)}</p>
                      </div>
                      {reservation.status === "active" && canManage && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onConvertReservation(reservation)}
                            title="Convertir a venta"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => onCancelReservation(reservation)}
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
      )}
    </>
  );
}
