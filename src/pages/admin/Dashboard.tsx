import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingState } from "@/components/ui/loading-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCOP } from "@/lib/format";
import { Car, Tag, Bookmark, DollarSign, AlertTriangle, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalVehicles: 0,
    listedVehicles: 0,
    activeReservations: 0,
    depositTotal: 0,
    salesLast30Days: 0,
    salesTotal: 0,
    stageDistribution: [] as { stage_code: string; count: number }[],
    complianceAlerts: [] as any[],
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile?.org_id) return;

      const [vehiclesRes, listingRes, reservationsRes, salesRes, stagesRes, complianceRes] = await Promise.all([
        supabase.from("vehicles").select("id", { count: "exact" }).eq("is_archived", false),
        supabase.from("vehicle_listing").select("vehicle_id").eq("is_listed", true),
        supabase.from("reservations").select("deposit_amount_cop").eq("status", "active"),
        supabase.from("sales").select("final_price_cop, sale_date").eq("status", "active"),
        supabase.from("vehicles").select("stage_code").eq("is_archived", false),
        supabase.from("vehicle_compliance").select("vehicle_id, soat_expires_at, tecnomecanica_expires_at, vehicles(license_plate, brand)"),
      ]);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentSales = (salesRes.data || []).filter(
        (s) => new Date(s.sale_date) >= thirtyDaysAgo
      );

      const stageCounts: Record<string, number> = {};
      (stagesRes.data || []).forEach((v) => {
        stageCounts[v.stage_code] = (stageCounts[v.stage_code] || 0) + 1;
      });

      const today = new Date();
      const alerts = (complianceRes.data || []).filter((c) => {
        const soat = c.soat_expires_at ? new Date(c.soat_expires_at) : null;
        const tecno = c.tecnomecanica_expires_at ? new Date(c.tecnomecanica_expires_at) : null;
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        return (soat && soat <= thirtyDaysFromNow) || (tecno && tecno <= thirtyDaysFromNow);
      });

      setStats({
        totalVehicles: vehiclesRes.count || 0,
        listedVehicles: listingRes.data?.length || 0,
        activeReservations: reservationsRes.data?.length || 0,
        depositTotal: (reservationsRes.data || []).reduce((sum, r) => sum + (r.deposit_amount_cop || 0), 0),
        salesLast30Days: recentSales.length,
        salesTotal: recentSales.reduce((sum, s) => sum + (s.final_price_cop || 0), 0),
        stageDistribution: Object.entries(stageCounts).map(([stage_code, count]) => ({ stage_code, count })),
        complianceAlerts: alerts.slice(0, 5),
      });
      setLoading(false);
    };

    fetchStats();
  }, [profile?.org_id]);

  if (loading) {
    return (
      <AdminLayout title="Dashboard" breadcrumbs={[{ label: "Dashboard" }]}>
        <LoadingState variant="cards" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Dashboard"
      breadcrumbs={[{ label: "Dashboard" }]}
      actions={<Button onClick={() => navigate("/admin/vehicles/new")}>Crear Vehículo</Button>}
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Vehículos Totales" value={stats.totalVehicles} icon={Car} onClick={() => navigate("/admin/vehicles")} />
          <StatCard title="Publicados" value={stats.listedVehicles} icon={Tag} description="Vehículos en venta" />
          <StatCard title="Reservas Activas" value={stats.activeReservations} icon={Bookmark} description={formatCOP(stats.depositTotal) + " en depósitos"} />
          <StatCard title="Ventas (30 días)" value={stats.salesLast30Days} icon={DollarSign} description={formatCOP(stats.salesTotal)} variant="primary" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Stage Distribution */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Distribución por Estado</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats.stageDistribution.map((s) => (
                  <Badge key={s.stage_code} variant="secondary" className="text-sm px-3 py-1">
                    {s.stage_code}: {s.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Compliance Alerts */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-warning" /> Alertas de Vencimiento</CardTitle></CardHeader>
            <CardContent>
              {stats.complianceAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin alertas próximas</p>
              ) : (
                <ul className="space-y-2">
                  {stats.complianceAlerts.map((a, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{(a.vehicles as any)?.license_plate || "N/A"}</span> - {(a.vehicles as any)?.brand}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
