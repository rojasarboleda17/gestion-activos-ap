import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import { Bookmark, DollarSign, Plus, ArrowRight, X } from "lucide-react";

interface Props {
  vehicleId: string;
  vehicleStageCode?: string;
}

export function VehicleSalesTab({ vehicleId, vehicleStageCode }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  const isSold = vehicleStageCode === "vendido";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resRes, salesRes] = await Promise.all([
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
      ]);
      setReservations(resRes.data || []);
      setSales(salesRes.data || []);
    } catch (err) {
      console.error("Error fetching sales data:", err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancelReservation = async (reservation: any) => {
    if (!confirm("¿Cancelar esta reserva?")) return;

    try {
      await supabase
        .from("reservations")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: profile?.id })
        .eq("id", reservation.id);

      // Check for other active reservations
      const { data: otherActive } = await supabase
        .from("reservations")
        .select("id")
        .eq("vehicle_id", vehicleId)
        .eq("status", "active")
        .neq("id", reservation.id);

      if (!otherActive || otherActive.length === 0) {
        await supabase.from("vehicles").update({ stage_code: "publicado" }).eq("id", vehicleId);
      }

      toast.success("Reserva cancelada");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al cancelar");
    }
  };

  if (loading) return <LoadingState variant="table" />;

  const hasActiveReservation = reservations.some((r) => r.status === "active");

  return (
    <div className="space-y-6">
      {/* CTAs */}
      {!isSold && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/admin/sales`, "_blank")}
            disabled={hasActiveReservation}
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear Reserva
          </Button>
          <Button onClick={() => window.open(`/admin/sales`, "_blank")}>
            <DollarSign className="h-4 w-4 mr-2" />
            Registrar Venta
          </Button>
        </div>
      )}

      {isSold && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            Este vehículo ha sido vendido. No se pueden crear nuevas reservas o ventas.
          </p>
        </div>
      )}

      {/* Reservations */}
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
                        {r.status}
                      </Badge>
                      <p className="text-sm">{formatCOP(r.deposit_amount_cop)}</p>
                    </div>
                    {r.status === "active" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleCancelReservation(r)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Ventas ({sales.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ventas</p>
          ) : (
            <div className="space-y-3">
              {sales.map((s) => (
                <div key={s.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{s.customers?.full_name || "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(s.sale_date)} · {s.customers?.phone || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={s.status === "active" ? "default" : "destructive"}>
                      {s.status}
                    </Badge>
                    <p className="text-sm font-medium">{formatCOP(s.final_price_cop)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
