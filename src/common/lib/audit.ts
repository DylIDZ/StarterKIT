import type { NextFunction, Request, Response } from "express";
import { pino } from "pino";
import { prisma } from "@/common/lib/prisma";

// ─── Types ──────────────────────────────────────────────────────────

export interface AuditLogEntry {
    action: string;
    entityType: string;
    entityId?: string;
    userId?: number;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
}

export interface AuditLogRecord extends AuditLogEntry {
    id: number;
    createdAt: Date;
}

// ─── Audit Logger Singleton ─────────────────────────────────────────

const logger = pino({ name: "audit" });

class AuditLogger {
    private static instance: AuditLogger;

    private constructor() { }

    static getInstance(): AuditLogger {
        if (!AuditLogger.instance) {
            AuditLogger.instance = new AuditLogger();
        }
        return AuditLogger.instance;
    }

    /**
     * Write an audit log entry to the database.
     * Falls back to pino logger if DB write fails (non-blocking).
     */
    async log(entry: AuditLogEntry): Promise<void> {
        try {
            // Try to write to database (requires AuditLog model in Prisma schema)
            await (prisma as any).auditLog?.create({
                data: {
                    action: entry.action,
                    entityType: entry.entityType,
                    entityId: entry.entityId || null,
                    userId: entry.userId || null,
                    userEmail: entry.userEmail || null,
                    ipAddress: entry.ipAddress || null,
                    userAgent: entry.userAgent || null,
                    oldData: entry.oldData ? JSON.parse(JSON.stringify(entry.oldData)) : undefined,
                    newData: entry.newData ? JSON.parse(JSON.stringify(entry.newData)) : undefined,
                    metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : undefined,
                },
            });
        } catch {
            // Fallback: always log to pino regardless of DB availability
            logger.info(
                {
                    audit: true,
                    action: entry.action,
                    entityType: entry.entityType,
                    entityId: entry.entityId,
                    userId: entry.userId,
                    ipAddress: entry.ipAddress,
                },
                `AUDIT: ${entry.action} on ${entry.entityType}`,
            );
        }
    }

    /**
     * Get audit logs for a specific entity.
     */
    async getLogsForEntity(
        entityType: string,
        entityId: string,
        limit = 50,
    ): Promise<AuditLogRecord[]> {
        try {
            const logs = await (prisma as any).auditLog?.findMany({
                where: { entityType, entityId },
                orderBy: { createdAt: "desc" },
                take: limit,
            });
            return logs || [];
        } catch {
            logger.warn("AuditLog table not available, returning empty results");
            return [];
        }
    }

    /**
     * Get audit logs for a specific user.
     */
    async getLogsForUser(userId: number, limit = 50): Promise<AuditLogRecord[]> {
        try {
            const logs = await (prisma as any).auditLog?.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: limit,
            });
            return logs || [];
        } catch {
            logger.warn("AuditLog table not available, returning empty results");
            return [];
        }
    }
}

export const auditLogger = AuditLogger.getInstance();

// ─── Express Middleware ─────────────────────────────────────────────

/**
 * Middleware that auto-logs mutations (POST, PUT, PATCH, DELETE).
 * Place after authentication middleware so req.user is available.
 */
export function auditMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Only track mutating methods
        if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
            next();
            return;
        }

        const originalSend = res.send.bind(res);

        res.send = function (body: any) {
            // Log asynchronously, don't block the response
            const user = req.user as { userId?: number; email?: string } | undefined;

            auditLogger.log({
                action: `${req.method} ${req.originalUrl}`,
                entityType: req.baseUrl.replace("/api/", "") || "unknown",
                userId: user?.userId,
                userEmail: user?.email,
                ipAddress: req.ip || req.socket.remoteAddress,
                userAgent: req.get("user-agent"),
                newData: req.method !== "DELETE" ? (req.body as Record<string, unknown>) : null,
                metadata: {
                    statusCode: res.statusCode,
                    params: req.params,
                },
            }).catch(() => {
                // Silently ignore — already handled in auditLogger.log
            });

            return originalSend(body);
        };

        next();
    };
}
