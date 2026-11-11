/**
 * Sri Usha Vet & Pet Stores — Clerk Webhook Handler
 * Edge-compatible Clerk webhook listener for automated user synchronization.
 * 
 * Guarantees:
 * 1. All new accounts registered via Clerk strictly receive role = 'customer'.
 * 2. Database remains the sole authority for roles (user.updated cannot alter roles).
 * 3. Triggers transactional welcome email via Resend on user creation.
 */
import sql from "@/app/api/utils/sql";
import logger from "@/utils/logger";
import { triggerWelcomeNotification } from "@/utils/notificationService";

export async function POST(req) {
  try {
    const rawBody = await req.text();
    let event;

    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const eventType = event.type || event.event;
    const data = event.data || {};

    logger.info("clerk_webhook_received", `Received Clerk webhook: ${eventType}`, {
      eventType,
      userId: data.id,
    });

    switch (eventType) {
      case "user.created": {
        const clerkUserId = data.id;
        const primaryEmailObj = data.email_addresses?.find(
          (e) => e.id === data.primary_email_address_id
        );
        const email = (
          primaryEmailObj?.email_address ||
          data.email_addresses?.[0]?.email_address ||
          ""
        ).toLowerCase().trim();

        const name = `${data.first_name || ""} ${data.last_name || ""}`.trim() || "Customer";
        const image = data.image_url || data.profile_image_url || null;

        if (!email) {
          logger.warn("clerk_webhook_no_email", "Clerk user.created missing email address", { clerkUserId });
          return new Response(JSON.stringify({ received: true, warning: "no_email" }), { status: 200 });
        }

        // Check if user already exists by email or clerk_user_id
        const existing = await sql`
          SELECT id, email, role, clerk_user_id 
          FROM auth_users 
          WHERE LOWER(email) = LOWER(${email}) OR clerk_user_id = ${clerkUserId}
          LIMIT 1
        `;

        if (existing.length > 0) {
          // Link clerk_user_id if not linked, preserving existing role
          await sql`
            UPDATE auth_users 
            SET clerk_user_id = ${clerkUserId},
                image = COALESCE(image, ${image})
            WHERE id = ${existing[0].id}
          `;
          logger.info("clerk_webhook_user_linked", `Linked existing user ${email} to Clerk ID ${clerkUserId}`);
        } else {
          // Create new user strictly with role = 'customer'
          const inserted = await sql`
            INSERT INTO auth_users (name, email, role, clerk_user_id, image, created_at)
            VALUES (${name}, ${email}, 'customer', ${clerkUserId}, ${image}, NOW())
            RETURNING id, name, email, role, clerk_user_id
          `;

          const newUser = inserted[0];
          logger.info("clerk_webhook_customer_created", `Created new customer ${email} via Clerk`, {
            userId: newUser.id,
            clerkUserId,
          });

          // Trigger welcome email via Resend
          await triggerWelcomeNotification(newUser);
        }
        break;
      }

      case "user.updated": {
        const clerkUserId = data.id;
        const name = `${data.first_name || ""} ${data.last_name || ""}`.trim();
        const image = data.image_url || data.profile_image_url || null;

        // Update profile fields ONLY (role is protected and untouched)
        if (name || image) {
          await sql`
            UPDATE auth_users 
            SET name = COALESCE(NULLIF(${name}, ''), name),
                image = COALESCE(${image}, image)
            WHERE clerk_user_id = ${clerkUserId}
          `;
          logger.info("clerk_webhook_user_updated", `Updated profile for Clerk ID ${clerkUserId}`);
        }
        break;
      }

      case "user.deleted": {
        const clerkUserId = data.id;
        // Unlink clerk ID rather than hard deleting to preserve historical invoices
        await sql`
          UPDATE auth_users 
          SET clerk_user_id = NULL 
          WHERE clerk_user_id = ${clerkUserId}
        `;
        logger.info("clerk_webhook_user_unlinked", `Unlinked deleted Clerk user ${clerkUserId}`);
        break;
      }

      default:
        logger.info("clerk_webhook_unhandled", `Unhandled Clerk event ${eventType}`);
        break;
    }

    return new Response(JSON.stringify({ success: true, event: eventType }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("clerk_webhook_error", "Error processing Clerk webhook", error);
    return new Response(JSON.stringify({ error: "Internal webhook error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
