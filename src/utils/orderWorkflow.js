/**
 * Sri Usha Vet & Pet Stores - Centralized Order & Logistics Workflow Configuration
 * Single Source of Truth for Status Definitions, Allowed Transitions, and Role Boundaries.
 */

export const ORDER_STATUS = {
  PLACED: "placed",
  PRESCRIPTION_REVIEW: "prescription_review",
  CONFIRMED: "confirmed",
  PACKING: "packing",
  READY_FOR_DELIVERY: "ready_for_delivery",
  ASSIGNED: "assigned",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  DELIVERY_FAILED: "delivery_failed",
  CANCELLED: "cancelled",
};

export const ORDER_STATUS_METADATA = {
  [ORDER_STATUS.PLACED]: {
    key: ORDER_STATUS.PLACED,
    label: "Order Placed",
    customerLabel: "Order Placed",
    description: "Order received and stock reserved. Awaiting confirmation.",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    customerDescription: "We have received your order and are reviewing it.",
    timelineStep: 1,
  },
  [ORDER_STATUS.PRESCRIPTION_REVIEW]: {
    key: ORDER_STATUS.PRESCRIPTION_REVIEW,
    label: "Prescription Review",
    customerLabel: "Prescription Review",
    description: "Veterinary prescription pending approval by licensed staff.",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
    customerDescription: "Our veterinary staff is reviewing your uploaded prescription.",
    timelineStep: 1.5,
  },
  [ORDER_STATUS.CONFIRMED]: {
    key: ORDER_STATUS.CONFIRMED,
    label: "Confirmed",
    customerLabel: "Order Confirmed",
    description: "Order confirmed by store. Ready for warehouse packing.",
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
    customerDescription: "Your order is confirmed and sent to our pharmacy and store team.",
    timelineStep: 2,
  },
  [ORDER_STATUS.PACKING]: {
    key: ORDER_STATUS.PACKING,
    label: "Being Packed",
    customerLabel: "Being Packed",
    description: "Items being picked, verified, and safely packed.",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
    customerDescription: "Our staff is carefully picking and packing your pet supplies.",
    timelineStep: 3,
  },
  [ORDER_STATUS.READY_FOR_DELIVERY]: {
    key: ORDER_STATUS.READY_FOR_DELIVERY,
    label: "Ready for Delivery",
    customerLabel: "Ready for Delivery",
    description: "Package sealed and staged at dispatch counter.",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    customerDescription: "Packed and ready for dispatch at our Uppal store.",
    timelineStep: 4,
  },
  [ORDER_STATUS.ASSIGNED]: {
    key: ORDER_STATUS.ASSIGNED,
    label: "Driver Assigned",
    customerLabel: "Driver Assigned",
    description: "Assigned to a delivery partner for doorstep transit.",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    customerDescription: "A delivery partner has been assigned to transport your package.",
    timelineStep: 4,
  },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: {
    key: ORDER_STATUS.OUT_FOR_DELIVERY,
    label: "Out for Delivery",
    customerLabel: "Out for Delivery",
    description: "Driver is in transit navigating to the customer's delivery address.",
    badgeClass: "bg-orange-50 text-orange-800 border-orange-200",
    customerDescription: "Your order is on its way to your doorstep right now.",
    timelineStep: 5,
  },
  [ORDER_STATUS.DELIVERED]: {
    key: ORDER_STATUS.DELIVERED,
    label: "Delivered",
    customerLabel: "Delivered",
    description: "Package successfully delivered. COD payment collected if applicable.",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    customerDescription: "Package delivered to your doorstep. Thank you for shopping with Sri Usha!",
    timelineStep: 6,
  },
  [ORDER_STATUS.DELIVERY_FAILED]: {
    key: ORDER_STATUS.DELIVERY_FAILED,
    label: "Delivery Attempt Failed",
    customerLabel: "Delivery Attempt Failed",
    description: "Driver could not complete delivery. Awaiting admin re-dispatch or review.",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    customerDescription: "Our delivery partner could not reach you. Our support team will assist you shortly.",
    timelineStep: -1,
  },
  [ORDER_STATUS.CANCELLED]: {
    key: ORDER_STATUS.CANCELLED,
    label: "Cancelled",
    customerLabel: "Cancelled",
    description: "Order cancelled. Product stock safely restored.",
    badgeClass: "bg-red-50 text-red-800 border-red-200",
    customerDescription: "This order has been cancelled.",
    timelineStep: -2,
  },
};

/**
 * Standard Customer Timeline Stages
 */
export const CUSTOMER_TIMELINE_STAGES = [
  { key: ORDER_STATUS.PLACED, label: "Order Placed", step: 1 },
  { key: ORDER_STATUS.CONFIRMED, label: "Confirmed", step: 2 },
  { key: ORDER_STATUS.PACKING, label: "Being Packed", step: 3 },
  { key: ORDER_STATUS.READY_FOR_DELIVERY, label: "Ready for Delivery", step: 4 },
  { key: ORDER_STATUS.OUT_FOR_DELIVERY, label: "Out for Delivery", step: 5 },
  { key: ORDER_STATUS.DELIVERED, label: "Delivered", step: 6 },
];

/**
 * Role-Based Allowed Transitions Map
 */
export const ALLOWED_TRANSITIONS = {
  admin: {
    [ORDER_STATUS.PLACED]: [ORDER_STATUS.PRESCRIPTION_REVIEW, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PRESCRIPTION_REVIEW]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PACKING, ORDER_STATUS.READY_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PACKING]: [ORDER_STATUS.READY_FOR_DELIVERY, ORDER_STATUS.ASSIGNED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.READY_FOR_DELIVERY]: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.READY_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.DELIVERY_FAILED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DELIVERY_FAILED]: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.READY_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: [ORDER_STATUS.PLACED], // Admin exception override to recover accidentally cancelled orders
  },
  delivery_partner: {
    [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.OUT_FOR_DELIVERY],
    [ORDER_STATUS.READY_FOR_DELIVERY]: [ORDER_STATUS.OUT_FOR_DELIVERY],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.OUT_FOR_DELIVERY],
    [ORDER_STATUS.PACKING]: [ORDER_STATUS.OUT_FOR_DELIVERY],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.DELIVERY_FAILED],
    [ORDER_STATUS.PLACED]: [ORDER_STATUS.OUT_FOR_DELIVERY],
    [ORDER_STATUS.PRESCRIPTION_REVIEW]: [],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.DELIVERY_FAILED]: [],
    [ORDER_STATUS.CANCELLED]: [],
  },
  customer: {
    [ORDER_STATUS.PLACED]: [ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PRESCRIPTION_REVIEW]: [ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PACKING]: [ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.READY_FOR_DELIVERY]: [ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.ASSIGNED]: [], // Cannot cancel once driver is assigned
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [],
    [ORDER_STATUS.DELIVERY_FAILED]: [],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: [],
  },
};

/**
 * Validates whether a requested transition is permitted for the given role.
 */
export function canTransition(currentStatus, targetStatus, role = "admin") {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true;

  const roleRules = ALLOWED_TRANSITIONS[role];
  if (!roleRules) return false;

  const allowedNext = roleRules[currentStatus] || [];
  return allowedNext.includes(targetStatus);
}

/**
 * Returns a human-friendly error or null if valid.
 */
export function validateTransition(currentStatus, targetStatus, role = "admin") {
  if (currentStatus === targetStatus) return null;

  const roleRules = ALLOWED_TRANSITIONS[role];
  if (!roleRules) {
    return `Unrecognized role '${role}'. Transition denied.`;
  }

  const allowedNext = roleRules[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    const roleName = role === "delivery_partner" ? "Delivery partners" : role === "customer" ? "Customers" : "Administrators";
    if (allowedNext.length === 0) {
      return `${roleName} cannot change status of order currently in '${currentStatus}'. This is a terminal or protected stage.`;
    }
    return `${roleName} cannot move order from '${currentStatus}' to '${targetStatus}'. Allowed next stages: [${allowedNext.join(", ")}].`;
  }

  return null;
}

/**
 * Checks if a customer can cancel an order in this status
 */
export function isCancellableByCustomer(status) {
  const allowed = [
    ORDER_STATUS.PLACED,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PACKING,
    ORDER_STATUS.READY_FOR_DELIVERY,
  ];
  return allowed.includes(status);
}

/**
 * Get status color classes
 */
export function getStatusBadgeClass(status) {
  return ORDER_STATUS_METADATA[status]?.badgeClass || "bg-gray-100 text-gray-800 border-gray-200";
}

/**
 * All valid primary statuses list
 */
export const ALL_ORDER_STATUSES = Object.values(ORDER_STATUS);

