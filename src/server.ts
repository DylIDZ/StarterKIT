import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";

import { healthCheckRouter } from "@/api/healthCheck/healthCheckRouter";
import { authRouter } from "@/api/routes/authRoute";
import { resourceRouter } from "@/api/routes/resourceRoute";
import { userRouter } from "@/api/routes/userRoute";
import { openAPIRouter } from "@/api-docs/openAPIRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { env } from "@/common/utils/envConfig";

const logger = pino({ name: "server start" });
const app: Express = express();

// ─── Trust Reverse Proxy ───────────────────────────────────────────
app.set("trust proxy", true);

// ─── Global Middlewares ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimiter);

// ─── Request Logging ───────────────────────────────────────────────
app.use(requestLogger);

// ─── API Routes ────────────────────────────────────────────────────
const apiRouter = express.Router();
apiRouter.use("/health-check", healthCheckRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/resources", resourceRouter);

// Health-check at root for quick monitoring
app.use("/health-check", healthCheckRouter);

// All API routes under /api prefix
app.use("/api", apiRouter);

// ─── Swagger UI (OpenAPI Docs) ─────────────────────────────────────
app.use(openAPIRouter);

// ─── Error Handlers ────────────────────────────────────────────────
app.use(errorHandler());

export { app, logger };
