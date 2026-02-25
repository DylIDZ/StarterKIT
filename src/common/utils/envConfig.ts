import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("production"),

    HOST: z.string().min(1).default("localhost"),

    PORT: z.coerce.number().int().positive().default(8080),

    DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),

    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    COMMON_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),

    COMMON_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(1000),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

    JWT_ACCESS_EXPIRY: z.string().default("15m"),

    JWT_REFRESH_EXPIRY: z.string().default("7d"),

    // ─── Payment Gateway ────────────────────────────────────────────
    PAYMENT_PROVIDER: z.enum(["midtrans", "xendit"]).default("midtrans").optional(),
    MIDTRANS_SERVER_KEY: z.string().optional(),
    MIDTRANS_CLIENT_KEY: z.string().optional(),
    MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false).optional(),
    XENDIT_SECRET_KEY: z.string().optional(),
    XENDIT_WEBHOOK_TOKEN: z.string().optional(),

    // ─── Cloud Storage (Supabase) ───────────────────────────────────
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default("uploads").optional(),

    // ─── Mailer (Brevo SMTP) ────────────────────────────────────────
    SMTP_HOST: z.string().default("smtp-relay.brevo.com").optional(),
    SMTP_PORT: z.coerce.number().default(587).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM_NAME: z.string().default("StarterKit App").optional(),
    MAIL_FROM_ADDRESS: z.string().email().optional(),

    // ─── Redis (Caching + Queue) ────────────────────────────────────
    REDIS_URL: z.string().default("redis://localhost:6379").optional(),

    // ─── WhatsApp (Fonnte) ──────────────────────────────────────────
    FONNTE_API_TOKEN: z.string().optional(),
    FONNTE_API_URL: z.string().url().default("https://api.fonnte.com").optional(),

    // ─── Geolocation (Nominatim + OSRM) ─────────────────────────────
    NOMINATIM_BASE_URL: z.string().url().default("https://nominatim.openstreetmap.org").optional(),
    OSRM_BASE_URL: z.string().url().default("http://localhost:5000").optional(),

    // ─── Google Authenticator (2FA) ─────────────────────────────────
    TWO_FACTOR_APP_NAME: z.string().default("StarterKitApp").optional(),

    // ─── Scheduler ──────────────────────────────────────────────────
    SCHEDULER_ENABLED: z.coerce.boolean().default(true).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("❌ Invalid environment variables:", parsedEnv.error.format());
    throw new Error("Invalid environment variables");
}

export const env = {
    ...parsedEnv.data,
    isDevelopment: parsedEnv.data.NODE_ENV === "development",
    isProduction: parsedEnv.data.NODE_ENV === "production",
    isTest: parsedEnv.data.NODE_ENV === "test",
};
