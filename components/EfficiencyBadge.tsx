import { Badge } from "@/components/ui/badge"

interface EfficiencyBadgeProps {
  category: string
  efficiencyPct: number
}

export function EfficiencyBadge({ category, efficiencyPct }: EfficiencyBadgeProps) {
  const colors: Record<string, string> = {
    Healthy: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    Suboptimal: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    Critical: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  }

  return (
    <Badge variant="outline" className={colors[category] || "bg-muted text-muted-foreground border-border"}>
      {category} ({efficiencyPct.toFixed(1)}%)
    </Badge>
  )
}

