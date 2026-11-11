# Sri Usha Vet & Pet Stores — Production E-Commerce Platform

> Production-grade full-stack e-commerce application for **Sri Usha Vet & Pet Stores**, Uppal, Hyderabad. Built for high performance, verified payment security, real-time inventory management, customer address book, product wishlists, customer reviews, and role-based administrative operations.

---

## 🌟 Key Features

### 🛍️ Customer Experience
- **Catalog & Discovery**: Rich category browsing (Dog, Cat, Birds, Pet Food, Grooming, Healthcare), fast full-text search, brand filtering, and price sorting.
- **Product Details & Stock Alerts**: High-resolution image galleries, pack weight/size variant selectors, real-time stock indicators (`In Stock`, `Only X left in stock - order soon!`, `Out of Stock`), veterinary advisories, and feeding guidelines.
- **Universal Cart & Free Shipping Meter**: Dynamic progress bar towards free delivery (free threshold ₹500), quantity adjustments, promo code engine (`USHA10` for 10% off, `FLAT50` for ₹50 off), and automatic guest-to-account synchronization upon sign in.
- **Product Wishlist**: 1-click wishlist toggle for both guests (localStorage) and authenticated users (database-backed), complete with dedicated `/wishlist` management page.
- **Saved Address Book**: Multiple delivery addresses with default selection, 1-click checkout population, and save-for-later capabilities.
- **Customer Reviews & Ratings Engine**: Star rating breakdown, verified customer testimonials, and instant community review submission.
- **Recently Viewed Products**: High-speed local history tracking displayed on product detail views.

### 💳 Payments & Checkout
- **Cash on Delivery (COD)**: Server-validated stock reservation, authentic pricing re-computation, strict status isolation (`pending` payment / `processing` order), and unique human-readable order references (`SU-2026-XXXX`).
- **Razorpay Online Payments**:
  - Server-side order creation preventing price manipulation.
  - Cryptographic **HMAC-SHA256 signature verification** on the backend using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
  - Idempotency protection guarding against duplicate payment submissions and race conditions.
  - Graceful cancellation and bank failure handlers with transparent feedback.
- **Guest & Authenticated Checkout**: Seamless checkout for guests with automatic account linkage without forced barriers.

### 📦 Order Tracking & Lifecycle Management
- **Visual Order Timeline**: Sequential tracking (Order Placed → Packed → Dispatched → Delivered).
- **Self-Service Order Cancellation**: Allowed during early stages (`pending`, `processing`, `confirmed`), which **automatically restores inventory stock** back to the store catalog in real time.
- **Printable Tax Invoices**: Formatted for standard desktop and mobile printing.

### 🛡️ Enterprise Security & Admin Operations
- **Role-Based Server Authorization**: Direct database verification (`auth_users.role === 'admin'`) protecting all `/api/admin/*` endpoints against session spoofing.
- **Zero Exposed Credentials**: Hardcoded passwords, fallback secret keys, and unauthenticated setup endpoints eliminated.
- **Sanitized Server-Side Validation**: Rigorous checks for email formats, 10-digit Indian mobile numbers, and safe text trimming.
- **Comprehensive Admin Dashboard**: Real-time business metrics (Verified Total Revenue, Total Orders, Active Orders, Low-Stock Alerts, Total Customers), searchable & filterable order fulfillment panel, inventory stock +/- inline controls, and category management.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, React Router 7 |
| **Server & APIs** | Node.js, Hono, File-based Route Handler (`__create`) |
| **Database** | Neon Serverless PostgreSQL with Connection Pooling (`@neondatabase/serverless`) |
| **Authentication** | Auth.js (`@auth/core`, `@hono/auth-js`) with bcrypt password hashing |
| **Payment Gateway** | Razorpay (Node.js SDK + client modal with HMAC-SHA256 verification) |
| **Styling & Icons** | Tailwind CSS 3.4, Lucide React Icons |
| **State & Data Fetching** | TanStack Query (React Query), Universal Cart Hook (`useCart`), Wishlist Hook (`useWishlist`) |

---

## 📋 Database Schema

- `auth_users` & `auth_accounts`: Authentication records with role distinction (`customer` vs `admin`).
- `categories` & `sub_categories`: Taxonomy and product groupings.
- `products`: Catalog items with `price`, `sale_price`, `stock_quantity`, `is_active`, `brand`, `weight`.
- `product_images`: Multi-image gallery attachments with default flags.
- `cart_items`: Server-synchronized user cart items.
- `orders` & `order_items`: Orders with unique `order_number`, tracking state, `payment_method`, and Razorpay verification tokens.
- `user_addresses`: Saved customer delivery address book.
- `wishlist_items`: Persistent customer wishlists.
- `product_reviews`: Verified product reviews and moderation status.
- `settings`: Global store configurations (e.g. delivery fee settings).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 20.x
- **npm** or **bun**
- A **Neon PostgreSQL** database instance

### 1. Installation
Clone the repository and install dependencies:
```bash
cd sriusha-app-main
npm install
```

### 2. Environment Configuration
Copy the example environment file and populate your credentials:
```bash
cp .env.example .env
```

Configure the following variables in `.env`:
```env
# Database Connection (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require"

# Auth.js Secret & Base URL
AUTH_SECRET="your-32-character-random-hex-secret"
AUTH_URL="http://localhost:4000"

# Razorpay Test / Live Keys
RAZORPAY_KEY_ID="rzp_test_your_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_secret_key"

# Vercel Blob Storage (Optional, local uploads fallback provided)
BLOB_READ_WRITE_TOKEN=""
```

### 3. Database Migration
Run the automated migration script to initialize required tables and columns:
```bash
node --env-file=.env db-upgrade-v2.mjs
```

### 4. Running the Development Server
Start the local server:
```bash
npm run dev
```
Open [http://localhost:4000](http://localhost:4000) in your web browser.

---

## 🧪 Testing Instructions

Run the end-to-end integration and security test suite:
```bash
node --env-file=.env test-e2e-suite.mjs
```

### Scenarios Covered by the Automated Suite:
1. **Catalog Browsing**: Categories, product lists, and product detail endpoints.
2. **Security & Authorization**: Rejection of unauthenticated users on protected admin endpoints (HTTP 401/403).
3. **Cash on Delivery (COD) Checkout**: Input validation, order placement, unique reference formatting (`SU-2026-XXXX`), and atomic stock decrement.
4. **Order Tracking & Lifecycle**: Fetching orders by ID and verifying that order cancellation properly **restores product stock**.
5. **Razorpay Payments**: Backend order generation, tampered signature rejection (400 Bad Request), authentic HMAC-SHA256 signature verification, and idempotency protection.
6. **Customer Reviews Engine**: Reading verified reviews, computing star ratings, and posting new reviews.

---

## 📞 Support & Inquiries
- **Store**: Sri Usha Vet & Pet Stores
- **Location**: Uppal, Hyderabad, Telangana, India
- **Phone**: +91 98765 43210
