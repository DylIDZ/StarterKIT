import { createServer } from "node:http";
import { prisma } from "@/common/lib/prisma";
import { cacheManager } from "@/common/lib/cache";
import { queueManager } from "@/common/lib/queue";
import { socketManager } from "@/common/lib/socket";
import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";

const httpServer = createServer(app);

// ─── Initialize Socket.io ──────────────────────────────────────────
socketManager.initialize(httpServer);

const server = httpServer.listen(env.PORT, () => {
    const { NODE_ENV, HOST, PORT } = env;
    logger.info(`Server (${NODE_ENV}) running on http://${HOST}:${PORT}/api`);
    logger.info(`Swagger UI available at http://${HOST}:${PORT}/api-docs`);
    logger.info(`Socket.io ready on http://${HOST}:${PORT}`);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────
// Properly closes HTTP server, Socket.io, Redis, BullMQ, and Prisma.

const onCloseSignal = async () => {
    logger.info("Received shutdown signal, starting graceful shutdown...");

    // 1. Stop accepting new connections
    server.close(() => {
        logger.info("HTTP server closed — no longer accepting connections");
    });

    // 2. Close Socket.io
    try {
        await socketManager.close();
        logger.info("Socket.io closed");
    } catch (err) {
        logger.error({ err }, "Error closing Socket.io");
    }

    // 3. Shutdown BullMQ queues and workers
    try {
        await queueManager.shutdown();
        logger.info("BullMQ queues and workers closed");
    } catch (err) {
        logger.error({ err }, "Error shutting down BullMQ");
    }

    // 4. Disconnect Redis
    try {
        await cacheManager.disconnect();
        logger.info("Redis connection closed");
    } catch (err) {
        logger.error({ err }, "Error disconnecting Redis");
    }

    // 5. Disconnect Prisma
    try {
        await prisma.$disconnect();
        logger.info("Prisma database connection closed");
    } catch (err) {
        logger.error({ err }, "Error disconnecting Prisma client");
    }

    // 6. Exit process
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
