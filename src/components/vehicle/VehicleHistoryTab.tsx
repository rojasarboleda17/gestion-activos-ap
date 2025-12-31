import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { History, ArrowRight } from "lucide-react";

interface Props { vehicleId: string; }

export function VehicleHistoryTab({ vehicleId }: Props) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("vehicle_stage_history").select("*, profiles:changed_by(full_name)").eq("vehicle_id", vehicleId).order("changed_at", { ascending: false });
      setHistory(data || []);
      setLoading(false);
    };
    fetch();
  }, [vehicleId]);

  if (loading) return <LoadingState variant="table" />;
  if (history.length === 0) return <EmptyState icon={History} title="Sin historial" description="Los cambios de estado aparecerán aquí." />;

  return (
    <div className="space-y-3">
      {history.map((h) => (
        <Card key={h.id}><CardContent className="py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Badge variant="outline">{h.from_stage_code || "—"}</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge>{h.to_stage_code}</Badge>
          </div>
          <div className="text-sm text-muted-foreground text-right">
            <p>{formatDate(h.changed_at)}</p>
            <p>{h.profiles?.full_name || "Sistema"}</p>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}
