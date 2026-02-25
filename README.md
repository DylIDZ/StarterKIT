# 🚀 Universal Backend Starter Kit

**Production-ready Node.js + TypeScript REST API** — built with Express 5, Prisma ORM, JWT Authentication, Role-Based Access Control (RBAC), and modern tooling.

> 🎯 Clone this kit and adapt it for **any** backend project: SaaS, E-commerce, Portal Berita, Barber Shop, and more.

---

## ✨ Features

| Category | Stack |
|---|---|
| **Runtime** | Node.js + TypeScript (ESNext) |
| **Framework** | Express 5 |
| **Database & ORM** | PostgreSQL + **Prisma 7** (default) or **Drizzle ORM** (alternative) |
| **Validation** | Zod (body, query, params) |
| **Auth** | JWT (Access + Refresh in HttpOnly Cookie) |
| **Authorization** | RBAC (Admin, User, Moderator) |
| **API Docs** | Swagger UI at `/api-docs` (auto-generated from Zod schemas) |
| **Logging** | Pino (structured JSON) + pino-pretty (dev) |
| **Security** | Helmet, CORS whitelist, Rate Limiter, bcryptjs |
| **Linting** | Biome.js (lint + format) |
| **Testing** | Vitest + Supertest |
| **Dev Server** | tsx (watch mode) |
| **Build** | tsc + tsup (ESM + CJS) |
| **Infra** | Docker (multi-stage), Docker Compose, GitHub Actions CI |

---

## 📁 Project Structure

```
StarterKIT/
├── .github/workflows/ci.yml     # CI/CD pipeline
├── prisma/
│   ├── schema.prisma             # Database schema (User, Profile, Permission, Resource)
│   └── seed.ts                   # Database seeder
├── src/
│   ├── api/                      # Feature modules
│   │   ├── auth/                 #   Authentication feature
│   │   │   ├── authModel.ts      #     Zod schemas & types
│   │   │   ├── authController.ts #     HTTP handlers (HttpOnly cookie mgmt)
│   │   │   ├── authService.ts    #     Business logic (JWT, bcrypt)
│   │   │   └── authRepository.ts #     Database queries (Prisma)
│   │   ├── user/                 #   User management (Admin CRUD)
│   │   │   ├── userModel.ts
│   │   │   ├── userController.ts
│   │   │   ├── userService.ts
│   │   │   └── userRepository.ts
│   │   ├── resource/             #   Generic resource (boilerplate example)
│   │   │   ├── resourceModel.ts  #     ★ Demonstrates full Zod validation
│   │   │   ├── resourceController.ts
│   │   │   ├── resourceService.ts#     ★ Prisma Transaction example
│   │   │   └── resourceRepository.ts#   ★ Paginated queries
│   │   ├── healthCheck/
│   │   │   └── healthCheckRouter.ts
│   │   └── routes/               #   Route definitions + OpenAPI registries
│   │       ├── authRoute.ts
│   │       ├── userRoute.ts
│   │       └── resourceRoute.ts
│   ├── api-docs/                 # Swagger/OpenAPI
│   │   ├── openAPIDocumentGenerator.ts
│   │   ├── openAPIResponseBuilders.ts
│   │   └── openAPIRouter.ts
│   ├── common/                   # Shared infrastructure
│   │   ├── constants/index.ts
│   │   ├── lib/prisma.ts         #   Prisma client singleton
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts  #   JWT verify + RBAC
│   │   │   ├── errorHandler.ts
│   │   │   ├── rateLimiter.ts
│   │   │   └── requestLogger.ts   #   Pino HTTP + request IDs
│   │   ├── models/
│   │   │   └── serviceResponse.ts #   Generic response wrapper
│   │   └── utils/
│   │       ├── commonValidation.ts#   Shared Zod schemas
│   │       ├── envConfig.ts       #   Zod-validated env
│   │       └── httpHandlers.ts    #   Request validator middleware
│   ├── server.ts                 # Express app assembly
│   └── index.ts                  # Bootstrap + graceful shutdown
├── drizzle/                     # Drizzle ORM alternative
│   ├── schema.ts                #   Table definitions (mirrors Prisma)
│   ├── relations.ts             #   Drizzle relations
│   └── seed.ts                  #   Database seeder (Drizzle version)
├── .env.template
├── biome.json
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.ts            # Drizzle Kit config
├── package.json
├── prisma.config.ts
├── tsconfig.json
└── vite.config.mts
```

---

## 🏗️ Architecture: Data Flow

```
Request
  │
  ▼
Router (Express)
  │── Validation Middleware (Zod schema)
  │── Auth Middleware (JWT verify)
  │── RBAC Middleware (role check)
  │
  ▼
Controller (HTTP layer)
  │── Extracts request data
  │── Delegates to Service
  │
  ▼
Service (Business Logic)
  │── Ownership checks
  │── Prisma Transactions
  │── Calls Repository
  │
  ▼
Repository (Data Access)
  │── Prisma ORM queries
  │── Error logging
  │
  ▼
Database (PostgreSQL)
  │
  ▼
ServiceResponse ──► JSON Response
```

---

## ⚡ Quick Start

### Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 10
- **PostgreSQL** (or use Docker Compose)

### 1. Clone & Install

```bash
git clone <your-repo-url> my-project
cd my-project
pnpm install
```

### 2. Configure Environment

```bash
cp .env.template .env
# Edit .env with your database URL and JWT secrets
```

### 3. Setup Database

```bash
# Run with Docker Compose (includes PostgreSQL)
docker compose up db -d

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed initial data (admin user, permissions)
pnpm db:seed
```

### 4. Run Development Server

```bash
pnpm dev
# ✅ Server running on http://localhost:8080/api
# ✅ Swagger UI at http://localhost:8080/api-docs
```

### Default Accounts (after seeding)

| Email | Password | Role |
|---|---|---|
| `admin@starterkit.dev` | `Admin@1234` | ADMIN |
| `user@starterkit.dev` | `User@1234` | USER |

---

## 🔑 Key Concepts

### HttpOnly Refresh Token Cookies

Refresh tokens are **never** sent in the response body. They are stored as secure HttpOnly cookies:
- `POST /api/auth/login` → Sets `refreshToken` cookie
- `POST /api/auth/refresh` → Reads cookie, rotates token, sets new cookie
- `POST /api/auth/logout` → Clears cookie

### Prisma Transaction Example

See `src/api/resource/resourceService.ts` → `create()` method. It uses `prisma.$transaction()` to atomically:
1. Create a Resource record
2. Update the User's `updatedAt` timestamp

If either fails, both are rolled back.

### Graceful Shutdown

`src/index.ts` handles `SIGINT`/`SIGTERM` by:
1. Stopping the HTTP server (no new connections)
2. Calling `prisma.$disconnect()` to release DB pool
3. Exiting cleanly (with 10s force-shutdown fallback)

---

## 🔧 Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with hot-reload (tsx) |
| `pnpm build` | Compile TypeScript (tsc + tsup) |
| `pnpm start` | Run production build |
| `pnpm test` | Run tests (Vitest) |
| `pnpm test:cov` | Run tests with coverage |
| `pnpm check` | Lint & format (Biome) |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed database (Prisma) |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm db:drizzle:generate` | Generate Drizzle migrations |
| `pnpm db:drizzle:migrate` | Run Drizzle migrations |
| `pnpm db:drizzle:push` | Push schema to DB (Drizzle) |
| `pnpm db:drizzle:studio` | Open Drizzle Studio GUI |
| `pnpm db:drizzle:seed` | Seed database (Drizzle) |

---

## 🐳 Docker

### Full Stack (App + PostgreSQL)

```bash
docker compose up -d
```

### Production Build Only

```bash
docker build -t my-api .
docker run -p 8080:8080 --env-file .env my-api
```

---

## 🔄 Adapting This Kit For Your Project

This kit is designed as a **universal starting point**. Here's how to adapt it:

### Step 1: Rename & Configure

1. Update `package.json` → `name`, `description`, `author`
2. Update `.env.template` with your project-specific variables
3. Update Swagger title in `src/api-docs/openAPIDocumentGenerator.ts`

### Step 2: Modify the Schema

Edit `prisma/schema.prisma` to match your domain:

| Project | Replace `Resource` with |
|---|---|
| **Barber Shop** | `Appointment`, `Service`, `Barber`, `Schedule` |
| **SaaS** | `Organization`, `Subscription`, `Invoice`, `Plan` |
| **Portal Berita** | `Article`, `Category`, `Comment`, `Tag` |
| **E-Commerce** | `Product`, `Order`, `Cart`, `Payment` |

### Step 3: Create New Features

Copy the `src/api/resource/` folder pattern:

```bash
src/api/your-feature/
  ├── yourFeatureModel.ts       # Zod schemas
  ├── yourFeatureRepository.ts  # Prisma queries
  ├── yourFeatureService.ts     # Business logic
  └── yourFeatureController.ts  # HTTP handlers

src/api/routes/
  └── yourFeatureRoute.ts       # Routes + OpenAPI
```

### Step 4: Register Routes

In `src/server.ts`, add:
```typescript
import { yourFeatureRouter } from "@/api/routes/yourFeatureRoute";
apiRouter.use("/your-feature", yourFeatureRouter);
```

In `src/api-docs/openAPIDocumentGenerator.ts`, add your registry.

### Step 5: Run Migrations

```bash
pnpm db:migrate
pnpm db:generate
```

---

## 🔀 Drizzle ORM Alternative

This kit includes **Drizzle ORM** as a drop-in alternative to Prisma. Both ORMs share the same table structure — switch with a single import change per repository.

### Prisma vs Drizzle — When to Use Which?

| Aspect | Prisma 7 (Default) | Drizzle ORM |
|---|---|---|
| **Schema** | `schema.prisma` (DSL) | TypeScript code |
| **Migrations** | `prisma migrate` | `drizzle-kit generate/migrate` |
| **Query Style** | High-level API | SQL-like builder |
| **Type Safety** | Generated client | Schema-inferred |
| **Bundle Size** | Larger (engine binary) | Lightweight |
| **Best For** | Rapid development | Performance, fine-grained control |

### How to Switch to Drizzle

**Step 1:** Change repository imports (1 line per file):

```diff
# In authService.ts / userService.ts / resourceService.ts
- import { AuthRepository } from "@/api/auth/authRepository";
+ import { AuthRepository } from "@/api/auth/authRepository.drizzle";
```

**Step 2:** Use Drizzle migration commands instead of Prisma:

```bash
# Generate & run Drizzle migrations
pnpm db:drizzle:push          # Quick push (dev)
pnpm db:drizzle:generate      # Generate SQL migration
pnpm db:drizzle:migrate       # Apply migrations (prod)
pnpm db:drizzle:seed           # Seed with Drizzle
pnpm db:drizzle:studio         # Visual DB browser
```

That's it! No changes needed to Service, Controller, or Route files.

### Drizzle Files

| File | Purpose |
|---|---|
| `drizzle/schema.ts` | Table definitions (pgTable, pgEnum) |
| `drizzle/relations.ts` | Drizzle relation definitions |
| `drizzle/seed.ts` | Database seeder |
| `drizzle.config.ts` | Drizzle Kit configuration |
| `src/common/lib/drizzle.ts` | Client singleton |
| `*.drizzle.ts` | Alternative repository implementations |

---

## 📄 License

MIT — use freely in personal and commercial projects.
