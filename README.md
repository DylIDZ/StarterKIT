# Universal Backend Starter Kit

A solid, production-ready backend boilerplate built with Node.js, Express, and TypeScript. It comes pre-configured with authentication, role-based access control, ORMs, and a suite of utility modules so you can focus on writing business logic without constantly setting up infrastructure.

## Stack Overview

- **Core**: Node.js, Express 5, TypeScript
- **Database**: PostgreSQL (via Prisma or Drizzle ORM)
- **Validation**: Zod
- **Auth**: JWT (stored securely in HttpOnly cookies)
- **Docs**: Auto-generated Swagger UI (`/api-docs`)
- **Tooling**: Biome (lint/format), Vitest, Docker, GitHub Actions

### Utility Modules Included
The kit incorporates 16 built-in utility modules designed around free and open-source APIs:
- **Payments**: Midtrans & Xendit
- **Storage**: Supabase Storage
- **Email**: Nodemailer + Brevo
- **Caching & Queues**: Redis & BullMQ
- **Real-time**: Socket.io
- **Documents**: PDFKit & ExcelJS
- **Communication**: WhatsApp via Fonnte
- **Other tools**: Audit logs, i18next, automatic DB backups, Geolocation (OSM/OSRM), server Cron jobs, SEO tools, and TOTP Two-Factor Auth.

Check `src/api/demo` for an example of how these modules wire together (e.g., Payment -> PDF -> Email).

## Getting Started

### Prerequisites
- Node.js >= 22
- pnpm >= 10
- PostgreSQL (or use the provided Docker compose file)

### Installation

1. Clone the repository and install dependencies:
```bash
git clone <your-repo-url> my-project
cd my-project
pnpm install
```

2. Set up your environment variables:
```bash
cp .env.template .env
```
Update the `.env` file with your database URL and necessary API keys. The app uses lazy initialization for external services, so it will still boot up smoothly even if you don't configure every single utility module right away.

3. Start the database and run migrations:
```bash
# Start local PostgreSQL and Redis
docker compose up -d

# Generate Prisma client and migrate
pnpm db:generate
pnpm db:migrate

# Seed default admin and user accounts
pnpm db:seed
```

4. Start the development server:
```bash
pnpm dev
```
The API will be available at `http://localhost:8080/api`. You can view the Swagger UI at `http://localhost:8080/api-docs`.

**Default test accounts:**
- Admin: `admin@starterkit.dev` / `Admin@1234`
- User: `user@starterkit.dev` / `User@1234`

## Project Structure

```
src/
├── api/             # Feature modules (auth, users, resource)
├── api-docs/        # OpenAPI/Swagger generation
├── common/          # Shared utilities (lib, middleware, models)
├── index.ts         # App bootstrap and graceful shutdown
└── server.ts        # Express setup and global middleware
```

When building a new feature, mirror the structure found in `src/api/resource/`. It organizes code into a model (Zod schemas for route validation), a controller (HTTP handlers), a service (business logic and DB transactions), and a repository (database access). 

## Prisma vs. Drizzle

This kit ships with both Prisma (the default) and Drizzle ORM. They share the exact same database structure. To switch to Drizzle, simply change the repository imports in your respective services.

For example, in `authService.ts`:
```typescript
// Replace this:
// import { AuthRepository } from "@/api/auth/authRepository";

// With this:
import { AuthRepository } from "@/api/auth/authRepository.drizzle";
```

Use `pnpm db:drizzle:push` or `pnpm db:drizzle:migrate` to manage your schema with Drizzle from the CLI.

## License
MIT
