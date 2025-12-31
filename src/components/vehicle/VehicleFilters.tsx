import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface VehicleStage {
  code: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  is_active?: boolean;
}

interface Filters {
  stage_code: string;
  branch_id: string;
  vehicle_class: string;
  is_listed: string;
  include_archived: boolean;
}

interface VehicleFiltersProps {
  filters: Filters;
  stages: VehicleStage[];
  branches: Branch[];
  onFilterChange: (key: keyof Filters, value: any) => void;
  onClear: () => void;
}

const VEHICLE_CLASSES = [
  { value: "AUTOMOVIL", label: "Automóvil" },
  { value: "CAMIONETA", label: "Camioneta" },
  { value: "CAMPERO", label: "Campero" },
  { value: "MOTOCICLETA", label: "Motocicleta" },
  { value: "BUS", label: "Bus" },
  { value: "CAMION", label: "Camión" },
];

export function VehicleFilters({
  filters,
  stages,
  branches,
  onFilterChange,
  onClear,
}: VehicleFiltersProps) {
  const hasActiveFilters =
    filters.stage_code !== "all" ||
    filters.branch_id !== "all" ||
    filters.vehicle_class !== "all" ||
    filters.is_listed !== "all" ||
    filters.include_archived;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.stage_code}
        onValueChange={(v) => onFilterChange("stage_code", v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos estados</SelectItem>
          {stages.map((s) => (
            <SelectItem key={s.code} value={s.code}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.branch_id}
        onValueChange={(v) => onFilterChange("branch_id", v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Sede" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas sedes</SelectItem>
          {branches
            .filter(b => b.is_active !== false || b.id === filters.branch_id)
            .map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}{b.is_active === false ? " (Inactiva)" : ""}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.vehicle_class}
        onValueChange={(v) => onFilterChange("vehicle_class", v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Clase" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas clases</SelectItem>
          {VEHICLE_CLASSES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.is_listed}
        onValueChange={(v) => onFilterChange("is_listed", v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Publicado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="true">Publicados</SelectItem>
          <SelectItem value="false">No publicados</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Switch
          id="archived"
          checked={filters.include_archived}
          onCheckedChange={(v) => onFilterChange("include_archived", v)}
        />
        <Label htmlFor="archived" className="text-sm text-muted-foreground">
          Archivados
        </Label>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
