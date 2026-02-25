import { prisma } from "@/common/lib/prisma";
import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";

const server = app.listen(env.PORT, () => {
    const { NODE_ENV, HOST, PORT } = env;
    logger.info(`Server (${NODE_ENV}) running on http://${HOST}:${PORT}/api`);
    logger.info(`Swagger UI available at http://${HOST}:${PORT}/api-docs`);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────
// Properly closes HTTP server and Prisma DB connection on termination.

const onCloseSignal = async () => {
    logger.info("Received shutdown signal, starting graceful shutdown...");

    // 1. Stop accepting new connections
    server.close(() => {
        logger.info("HTTP server closed — no longer accepting connections");
    });

    // 2. Disconnect Prisma client to release DB connection pool
    try {
        await prisma.$disconnect();
        logger.info("Prisma database connection closed");
    } catch (err) {
        logger.error({ err }, "Error disconnecting Prisma client");
    }

    // 3. Exit process
    logger.info("Graceful shutdown complete");
    process.exit(0);
};

// Force shutdown if graceful shutdown takes too long (10s timeout)
const forceShutdown = () => {
    setTimeout(() => {
        logger.error("Forced shutdown — graceful shutdown timed out after 10s");
        process.exit(1);
    }, 10000).unref();
};

process.on("SIGINT", () => {
    forceShutdown();
    onCloseSignal();
});

process.on("SIGTERM", () => {
    forceShutdown();
    onCloseSignal();
});
