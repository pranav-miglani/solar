import { Badge } from "@/components/ui/badge"

interface EfficiencyBadgeProps {
  category: string
  efficiencyPct: number
}

export function EfficiencyBadge({ category, efficiencyPct }: EfficiencyBadgeProps) {
  const colors: Record<string, string> = {
    Healthy: "bg-green-100 text-green-800 border-green-200",
    Suboptimal: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Critical: "bg-red-100 text-red-800 border-red-200",
  }

  return (
    <Badge variant="outline" className={colors[category] || "bg-gray-100 text-gray-800"}>
      {category} ({efficiencyPct.toFixed(1)}%)
    </Badge>
  )
}

