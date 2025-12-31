import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
  variant?: "default" | "primary" | "accent";
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendValue,
  className,
  variant = "default",
  onClick,
}: StatCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/30",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "accent" && "bg-accent text-accent-foreground",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p
              className={cn(
                "text-sm font-medium",
                variant === "default" ? "text-muted-foreground" : "opacity-80"
              )}
            >
              {title}
            </p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p
                className={cn(
                  "text-xs",
                  variant === "default" ? "text-muted-foreground" : "opacity-70"
                )}
              >
                {description}
              </p>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "rounded-lg p-2.5",
                variant === "default"
                  ? "bg-primary/10 text-primary"
                  : "bg-background/10"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        {trend && trendValue && (
          <div className="mt-3 flex items-center gap-1.5">
            <TrendIcon
              className={cn(
                "h-4 w-4",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
                trend === "neutral" && "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              {trendValue}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
