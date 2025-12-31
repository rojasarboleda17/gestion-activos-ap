import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import { Bookmark, DollarSign } from "lucide-react";

interface Props { vehicleId: string; }

export function VehicleSalesTab({ vehicleId }: Props) {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [resRes, salesRes] = await Promise.all([
        supabase.from("reservations").select("*, customers(full_name)").eq("vehicle_id", vehicleId).order("reserved_at", { ascending: false }),
        supabase.from("sales").select("*, customers(full_name)").eq("vehicle_id", vehicleId).order("sale_date", { ascending: false }),
      ]);
      setReservations(resRes.data || []);
      setSales(salesRes.data || []);
      setLoading(false);
    };
    fetch();
  }, [vehicleId]);

  if (loading) return <LoadingState variant="table" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Bookmark className="h-4 w-4" /> Reservas</CardTitle></CardHeader>
        <CardContent>
          {reservations.length === 0 ? <p className="text-sm text-muted-foreground">Sin reservas</p> : (
            <div className="space-y-2">
              {reservations.map((r) => (
                <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div><p className="font-medium">{r.customers?.full_name || "Cliente"}</p><p className="text-xs text-muted-foreground">{formatDate(r.reserved_at)}</p></div>
                  <div className="text-right"><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge><p className="text-sm">{formatCOP(r.deposit_amount_cop)}</p></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Ventas</CardTitle></CardHeader>
        <CardContent>
          {sales.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas</p> : (
            <div className="space-y-2">
              {sales.map((s) => (
                <div key={s.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div><p className="font-medium">{s.customers?.full_name || "Cliente"}</p><p className="text-xs text-muted-foreground">{formatDate(s.sale_date)}</p></div>
                  <div className="text-right"><Badge variant={s.status === "active" ? "default" : "destructive"}>{s.status}</Badge><p className="text-sm font-medium">{formatCOP(s.final_price_cop)}</p></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
