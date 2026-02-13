import { cn } from "@/lib/utils";

export type InventoryKpiFilter =
  | "all"
  | "active"
  | "published"
  | "archived"
  | "soat_due"
  | "tecnomecanica_due";

interface InventoryKpiValues {
  active: number;
  published: number;
  archived: number;
  soatDue: number;
  tecnomecanicaDue: number;
}

interface InventoryKpisProps {
  values: InventoryKpiValues;
  activeFilter: InventoryKpiFilter;
  onSelectFilter?: (filter: InventoryKpiFilter) => void;
}

const KPI_ITEMS: Array<{
  key: Exclude<InventoryKpiFilter, "all">;
  label: string;
  valueKey: keyof InventoryKpiValues;
}> = [
  { key: "active", label: "Total activos", valueKey: "active" },
  { key: "published", label: "Publicados", valueKey: "published" },
  { key: "archived", label: "Archivados", valueKey: "archived" },
  { key: "soat_due", label: "SOAT <= 30 días", valueKey: "soatDue" },
  {
    key: "tecnomecanica_due",
    label: "Tecnomecánica <= 30 días",
    valueKey: "tecnomecanicaDue",
  },
];

export function InventoryKpis({
  values,
  activeFilter,
  onSelectFilter,
}: InventoryKpisProps) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      {KPI_ITEMS.map((item) => {
        const isActive = activeFilter === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectFilter?.(isActive ? "all" : item.key)}
            className={cn(
              "rounded-lg border bg-card px-3 py-2 text-left transition-colors",
              "hover:border-primary/40 hover:bg-primary/5",
              isActive && "border-primary bg-primary/10"
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="text-xl font-semibold">{values[item.valueKey]}</p>
          </button>
        );
      })}
    </div>
  );
}
