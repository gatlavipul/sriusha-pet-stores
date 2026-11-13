import sql from "@/app/api/utils/sql";
import { requireUser, requireAdmin, sanitizeText } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get("order_id");
    const isAdmin = authResult.user.role === "admin";

    let tickets;
    if (isAdmin && searchParams.get("scope") === "all") {
      tickets = await sql`
        SELECT 
          t.*,
          u.name as user_name,
          u.email as user_email,
          o.order_number,
          o.total_amount as order_total,
          o.status as order_status
        FROM support_tickets t
        JOIN auth_users u ON u.id = t.user_id
        LEFT JOIN orders o ON o.id = t.order_id
        ORDER BY t.created_at DESC
        LIMIT 100
      `;
    } else if (orderIdParam) {
      const orderId = parseInt(orderIdParam, 10);
      tickets = await sql`
        SELECT t.*, o.order_number
        FROM support_tickets t
        LEFT JOIN orders o ON o.id = t.order_id
        WHERE t.user_id = ${authResult.user.id} AND t.order_id = ${orderId}
        ORDER BY t.created_at DESC
      `;
    } else {
      tickets = await sql`
        SELECT t.*, o.order_number
        FROM support_tickets t
        LEFT JOIN orders o ON o.id = t.order_id
        WHERE t.user_id = ${authResult.user.id}
        ORDER BY t.created_at DESC
        LIMIT 50
      `;
    }

    return Response.json({ tickets });
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    return Response.json({ error: "Failed to load support tickets" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const { order_id, category, subject, description } = body;

    const cleanCategory = sanitizeText(category || "general", 50);
    const cleanSubject = sanitizeText(subject || "", 200);
    const cleanDesc = sanitizeText(description || "", 2000);

    if (!cleanSubject || cleanSubject.length < 3) {
      return Response.json({ error: "A brief subject is required." }, { status: 400 });
    }
    if (!cleanDesc || cleanDesc.length < 10) {
      return Response.json(
        { error: "Please describe your query or issue in detail (at least 10 characters)." },
        { status: 400 }
      );
    }

    let validOrderId = null;
    if (order_id) {
      const parsedOrderId = parseInt(order_id, 10);
      const orders = await sql`
        SELECT id FROM orders WHERE id = ${parsedOrderId} AND user_id = ${authResult.user.id} LIMIT 1
      `;
      if (orders.length > 0) {
        validOrderId = orders[0].id;
      }
    }

    const inserted = await sql`
      INSERT INTO support_tickets (
        user_id, order_id, category, subject, description, status
      ) VALUES (
        ${authResult.user.id}, ${validOrderId}, ${cleanCategory}, ${cleanSubject}, ${cleanDesc}, 'open'
      )
      RETURNING *
    `;

    // Notify admin
    await sql`
      INSERT INTO admin_notifications (
        type, order_id, title, message
      ) VALUES (
        'support_ticket',
        ${validOrderId},
        ${`Support Ticket #${inserted[0].id}: ${cleanSubject.slice(0, 50)}`},
        ${`Customer ${authResult.user.name || authResult.user.email} opened ticket (${cleanCategory}): ${cleanSubject}`}
      )
    `.catch(() => {});

    return Response.json({ success: true, ticket: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return Response.json({ error: "Failed to submit support request" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult.error) {
      return Response.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const { ticket_id, status, resolution_notes, refund_status, refund_amount } = body;

    if (!ticket_id) {
      return Response.json({ error: "Ticket ID is required" }, { status: 400 });
    }

    const cleanStatus = sanitizeText(status || "in_progress", 30);
    const cleanNotes = sanitizeText(resolution_notes || "", 1000);
    const cleanRefundStatus = sanitizeText(refund_status || "none", 30);
    const numericRefund = refund_amount ? Math.max(0, parseFloat(refund_amount)) : 0;

    const updated = await sql`
      UPDATE support_tickets
      SET 
        status = ${cleanStatus},
        resolution_notes = ${cleanNotes},
        refund_status = ${cleanRefundStatus},
        refund_amount = ${numericRefund},
        updated_at = NOW()
      WHERE id = ${ticket_id}
      RETURNING *
    `;

    if (updated.length === 0) {
      return Response.json({ error: "Ticket not found" }, { status: 404 });
    }

    return Response.json({ success: true, ticket: updated[0] });
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return Response.json({ error: "Failed to update support ticket" }, { status: 500 });
  }
}

