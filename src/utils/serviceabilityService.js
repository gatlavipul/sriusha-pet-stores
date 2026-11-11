import sql from "../app/api/utils/sql.js";
import logger from "./logger.js";

/**
 * Sri Usha Vet & Pet Stores - Delivery Serviceability Engine
 * Validates customer delivery pincodes, calculates dynamic delivery charges,
 * and computes estimated dispatch arrival times.
 */

export async function checkServiceability(pincode, subtotal = 0) {
  if (!pincode) {
    return {
      serviceable: false,
      reason: "Pincode is required to verify doorstep delivery.",
    };
  }

  const cleanPincode = String(pincode).trim().replace(/\s+/g, "");

  try {
    const zones = await sql`
      SELECT 
        id, pincode, area_name, city, state, 
        delivery_charge, free_delivery_threshold, 
        estimated_delivery_time, is_active
      FROM delivery_serviceability_zones
      WHERE pincode = ${cleanPincode} AND is_active = TRUE
      LIMIT 1
    `;

    if (zones.length === 0) {
      return {
        serviceable: false,
        pincode: cleanPincode,
        reason: `Delivery is currently not serviceable to pincode ${cleanPincode}. We currently deliver across Hyderabad & Secunderabad.`,
      };
    }

    const zone = zones[0];
    const threshold = parseFloat(zone.free_delivery_threshold || 500);
    const standardCharge = parseFloat(zone.delivery_charge || 40);
    const isFree = subtotal >= threshold;
    const finalDeliveryCharge = isFree ? 0 : standardCharge;

    return {
      serviceable: true,
      pincode: cleanPincode,
      areaName: zone.area_name,
      city: zone.city,
      state: zone.state,
      deliveryCharge: finalDeliveryCharge,
      standardCharge,
      freeDeliveryThreshold: threshold,
      isFreeDelivery: isFree,
      estimatedDeliveryTime: zone.estimated_delivery_time || "Same-day in 2-4 hours",
      message: isFree
        ? `Eligible for FREE delivery to ${zone.area_name}! (${zone.estimated_delivery_time})`
        : `Doorstep delivery available to ${zone.area_name} for ₹${standardCharge.toFixed(0)} (Free over ₹${threshold.toFixed(0)})`,
    };
  } catch (error) {
    logger.error("check_serviceability_error", "Failed to check delivery serviceability", error, { pincode: cleanPincode });
    // In case of transient db error, allow fallback for Hyderabad pincodes starting with 500
    if (cleanPincode.startsWith("500") && cleanPincode.length === 6) {
      return {
        serviceable: true,
        pincode: cleanPincode,
        areaName: "Hyderabad Region",
        city: "Hyderabad",
        state: "Telangana",
        deliveryCharge: subtotal >= 500 ? 0 : 40,
        freeDeliveryThreshold: 500,
        estimatedDeliveryTime: "Same-day in 2-4 hours",
        message: "Doorstep delivery available in Hyderabad.",
      };
    }

    return {
      serviceable: false,
      pincode: cleanPincode,
      reason: "Could not verify pincode serviceability at this moment.",
    };
  }
}

