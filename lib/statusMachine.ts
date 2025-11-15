import type { work_order_status } from "@/types/database"

const VALID_TRANSITIONS: Record<work_order_status, work_order_status[]> = {
  OPEN: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_VALIDATION", "BLOCKED"],
  WAITING_VALIDATION: ["CLOSED"],
  BLOCKED: ["IN_PROGRESS"],
  CLOSED: [], // Terminal state
}

export function validateStatusTransition(
  oldStatus: work_order_status,
  newStatus: work_order_status
): boolean {
  if (oldStatus === newStatus) {
    return true // No change is valid
  }

  const allowedTransitions = VALID_TRANSITIONS[oldStatus]
  return allowedTransitions.includes(newStatus)
}

export function getNextValidStatuses(
  currentStatus: work_order_status
): work_order_status[] {
  return VALID_TRANSITIONS[currentStatus] || []
}

export function canTransitionTo(
  currentStatus: work_order_status,
  targetStatus: work_order_status
): boolean {
  return validateStatusTransition(currentStatus, targetStatus)
}

