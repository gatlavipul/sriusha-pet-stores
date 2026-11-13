import sql from "../app/api/utils/sql.js";

export async function recordStockMovement({
  productId,
  variantId = null,
  productName,
  variantLabel = null,
  changeAmount,
  previousStock,
  newStock,
  reason,
  notes = null,
  orderId = null,
  userId = null,
  userName = null,
}) {
  try {
    await sql`
      INSERT INTO stock_movements (
        product_id,
        variant_id,
        product_name,
        variant_label,
        change_amount,
        previous_stock,
        new_stock,
        reason,
        notes,
        order_id,
        performed_by_user_id,
        performed_by_name,
        created_at
      ) VALUES (
        ${productId},
        ${variantId},
        ${productName},
        ${variantLabel},
        ${changeAmount},
        ${previousStock},
        ${newStock},
        ${reason},
        ${notes},
        ${orderId},
        ${userId},
        ${userName},
        NOW()
      )
    `;
  } catch (err) {
    console.error("Failed to record stock movement:", err);
  }
}

/**
 * Restores stock idempotently when an order is cancelled and logs every movement.
 */
export async function restoreStockForOrder({ orderId, userId = null, userName = "System" }) {
  const claimed = await sql`
    UPDATE orders
    SET stock_restored = TRUE
    WHERE id = ${orderId} AND COALESCE(stock_restored, FALSE) = FALSE
    RETURNING id
  `;
  if (!claimed || claimed.length === 0) {
    return { restored: false, reason: "already_restored" };
  }

  const items = await sql`
    SELECT product_id, variant_id, variant_name, product_name, quantity
    FROM order_items
    WHERE order_id = ${orderId}
  `;

  for (const item of items) {
    if (!item.product_id) continue;
    const qty = Math.max(1, parseInt(item.quantity || 1, 10));

    if (item.variant_id) {
      const prevRows = await sql`
        SELECT stock_quantity, label FROM product_variants WHERE id = ${item.variant_id} LIMIT 1
      `;
      const prevStock = prevRows?.[0]?.stock_quantity ?? 0;
      const updatedVar = await sql`
        UPDATE product_variants
        SET stock_quantity = stock_quantity + ${qty}, updated_at = NOW()
        WHERE id = ${item.variant_id}
        RETURNING stock_quantity, label
      `;
      const newStock = updatedVar?.[0]?.stock_quantity ?? prevStock + qty;
      await recordStockMovement({
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.product_name,
        variantLabel: updatedVar?.[0]?.label || item.variant_name,
        changeAmount: qty,
        previousStock: prevStock,
        newStock,
        reason: "order_cancelled",
        notes: `Restored from cancelled order #${orderId}`,
        orderId,
        userId,
        userName,
      });
    } else {
      const prevRows = await sql`
        SELECT stock_quantity, name FROM products WHERE id = ${item.product_id} LIMIT 1
      `;
      const prevStock = prevRows?.[0]?.stock_quantity ?? 0;
      const updatedProd = await sql`
        UPDATE products
        SET stock_quantity = stock_quantity + ${qty}, updated_at = NOW()
        WHERE id = ${item.product_id}
        RETURNING stock_quantity, name
      `;
      const newStock = updatedProd?.[0]?.stock_quantity ?? prevStock + qty;
      await recordStockMovement({
        productId: item.product_id,
        productName: updatedProd?.[0]?.name || item.product_name,
        changeAmount: qty,
        previousStock: prevStock,
        newStock,
        reason: "order_cancelled",
        notes: `Restored from cancelled order #${orderId}`,
        orderId,
        userId,
        userName,
      });
    }
  }

  return { restored: true };
}

