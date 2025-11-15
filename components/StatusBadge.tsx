import { Badge } from "@/components/ui/badge"
import type { work_order_status } from "@/types/database"

interface StatusBadgeProps {
  status: work_order_status
}

const statusColors: Record<work_order_status, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  ASSIGNED: "bg-yellow-100 text-yellow-800 border-yellow-200",
  IN_PROGRESS: "bg-purple-100 text-purple-800 border-purple-200",
  WAITING_VALIDATION: "bg-orange-100 text-orange-800 border-orange-200",
  BLOCKED: "bg-red-100 text-red-800 border-red-200",
  CLOSED: "bg-green-100 text-green-800 border-green-200",
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={statusColors[status] || "bg-gray-100 text-gray-800"}
    >
      {status.replace("_", " ")}
    </Badge>
  )
}

