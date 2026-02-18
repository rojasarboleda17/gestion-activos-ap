import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCOP, formatDate } from "@/lib/format";
import { DollarSign, X } from "lucide-react";
import type { Sale } from "@/hooks/vehicle/useVehicleSalesData";

interface Props {
  sales: Sale[];
  statusLabels: Record<string, string>;
  onVoidSale: (sale: Sale) => void;
}

export function VehicleSalesCard({ sales, statusLabels, onVoidSale }: Props) {
  return (
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
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <Badge variant={s.status === "active" ? "default" : "destructive"}>
                      {statusLabels[s.status] || s.status}
                    </Badge>
                    <p className="text-sm font-medium">{formatCOP(s.final_price_cop)}</p>
                  </div>
                  {s.status === "active" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => onVoidSale(s)}
                      title="Anular"
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
  );
}
