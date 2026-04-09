# 🍽️ ROMS — Restaurant Order Management System

> A real-time, full-stack web application that replaces paper tickets with a structured digital workflow — from customer order to kitchen queue to completion.

## 📸 Screenshots

### Customer Portal
<p align="center">
  <img src="public/screenshot/customer-menu.png" width="45%" />
  <img src="public/screenshot/customer-cart.png" width="45%" />
</p>

### Kitchen Display
<p align="center">
  <img src="public/screenshot/kitchen-display.png" width="70%" />
</p>

### Staff Dashboard
<p align="center">
  <img src="public/screenshot/staff-dashboard.png" width="70%" />
</p>

### Admin Panel
<p align="center">
  <img src="public/screenshot/admin-dashboard.png" width="45%" />
  <img src="public/screenshot/admin-status.png" width="45%" />
</p>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [User Roles](#user-roles)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Team](#team)

---

## 🧭 Overview

ROMS is a lightweight restaurant-side order management platform built for small-to-medium restaurants that want to modernize their order handling. It connects four distinct interfaces — **Customer Portal**, **Kitchen Display**, **Staff Dashboard**, and **Admin Panel** — through a single real-time backend.

```
Customer → Places Order → Kitchen Queue → Staff Completes → Customer Notified
```

Orders flow in real time via **Socket.io WebSockets**, with a 10-second polling fallback. Every status change — *Received → Preparing → Ready → Completed* — is instantly reflected across all views.

---

## ✨ Features

### 👤 Customer
- Browse menu by category without logging in
- Add items to cart, adjust quantities
- Place order and receive a unique **64-character tracking token**
- Track live order status via WebSocket-powered status page
- View order history by email and **re-order in one click**

### 👨‍🍳 Kitchen Staff
- Real-time order queue sorted by time received
- Advance orders: `received → preparing → ready`
- Auto-refreshes via WebSocket; falls back to polling on disconnect

### 🧑‍💼 Front-of-House Staff
- Monitor all active orders and statuses
- Mark orders as `completed` when customer collects
- Flag orders for manager review with optional reason note

### 🔧 Admin / Manager
- Add, edit, and deactivate menu categories and items (with image support)
- Create and manage staff/kitchen user accounts
- View sales reports: total orders, revenue, top items by date range

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React, Tailwind CSS |
| **Backend** | Next.js API Routes (Node.js runtime) |
| **Real-time** | Socket.io (WebSocket + polling fallback) |
| **Database** | MySQL 8.x via Prisma ORM |
| **Auth** | JWT (8-hour expiry) + bcrypt password hashing |
| **Access Control** | Role-Based Access Control (RBAC) |

---

## 📁 Project Structure

```
roms/
├── app/
│   ├── (public)/          # Customer-facing ordering portal
│   ├── admin/             # Admin panel (protected)
│   ├── kitchen/           # Kitchen display queue (protected)
│   ├── staff/             # Staff dashboard (protected)
│   ├── track/[token]/     # Public order tracking page
│   └── api/               # All API route handlers
│       ├── auth/          # Login / logout
│       ├── orders/        # Order CRUD + status updates
│       └── admin/         # Admin dashboard data
├── components/
│   └── auth/              # Auth-related UI components
├── contexts/              # React context providers
├── lib/
│   ├── auth/              # JWT, bcrypt, RBAC helpers
│   ├── client/            # Client-side utilities
│   └── server/            # Server-side services (order, admin)
├── prisma/
│   └── schema.prisma      # Database schema
├── public/
│   └── dishes/            # Menu item images (add your photos here)
├── shared/
│   ├── constants/         # Order statuses, labels
│   └── types/             # Shared TypeScript types
└── .env                   # Environment variables (see below)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **MySQL 8.x** running locally or on a cloud service
- **npm** or **yarn**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/roms.git
cd roms

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your values (see Environment Variables section)

# 4. Run database migrations
npx prisma migrate dev

# 5. Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# Required — change this to a long random string in production
JWT_SECRET=your-secret-min-32-characters-long

# MySQL connection string (required for persistent order storage)
DATABASE_URL="mysql://root:yourpassword@127.0.0.1:3306/roms?allowPublicKeyRetrieval=true"
```

> ⚠️ Without `DATABASE_URL`, orders are stored **in-memory only** and lost on server restart. Set this before going to production.

---

## 🗄️ Database Setup

ROMS uses **Prisma** to manage the MySQL database schema.

```bash
# Apply migrations to your database
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to inspect data
npx prisma studio

# (Optional) Reset and re-migrate
npx prisma migrate reset
```

### Schema Overview

| Table | Description |
|---|---|
| `orders` | Every order placed — UUID, status, total, tracking token |
| `order_items` | Line items per order (quantity + price snapshot) |
| `users` *(planned)* | Admin, staff, kitchen accounts |
| `menu_items` *(planned)* | Menu catalogue with image URLs |
| `categories` *(planned)* | Menu categories |
| `flag_logs` *(planned)* | Manager review flags on orders |

> The current v1.0 schema implements `orders` and `order_items`. Additional tables follow the full Database Design Document schema.

---

## 👥 User Roles

| Role | Access | Login Required |
|---|---|---|
| **Customer** | Order portal, tracking page | ❌ No |
| **Kitchen Staff** | Kitchen display queue | ✅ Yes |
| **Front-of-House Staff** | Staff dashboard | ✅ Yes |
| **Admin / Manager** | Admin panel, reports | ✅ Yes |

Default dev credentials are defined in `lib/auth/seed-users.ts`.

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with email + password, returns JWT |
| `POST` | `/api/auth/logout` | Clears session cookie |

### Orders
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/orders` | Place a new order | Public |
| `GET` | `/api/orders` | List all orders | Staff/Admin |
| `GET` | `/api/orders/track/:token` | Get order by tracking token | Public |
| `PATCH` | `/api/orders/:id/kitchen` | Advance order status (kitchen) | Kitchen |
| `PATCH` | `/api/orders/:id/complete` | Mark order completed | Staff |

### Admin
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/admin/dashboard` | KPIs, recent orders, revenue | Admin |
| `GET` | `/api/db-check` | Verify MySQL connection | Public |

---

## 🌐 Deployment

### Deploy on Vercel (Recommended)

```bash
# 1. Push to GitHub
git add .
git commit -m "ready for deployment"
git push origin main

# 2. Go to vercel.com → Import your GitHub repo
# 3. Add environment variables in Vercel dashboard:
#    JWT_SECRET=...
#    DATABASE_URL=...

# 4. Deploy!
```

Your app will be live at `https://your-project.vercel.app`

### Cloud Database Options

| Service | Free Tier | Notes |
|---|---|---|
| **PlanetScale** | 5GB | MySQL-compatible, great Prisma support |
| **Railway** | $5 credit/month | Easy MySQL provisioning |
| **Aiven** | 1 free instance | Production-ready MySQL |

---

## 📸 Adding Menu Images

1. Create `public/dishes/` folder in the project root
2. Add your food photos (`.jpg`, `.png`, `.webp`)
3. Reference them in `app/(public)/page.tsx` under `MOCK_MENU`:

```ts
{ id: "itm-001", name: "Crispy Calamari Rings", image: "/dishes/calamari.jpg", ... }
```

Images in the `public/` folder are served automatically at `/dishes/filename.jpg`.

---
