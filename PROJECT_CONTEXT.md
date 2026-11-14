# SRI USHA VET & PET STORES — AI BUILD GUIDE

A pet quick-commerce app (like Zepto / Swiggy Instamart, but for pets).

**How to use this file**
1. Put this whole file in your project root (also keep a copy as `PROJECT_CONTEXT.md`).
2. Start every AI chat with: *"Read PROJECT_CONTEXT.md fully before doing anything."*
3. Then paste ONE phase prompt (Part C) at a time.
4. Test after each phase. Git commit after each phase. Never skip.

---

# PART A — MASTER CONTEXT (the AI must read this first)

## A1. Who you are
You are a Senior Full-Stack Engineer, Mobile UX Designer and Quick-Commerce Operations Expert.

## A2. The project
**SRI USHA VET & PET STORES** is a production-style pet e-commerce app, already built and partly working. It sells pet food, accessories, veterinary products and prescription products. Delivery area: Hyderabad, by pincode.

## A3. CRITICAL RULES (never break)
1. **Do NOT rebuild from scratch.** Inspect the existing code first.
2. **Do NOT delete working features, tables or data.** Database changes must be migrations that keep existing data.
3. **Change only what the current phase asks.** If something outside the phase looks broken, list it in your report. Do not fix it silently.
4. **Never trust the frontend.** Price, role, stock, offer, points and serviceability are always decided on the server.
5. **No fake data.** No placeholder numbers, fake offers or fake stats. Everything comes from the database. If there is no data, show a proper empty state.
6. **No secret keys in frontend code.** Use environment variables only.
7. **Do not fake GPS tracking.** Use Google Maps deep links only for now.
8. **Before editing, tell me your plan** (files you will change and why). Then do it.
9. **After editing, run build, lint and type check, and fix errors you caused.**
10. **If you are not sure, ask me. Do not guess.**

## A4. Tech stack (real & final)
| Part | Technology |
|---|---|
| Frontend + server | React Router v7, Vite, Hono |
| Hosting | Vercel / Netlify |
| Database | Neon PostgreSQL |
| Authentication | Clerk |
| Email | Resend (planned integration) |
| File storage | Cloudflare R2 (private bucket for prescriptions, planned integration) |
| Payment | Razorpay (planned integration; COD first) |
| WhatsApp | WhatsApp Business Cloud API or provider (planned integration) |

## A5. Roles
| Role | Home route | Can do |
|---|---|---|
| CUSTOMER | `/account` | Browse, cart, checkout, track orders, pets, wishlist, rewards, support |
| ADMIN | `/admin` | Products, stock, orders, assign delivery, users and roles, offers, zones, analytics, notifications, prescriptions, support issues |
| DELIVERY_PARTNER | `/delivery` | See ONLY assigned orders, accept, navigate, update status, collect COD |

**Role rules**
- Clerk = login, sessions, passwords.
- Neon database = source of truth for role and business data.
- Public signup always creates **CUSTOMER**. Nobody can choose Admin or Delivery at signup.
- Only an existing ADMIN can assign Admin or Delivery roles.
- Every API route and server action checks the role from the **database** using the Clerk user id.
- Every delivery query filters by `assigned_partner_id = current user`.

## A6. Order status flow (state machine)
```
PLACED → CONFIRMED → PACKING → READY_FOR_DELIVERY → ASSIGNED
→ ACCEPTED → OUT_FOR_DELIVERY → DELIVERED
```
Side states: `PRESCRIPTION_REVIEW`, `DELIVERY_FAILED`, `CANCELLED`

Rules:
- Only allowed transitions are accepted by the server (reject jumping, for example PLACED → DELIVERED).
- Each transition checks who may do it (admin or assigned partner).
- Each transition writes a row in `order_status_history` (order_id, from, to, changed_by, reason, timestamp).
- Each transition creates the right notification.

## A7. Database (existing + needed)
Existing: users, roles, products, product_variants, inventory, orders, order_items, delivery_assignments, delivery_zones, notifications, customer_addresses, wishlist, audit_logs, order_status_history.

### Stock Source of Truth Rule (Phase 3)
If a product has rows in `product_variants`, variant stock (`product_variants.stock_quantity`) is the **ONLY** source of truth for inventory availability, low stock calculation, and order deductions. The parent `products.stock_quantity` is derived and kept synchronized as the sum of its active variants. When an order item targets a product without variants, the base product stock is used.

May need (add by migration, only when the phase needs it):
- `pets` (user_id, name, type, breed, age, weight, diet, medical_notes)
- `stock_reservations` (variant_id, order/cart id, qty, expires_at)
- `stock_movements` (variant_id, change, reason, order_id, by_user, timestamp)
- `offers`, `offer_redemptions`
- `reward_ledger` (user_id, order_id, points, type: earned/redeemed/reversed)
- `prescriptions` (order_id, r2_key, status, reviewed_by, reviewed_at, reject_reason)
- `support_issues` (order_id, user_id, category, description, status)
- `payments` (order_id, provider, provider_order_id, provider_payment_id, status, amount)
- `notification_queue` (channel, template, payload, status, attempts)
- `delivery_events` (order_id, partner_id, event, note, timestamp) — ready for future GPS

## A8. Design identity
- Original brand. Do NOT copy Zepto, Swiggy or Blinkit branding.
- Mobile-first. Fast, friendly, trustworthy, premium but simple.
- Suggested palette: warm green or teal as primary, warm orange accent, soft neutral background (confirm with me before changing the existing theme).
- Large tap targets (minimum 44px). Skeleton loaders. Clear empty states and error states.
- Test at 360px, 390px, 768px and 1280px widths.

---

# PART B — HOW THE WHOLE SYSTEM WORKS

```
Customer signs up (CUSTOMER role) → adds pet → browses
→ picks variant → ADD → [-] 1 [+]
→ Cart (savings, free delivery bar, offer)
→ Checkout: Address (pincode check) → Time → Payment → Review
→ Server: re-check price, stock, offer, serviceability
→ [If prescription item: upload → admin/vet approves]
→ Order PLACED (COD) or PAID (online)
→ Admin confirms → packing → ready → assigns partner
→ Partner accepts → out for delivery (Maps) → OTP → DELIVERED
→ Points added, notifications sent, stock and analytics updated
```

## B1. Fast website
- Optimistic cart updates (UI changes instantly, server saves in background).
- Images: WebP, resized, served from R2/Cloudflare, lazy loaded.
- Cache categories and product lists. Revalidate on admin change.
- Database indexes: product name, category, SKU, order status, partner id.
- Skeleton loading, no blank screens.

## B2. Variants and stock
- Product has many variants (1 kg, 3 kg, 10 kg). Each variant has SKU, price, MRP, discount, stock, reorder level, active flag.
- Purchase price and supplier are admin-only and never returned by customer APIs.
- Stock flow: checkout starts → reserve about 10 min → order placed/paid → deduct → cancel/fail → return stock → below reorder level → low-stock alert.
- Anti-overselling (atomic):
```sql
UPDATE product_variants
SET stock = stock - :qty
WHERE id = :variant_id AND stock >= :qty;
-- 0 rows updated = sold out. Show "Only N left" or "Out of stock".
```
- Do this inside a database transaction together with order creation.

## B3. Payment
- Price is always recalculated on the server: items + delivery fee − offer − points.
- COD: order PLACED, payment status `COD_PENDING`. Partner marks `COD_COLLECTED`. Admin sees COD totals to reconcile.
- Online (Razorpay): server creates the Razorpay order → customer pays → **webhook with verified signature** marks PAID → order placed, stock deducted. Webhook is the final truth, not the browser.
- Failed payment: order not placed, reservation released.
- Cancelled paid order: refund through the Razorpay API.
- Demo payment must be clearly labelled "TEST MODE" and controlled by an env flag. Never mix demo and live.

## B4. Delivery
- Admin assigns → partner accepts → out for delivery → delivered or failed.
- Partner buttons: Call, Open Google Maps (deep link), Mark out for delivery, Mark delivered (with OTP), Mark failed (with reason), Mark COD collected.
- Failed reasons: customer not available, wrong address, refused, other. Admin can reassign or cancel.
- Google Maps link: `https://www.google.com/maps/dir/?api=1&destination=<lat,lng or encoded address>`
- Future GPS: Driver app → secure location API → database/realtime → customer live map. Keep the `delivery_events` table and API structure ready, but do not build fake tracking.

## B5. Notifications
- Event happens → row added to `notification_queue` → background worker sends → retries on failure.
- Channels: in-app (now), email via Resend, WhatsApp via approved templates (customer must opt in).
- Templates: Order placed, Confirmed, Out for delivery, Delivered, Failed, Prescription approved/rejected, Low stock (admin).
- Simple support link: `https://wa.me/<store number>` works without any API.

## B6. Prescription
```
Cart has prescription product → upload photo/PDF → saved in PRIVATE R2 bucket
→ order PRESCRIPTION_REVIEW → admin/vet opens via short-lived signed URL
→ Approve → CONFIRMED   |   Reject (reason) → customer notified, re-upload or remove item
```
- Never a public URL. Validate file type (jpg, png, pdf) and size (max 5 MB).
- Log reviewer and time. Reviewer should be a licensed vet or pharmacist (client must check local rules).

## B7. Rewards and offers
- Example: ₹100 spent = 1 point. **Points are given only when order is DELIVERED.**
- Reward ledger: earned, redeemed, reversed (for cancelled or refunded orders). Balance = sum of ledger.
- Offer fields: type (percent/flat), value, min cart, category or product scope, start, end, max total uses, per-user limit, active.
- Offers are validated by the server at checkout. "First order" checks that the user has zero previous orders.

---

# PART C — PHASE PROMPTS (paste one at a time)

Every phase prompt ends with the same **Report Format** (see Part D).

## PHASE 0 — Audit only (no code changes)
## PHASE 1 — Foundation: auth, roles, routing, errors
## PHASE 2 — Mobile header and bottom navigation
## PHASE 3 — Shopping: product card, variants, cart, COD checkout
## PHASE 4 — Order board and delivery flow
## PHASE 5 — Inventory
## PHASE 6 — Pet profile, offers, rewards, support, prescription (6A-6E)
## PHASE 7 — Payments, email, WhatsApp, storage

---

# PART D — REPORT FORMAT (AI must end every phase with this)

1. What I changed (files and reason)
2. What I did NOT touch
3. Database migrations added (and confirmation that old data is safe)
4. How I tested (exact steps, accounts used)
5. Test results: pass/fail list
6. Known problems or things I noticed outside this phase
7. What the next phase needs

---

# PART E — SECURITY CHECKLIST (verify before going live)

- [ ] Role read from database on every protected server call
- [ ] Delivery partner queries filtered by assigned partner
- [ ] Customers can only read their own orders, addresses, pets, prescriptions
- [ ] Price, stock, offer, points, delivery fee calculated server-side
- [ ] Payment webhook signature verified and idempotent
- [ ] Prescription bucket private, signed URLs short-lived
- [ ] Purchase price and supplier never sent to customers
- [ ] Rate limits on login-related, OTP, offer-apply and order endpoints
- [ ] All inputs validated (zod or similar), SQL via parameterized queries/ORM
- [ ] No secrets in the repo; `.env.example` provided
- [ ] Audit log for role changes, stock changes, order status changes, prescription decisions

# PART F — FINAL TEST CHECKLIST

**Customer:** sign up → create pet → browse → pick variant → add → checkout → pay → track → get notification
**Admin:** sign in → dashboard → confirm order → manage stock → assign partner → watch delivery → view analytics
**Delivery:** sign in → see only my orders → accept → open Maps → mark delivered/failed → COD collected

---
**Golden rule for the AI:** inspect first, plan second, change small, test everything, report honestly.

