export type CommercialInvalidationKey = "reservations" | "sales" | "vehicle";

export interface CommercialModuleEvent {
  toast?: {
    message: string;
    type?: "success" | "warning";
  };
  refresh?: boolean;
  invalidations?: CommercialInvalidationKey[];
}
