import { LucideIcon, Inbox, FileX, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "search" | "error";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  const Icon = icon || (variant === "search" ? Search : variant === "error" ? AlertCircle : Inbox);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div
        className={cn(
          "mb-4 rounded-full p-4",
          variant === "error" ? "bg-destructive/10" : "bg-muted"
        )}
      >
        <Icon
          className={cn(
            "h-8 w-8",
            variant === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant={variant === "error" ? "destructive" : "default"}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
