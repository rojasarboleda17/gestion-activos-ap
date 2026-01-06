import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingState } from "@/components/ui/loading-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCOP } from "@/lib/format";
import { 
  Car, Tag, Bookmark, DollarSign, AlertTriangle, Wrench, 
  FileWarning, TrendingUp, Receipt, Clock, Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addDays, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

interface DashboardStats {
  totalVehicles: number;
  listedVehicles: number;
  activeReservations: number;
  depositTotal: number;
  salesLast30Days: number;
  salesTotal: number;
  openWorkOrders: number;
  pendingWorkItems: number;
  monthlyExpenses: number;
  expenseCount: number;
  stageDistribution: { stage_code: string; name: string; count: number; color: string }[];
  complianceAlerts: ComplianceAlert[];
  documentAlerts: DocumentAlert[];
  recentSales: RecentSale[];
}

interface ComplianceAlert {
  vehicle_id: string;
  license_plate: string;
  brand: string;
  type: "soat" | "tecnomecanica";
  expires_at: string;
  days_left: number;
}

interface DocumentAlert {
  id: string;
  vehicle_id: string;
  license_plate: string;
  doc_type: string;
  expires_at: string;
  days_left: number;
}

interface RecentSale {
  id: string;
  sale_date: string;
  final_price_cop: number;
  customer_name: string;
  vehicle_info: string;
}

const STAGE_COLORS: Record<string, string> = {
  recepcion: "hsl(var(--chart-1))",
  diagnostico: "hsl(var(--chart-2))",
  alistamiento: "hsl(var(--chart-3))",
  publicado: "hsl(var(--chart-4))",
  bloqueado: "hsl(var(--chart-5))",
  vendido: "hsl(142 76% 36%)",
  entregado: "hsl(200 80% 50%)",
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    listedVehicles: 0,
    activeReservations: 0,
    depositTotal: 0,
    salesLast30Days: 0,
    salesTotal: 0,
    openWorkOrders: 0,
    pendingWorkItems: 0,
    monthlyExpenses: 0,
    expenseCount: 0,
    stageDistribution: [],
    complianceAlerts: [],
    documentAlerts: [],
    recentSales: [],
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile?.org_id) return;

      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysFromNow = addDays(today, 30);
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      const [
        vehiclesRes,
        listingRes,
        reservationsRes,
        salesRes,
        stagesRes,
        stageDefsRes,
        complianceRes,
        workOrdersRes,
        workItemsRes,
        expensesRes,
        documentAlertsRes,
        recentSalesRes,
      ] = await Promise.all([
        supabase.from("vehicles").select("id", { count: "exact" }).eq("is_archived", false),
        supabase.from("vehicle_listing").select("vehicle_id").eq("is_listed", true),
        supabase.from("reservations").select("deposit_amount_cop").eq("status", "active"),
        supabase.from("sales").select("final_price_cop, sale_date").eq("status", "active"),
        supabase.from("vehicles").select("stage_code").eq("is_archived", false),
        supabase.from("vehicle_stages").select("code, name").order("sort_order"),
        supabase.from("vehicle_compliance").select("vehicle_id, soat_expires_at, tecnomecanica_expires_at, vehicles(license_plate, brand)"),
        supabase.from("work_orders").select("id", { count: "exact" }).eq("status", "open"),
        supabase.from("work_order_items").select("id", { count: "exact" }).in("status", ["pending", "in_progress"]),
        supabase.from("vehicle_expenses")
          .select("amount_cop")
          .gte("incurred_at", format(monthStart, "yyyy-MM-dd"))
          .lte("incurred_at", format(monthEnd, "yyyy-MM-dd")),
        supabase.from("vehicle_files")
          .select("id, vehicle_id, doc_type, expires_at, vehicles(license_plate)")
          .not("expires_at", "is", null)
          .lte("expires_at", format(thirtyDaysFromNow, "yyyy-MM-dd"))
          .gte("expires_at", format(today, "yyyy-MM-dd"))
          .order("expires_at")
          .limit(10),
        supabase.from("sales")
          .select("id, sale_date, final_price_cop, customers(full_name), vehicle_snapshot")
          .eq("status", "active")
          .order("sale_date", { ascending: false })
          .limit(5),
      ]);

      // Process recent sales
      const recentSalesFiltered = (salesRes.data || []).filter(
        (s) => new Date(s.sale_date) >= thirtyDaysAgo
      );

      // Stage distribution with names
      const stageDefsMap = new Map((stageDefsRes.data || []).map(s => [s.code, s.name]));
      const stageCounts: Record<string, number> = {};
      (stagesRes.data || []).forEach((v) => {
        stageCounts[v.stage_code] = (stageCounts[v.stage_code] || 0) + 1;
      });

      // Compliance alerts
      const complianceAlerts: ComplianceAlert[] = [];
      (complianceRes.data || []).forEach((c) => {
        const vehicle = c.vehicles as any;
        if (!vehicle) return;
        
        if (c.soat_expires_at) {
          const soatDate = new Date(c.soat_expires_at);
          if (isBefore(soatDate, thirtyDaysFromNow)) {
            const daysLeft = Math.ceil((soatDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            complianceAlerts.push({
              vehicle_id: c.vehicle_id,
              license_plate: vehicle.license_plate || "N/A",
              brand: vehicle.brand || "",
              type: "soat",
              expires_at: c.soat_expires_at,
              days_left: daysLeft,
            });
          }
        }
        if (c.tecnomecanica_expires_at) {
          const tecnoDate = new Date(c.tecnomecanica_expires_at);
          if (isBefore(tecnoDate, thirtyDaysFromNow)) {
            const daysLeft = Math.ceil((tecnoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            complianceAlerts.push({
              vehicle_id: c.vehicle_id,
              license_plate: vehicle.license_plate || "N/A",
              brand: vehicle.brand || "",
              type: "tecnomecanica",
              expires_at: c.tecnomecanica_expires_at,
              days_left: daysLeft,
            });
          }
        }
      });
      complianceAlerts.sort((a, b) => a.days_left - b.days_left);

      // Document alerts
      const documentAlerts: DocumentAlert[] = (documentAlertsRes.data || []).map((d) => {
        const expiresAt = new Date(d.expires_at!);
        const daysLeft = Math.ceil((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: d.id,
          vehicle_id: d.vehicle_id,
          license_plate: (d.vehicles as any)?.license_plate || "N/A",
          doc_type: d.doc_type || "Documento",
          expires_at: d.expires_at!,
          days_left: daysLeft,
        };
      });

      // Recent sales with details
      const recentSales: RecentSale[] = (recentSalesRes.data || []).map((s) => {
        const snapshot = s.vehicle_snapshot as any;
        return {
          id: s.id,
          sale_date: s.sale_date,
          final_price_cop: s.final_price_cop,
          customer_name: (s.customers as any)?.full_name || "Cliente",
          vehicle_info: snapshot?.brand 
            ? `${snapshot.brand} ${snapshot.line || ""} ${snapshot.year || ""}`.trim()
            : "Vehículo",
        };
      });

      // Monthly expenses
      const monthlyExpenses = (expensesRes.data || []).reduce(
        (sum, e) => sum + (e.amount_cop || 0), 0
      );

      setStats({
        totalVehicles: vehiclesRes.count || 0,
        listedVehicles: listingRes.data?.length || 0,
        activeReservations: reservationsRes.data?.length || 0,
        depositTotal: (reservationsRes.data || []).reduce((sum, r) => sum + (r.deposit_amount_cop || 0), 0),
        salesLast30Days: recentSalesFiltered.length,
        salesTotal: recentSalesFiltered.reduce((sum, s) => sum + (s.final_price_cop || 0), 0),
        openWorkOrders: workOrdersRes.count || 0,
        pendingWorkItems: workItemsRes.count || 0,
        monthlyExpenses,
        expenseCount: expensesRes.data?.length || 0,
        stageDistribution: Object.entries(stageCounts).map(([stage_code, count]) => ({
          stage_code,
          name: stageDefsMap.get(stage_code) || stage_code,
          count,
          color: STAGE_COLORS[stage_code] || "hsl(var(--muted))",
        })),
        complianceAlerts: complianceAlerts.slice(0, 5),
        documentAlerts: documentAlerts.slice(0, 5),
        recentSales,
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

  const chartConfig = stats.stageDistribution.reduce((acc, s) => {
    acc[s.stage_code] = { label: s.name, color: s.color };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <AdminLayout
      title="Dashboard"
      breadcrumbs={[{ label: "Dashboard" }]}
      actions={<Button onClick={() => navigate("/admin/vehicles/new")}>Crear Vehículo</Button>}
    >
      <div className="space-y-6">
        {/* Primary KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Vehículos Totales" 
            value={stats.totalVehicles} 
            icon={Car} 
            onClick={() => navigate("/admin/vehicles")}
            description="Inventario activo"
          />
          <StatCard 
            title="Publicados" 
            value={stats.listedVehicles} 
            icon={Tag} 
            description="Listos para venta"
            trend={stats.listedVehicles > 0 ? "up" : "neutral"}
            trendValue={`${Math.round((stats.listedVehicles / Math.max(stats.totalVehicles, 1)) * 100)}% del inventario`}
          />
          <StatCard 
            title="Reservas Activas" 
            value={stats.activeReservations} 
            icon={Bookmark} 
            description={formatCOP(stats.depositTotal) + " en depósitos"}
            onClick={() => navigate("/admin/sales")}
          />
          <StatCard 
            title="Ventas (30 días)" 
            value={stats.salesLast30Days} 
            icon={DollarSign} 
            description={formatCOP(stats.salesTotal)}
            variant="primary"
            onClick={() => navigate("/admin/sales")}
          />
        </div>

        {/* Secondary KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Órdenes Abiertas" 
            value={stats.openWorkOrders} 
            icon={Wrench}
            description={`${stats.pendingWorkItems} items pendientes`}
            onClick={() => navigate("/admin/operations")}
          />
          <StatCard 
            title="Gastos del Mes" 
            value={formatCOP(stats.monthlyExpenses)} 
            icon={Receipt}
            description={`${stats.expenseCount} registros`}
          />
          <StatCard 
            title="Alertas Compliance" 
            value={stats.complianceAlerts.length} 
            icon={AlertTriangle}
            description="Vencen en 30 días"
            variant={stats.complianceAlerts.length > 0 ? "accent" : "default"}
            onClick={() => navigate("/admin/files")}
          />
          <StatCard 
            title="Documentos por Vencer" 
            value={stats.documentAlerts.length} 
            icon={FileWarning}
            description="Próximos 30 días"
            onClick={() => navigate("/admin/files")}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Stage Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Distribución por Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.stageDistribution.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={stats.stageDistribution} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100} 
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={4}>
                      {stats.stageDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos de distribución</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Ventas Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentSales.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin ventas recientes</p>
              ) : (
                <div className="space-y-3">
                  {stats.recentSales.map((sale) => (
                    <div 
                      key={sale.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/sales`)}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{sale.vehicle_info}</p>
                        <p className="text-xs text-muted-foreground">{sale.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">{formatCOP(sale.final_price_cop)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sale.sale_date), "dd MMM", { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Compliance Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Alertas SOAT / Tecnomecánica
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin/files")}>
                  Ver todas
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.complianceAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin alertas próximas</p>
              ) : (
                <div className="space-y-2">
                  {stats.complianceAlerts.map((alert, i) => (
                    <Link
                      key={`${alert.vehicle_id}-${alert.type}-${i}`}
                      to={`/admin/vehicles/${alert.vehicle_id}?tab=compliance`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                      <Badge variant={alert.days_left <= 7 ? "destructive" : "secondary"}>
                        {alert.days_left <= 0 ? "Vencido" : `${alert.days_left}d`}
                      </Badge>
                        <div>
                          <p className="text-sm font-medium">{alert.license_plate}</p>
                          <p className="text-xs text-muted-foreground">{alert.brand}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {alert.type === "soat" ? "SOAT" : "Tecnomecánica"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-warning" />
                  Documentos por Vencer
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin/files")}>
                  Ver todos
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.documentAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin documentos por vencer</p>
              ) : (
                <div className="space-y-2">
                  {stats.documentAlerts.map((doc) => (
                    <Link
                      key={doc.id}
                      to={`/admin/vehicles/${doc.vehicle_id}?tab=files`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={doc.days_left <= 7 ? "destructive" : "secondary"}>
                          {doc.days_left <= 0 ? "Vencido" : `${doc.days_left}d`}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{doc.license_plate}</p>
                          <p className="text-xs text-muted-foreground">{doc.doc_type}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(doc.expires_at), "dd MMM yyyy", { locale: es })}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
