import { Badge } from "@/components/ui/badge"
import type { work_order_status } from "@/types/database"

interface StatusBadgeProps {
  status: work_order_status
}

const statusColors: Record<work_order_status, string> = {
  OPEN: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  ASSIGNED: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  IN_PROGRESS: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  WAITING_VALIDATION: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  BLOCKED: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  CLOSED: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={statusColors[status] || "bg-muted text-muted-foreground border-border"}
    >
      {status.replace("_", " ")}
    </Badge>
  )
}

