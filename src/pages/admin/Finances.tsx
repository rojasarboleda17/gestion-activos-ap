import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCOP, formatDate } from "@/lib/format";
import { 
  DollarSign, TrendingUp, TrendingDown, Wallet, Receipt, 
  Car, Search, Calendar, Percent, Clock, AlertCircle, ChevronRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, Cell, LineChart, Line, ResponsiveContainer } from "recharts";

interface VehicleFinancial {
  id: string;
  license_plate: string | null;
  brand: string;
  is_archived: boolean;
  line: string | null;
  stage_code: string;
  created_at: string;
  
  // Costs
  purchase_price: number;
  purchase_date: string | null;
  total_expenses: number;
  total_cost: number;
  
  // Sale
  is_sold: boolean;
  sale_price: number;
  sale_date: string | null;
  customer_name: string | null;
  
  // Payments
  total_payments_in: number;
  total_payments_out: number;
  pending_balance: number;
  
  // Metrics
  gross_profit: number;
  margin_percent: number;
  roi: number;
  days_in_inventory: number;
}

interface GlobalStats {
  totalVehicles: number;
  totalInventoryValue: number;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  avgDaysInInventory: number;
  totalPendingBalance: number;
  vehiclesWithPendingPayments: number;
}

export default function AdminFinances() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<VehicleFinancial[]>([]);
  
  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profitFilter, setProfitFilter] = useState("all");
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = subMonths(end, 6);
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.org_id) return;
      setLoading(true);

      try {
        // Fetch all vehicles with their financial data
        const [vehiclesRes, financialsRes, expensesRes, salesRes, paymentsRes] = await Promise.all([
          supabase
            .from("vehicles")
            .select("id, license_plate, brand, line, stage_code, created_at"),
          supabase
            .from("vehicle_financials")
            .select("vehicle_id, purchase_price_cop, purchase_date"),
          supabase
            .from("vehicle_expenses")
            .select("vehicle_id, amount_cop"),
          supabase
            .from("sales")
            .select("id, vehicle_id, final_price_cop, sale_date, status, customers(full_name)")
            .eq("status", "active"),
          supabase
            .from("sale_payments")
            .select("sale_id, amount_cop, direction"),
        ]);

        // Create lookup maps
        const financialsMap = new Map(
          (financialsRes.data || []).map(f => [f.vehicle_id, f])
        );
        
        const expensesMap = new Map<string, number>();
        (expensesRes.data || []).forEach(e => {
          expensesMap.set(e.vehicle_id, (expensesMap.get(e.vehicle_id) || 0) + (e.amount_cop || 0));
        });
        
        const salesMap = new Map(
          (salesRes.data || []).map(s => [s.vehicle_id, s])
        );
        
        const paymentsMap = new Map<string, { in: number; out: number }>();
        (paymentsRes.data || []).forEach(p => {
          const sale = (salesRes.data || []).find(s => s.id === p.sale_id);
          if (sale) {
            const current = paymentsMap.get(sale.vehicle_id) || { in: 0, out: 0 };
            if (p.direction === "in") {
              current.in += p.amount_cop;
            } else {
              current.out += p.amount_cop;
            }
            paymentsMap.set(sale.vehicle_id, current);
          }
        });

        // Build vehicle financials
        const vehicleFinancials: VehicleFinancial[] = (vehiclesRes.data || []).map(v => {
          const financials = financialsMap.get(v.id);
          const expenses = expensesMap.get(v.id) || 0;
          const sale = salesMap.get(v.id);
          const payments = paymentsMap.get(v.id) || { in: 0, out: 0 };
          
          const purchasePrice = financials?.purchase_price_cop || 0;
          const totalCost = purchasePrice + expenses;
          const salePrice = sale?.final_price_cop || 0;
          const netPayments = payments.in - payments.out;
          const pendingBalance = salePrice - netPayments;
          const grossProfit = salePrice - totalCost;
          const marginPercent = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;
          const roi = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;
          
          const startDate = financials?.purchase_date 
            ? parseISO(financials.purchase_date) 
            : parseISO(v.created_at);
          const endDate = sale?.sale_date ? parseISO(sale.sale_date) : new Date();
          const daysInInventory = differenceInDays(endDate, startDate);
          
          return {
            id: v.id,
            license_plate: v.license_plate,
            brand: v.brand,
            line: v.line,
            stage_code: v.stage_code,
            created_at: v.created_at,
            purchase_price: purchasePrice,
            purchase_date: financials?.purchase_date || null,
            is_archived: !!(v as any).is_archived,
            total_expenses: expenses,
            total_cost: totalCost,
            is_sold: !!sale,
            sale_price: salePrice,
            sale_date: sale?.sale_date || null,
            customer_name: (sale?.customers as any)?.full_name || null,
            total_payments_in: payments.in,
            total_payments_out: payments.out,
            pending_balance: sale ? pendingBalance : 0,
            gross_profit: grossProfit,
            margin_percent: marginPercent,
            roi,
            days_in_inventory: daysInInventory,
          };
        });

        setVehicles(vehicleFinancials);
      } catch (err) {
        console.error("Error fetching financials:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.org_id]);

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const plate = v.license_plate?.toLowerCase() || "";
        const brand = v.brand.toLowerCase();
        const line = v.line?.toLowerCase() || "";
        if (!plate.includes(q) && !brand.includes(q) && !line.includes(q)) return false;
      }
      
      // Status filter
      if (statusFilter === "sold" && !v.is_sold) return false;
      if (statusFilter === "inventory" && (v.is_sold || v.is_archived)) return false;
      if (statusFilter === "pending" && v.pending_balance <= 0) return false;
      
      // Profit filter
      if (profitFilter === "profit" && v.gross_profit < 0) return false;
      if (profitFilter === "loss" && v.gross_profit >= 0) return false;
      
      return true;
    });
  }, [vehicles, search, statusFilter, profitFilter]);

  // Calculate global stats
  const stats: GlobalStats = useMemo(() => {
    const inventoryVehicles = vehicles.filter(v => !v.is_sold && !v.is_archived);
    const soldVehicles = vehicles.filter(v => v.is_sold);
    const vehiclesWithPending = soldVehicles.filter(v => v.pending_balance > 0);
    
    return {
      totalVehicles: vehicles.length,
      totalInventoryValue: inventoryVehicles.reduce((sum, v) => sum + v.total_cost, 0),
      totalSales: soldVehicles.length,
      totalRevenue: soldVehicles.reduce((sum, v) => sum + v.sale_price, 0),
      totalProfit: soldVehicles.reduce((sum, v) => sum + v.gross_profit, 0),
      avgMargin: soldVehicles.length > 0 
        ? soldVehicles.reduce((sum, v) => sum + v.margin_percent, 0) / soldVehicles.length 
        : 0,
      avgDaysInInventory: soldVehicles.length > 0
        ? soldVehicles.reduce((sum, v) => sum + v.days_in_inventory, 0) / soldVehicles.length
        : 0,
      totalPendingBalance: vehiclesWithPending.reduce((sum, v) => sum + v.pending_balance, 0),
      vehiclesWithPendingPayments: vehiclesWithPending.length,
    };
  }, [vehicles]);

  // Profit distribution for chart
  const profitDistribution = useMemo(() => {
    const soldWithCosts = vehicles.filter(v => v.is_sold && v.total_cost > 0);
    const ranges = [
      { label: "Pérdida", min: -Infinity, max: 0, count: 0, color: "hsl(var(--destructive))" },
      { label: "0-5%", min: 0, max: 5, count: 0, color: "hsl(var(--warning))" },
      { label: "5-10%", min: 5, max: 10, count: 0, color: "hsl(var(--chart-3))" },
      { label: "10-15%", min: 10, max: 15, count: 0, color: "hsl(var(--chart-4))" },
      { label: ">15%", min: 15, max: Infinity, count: 0, color: "hsl(var(--chart-1))" },
    ];
    
    soldWithCosts.forEach(v => {
      for (const range of ranges) {
        if (v.margin_percent >= range.min && v.margin_percent < range.max) {
          range.count++;
          break;
        }
      }
    });
    
    return ranges;
  }, [vehicles]);

  if (loading) {
    return (
      <AdminLayout 
        title="Finanzas" 
        breadcrumbs={[{ label: "Finanzas" }]}
      >
        <LoadingState variant="cards" />
      </AdminLayout>
    );
  }

  const chartConfig = profitDistribution.reduce((acc, r) => {
    acc[r.label] = { label: r.label, color: r.color };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <AdminLayout
      title="Finanzas"
      breadcrumbs={[{ label: "Finanzas" }]}
    >
      <div className="space-y-6">
        {/* Primary KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Valor en Inventario"
            value={formatCOP(stats.totalInventoryValue)}
            icon={Car}
            description={`${vehicles.filter(v => !v.is_sold).length} vehículos`}
          />
          <StatCard
            title="Ventas Totales"
            value={formatCOP(stats.totalRevenue)}
            icon={DollarSign}
            description={`${stats.totalSales} vehículos vendidos`}
            variant="primary"
          />
          <StatCard
            title="Utilidad Total"
            value={formatCOP(stats.totalProfit)}
            icon={stats.totalProfit >= 0 ? TrendingUp : TrendingDown}
            description={`Margen promedio: ${stats.avgMargin.toFixed(1)}%`}
            variant={stats.totalProfit >= 0 ? "default" : "accent"}
          />
          <StatCard
            title="Saldo Pendiente"
            value={formatCOP(stats.totalPendingBalance)}
            icon={Wallet}
            description={`${stats.vehiclesWithPendingPayments} ventas por cobrar`}
            variant={stats.vehiclesWithPendingPayments > 0 ? "accent" : "default"}
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Días Prom. Inventario</p>
                  <p className="text-2xl font-bold">{Math.round(stats.avgDaysInInventory)}</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ROI Promedio</p>
                  <p className="text-2xl font-bold">
                    {vehicles.filter(v => v.is_sold && v.total_cost > 0).length > 0
                      ? (vehicles.filter(v => v.is_sold && v.total_cost > 0)
                          .reduce((sum, v) => sum + v.roi, 0) / 
                          vehicles.filter(v => v.is_sold && v.total_cost > 0).length).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <Percent className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vehículos con Pérdida</p>
                  <p className="text-2xl font-bold text-destructive">
                    {vehicles.filter(v => v.is_sold && v.gross_profit < 0).length}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-destructive/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vehículos Rentables</p>
                  <p className="text-2xl font-bold text-green-600">
                    {vehicles.filter(v => v.is_sold && v.gross_profit >= 0).length}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribución de Márgenes</CardTitle>
              <CardDescription>Vehículos vendidos por rango de margen</CardDescription>
            </CardHeader>
            <CardContent>
              {profitDistribution.some(r => r.count > 0) ? (
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={profitDistribution} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="label" 
                      width={60} 
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={4}>
                      {profitDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sin datos de ventas con costos registrados
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pending Payments Alert */}
          <Card className={stats.vehiclesWithPendingPayments > 0 ? "border-warning/50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className={`h-5 w-5 ${stats.vehiclesWithPendingPayments > 0 ? "text-warning" : "text-muted-foreground"}`} />
                Ventas con Saldo Pendiente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.vehiclesWithPendingPayments === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Todas las ventas están cobradas al 100%
                </p>
              ) : (
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {vehicles
                    .filter(v => v.is_sold && v.pending_balance > 0)
                    .sort((a, b) => b.pending_balance - a.pending_balance)
                    .slice(0, 5)
                    .map(v => (
                      <Link
                        key={v.id}
                        to={`/admin/vehicles/${v.id}?tab=financials`}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="font-mono text-sm font-medium">
                            {v.license_plate || "S/P"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {v.brand} {v.line}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-warning">
                            {formatCOP(v.pending_balance)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  {stats.vehiclesWithPendingPayments > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{stats.vehiclesWithPendingPayments - 5} más...
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalle por Vehículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa, marca..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="inventory">En inventario</SelectItem>
                  <SelectItem value="sold">Vendidos</SelectItem>
                  <SelectItem value="pending">Saldo pendiente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={profitFilter} onValueChange={setProfitFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Rentabilidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="profit">Con utilidad</SelectItem>
                  <SelectItem value="loss">Con pérdida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {filteredVehicles.length === 0 ? (
              <EmptyState
                icon={Car}
                title="Sin vehículos"
                description="No hay vehículos que coincidan con los filtros."
              />
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehículo</TableHead>
                      <TableHead className="text-right">Costo Total</TableHead>
                      <TableHead className="text-right">Precio Venta</TableHead>
                      <TableHead className="text-right">Utilidad</TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-center">Días</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.slice(0, 50).map(v => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div>
                            <p className="font-mono text-sm font-medium">
                              {v.license_plate || "S/P"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {v.brand} {v.line}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCOP(v.total_cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.is_sold ? formatCOP(v.sale_price) : "—"}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          v.is_sold 
                            ? v.gross_profit >= 0 ? "text-green-600" : "text-destructive"
                            : ""
                        }`}>
                          {v.is_sold ? formatCOP(v.gross_profit) : "—"}
                        </TableCell>
                        <TableCell className={`text-right ${
                          v.is_sold 
                            ? v.margin_percent >= 0 ? "text-green-600" : "text-destructive"
                            : ""
                        }`}>
                          {v.is_sold ? `${v.margin_percent.toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.pending_balance > 0 ? (
                            <Badge variant="outline" className="text-warning border-warning">
                              {formatCOP(v.pending_balance)}
                            </Badge>
                          ) : v.is_sold ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Pagado
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {v.days_in_inventory}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/vehicles/${v.id}?tab=financials`)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredVehicles.length > 50 && (
                  <div className="p-3 text-center text-sm text-muted-foreground border-t">
                    Mostrando 50 de {filteredVehicles.length} vehículos
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
