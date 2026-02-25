/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  DRIZZLE ORM ALTERNATIVE                                 ║
 * ║  Same API as resourceRepository.ts — swap import.        ║
 * ║  Includes Drizzle Transaction example.                   ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { and, count, desc, eq } from "drizzle-orm";

import type { Resource } from "@/api/resource/resourceModel";
import { db } from "@/common/lib/drizzle";
import { logger } from "@/server";

import { resources, users } from "../../../drizzle/schema";

export class ResourceRepository {
    async findAllAsync(params: {
        skip: number;
        take: number;
        where?: Record<string, unknown>;
    }): Promise<Resource[]> {
        try {
            // Build dynamic where conditions
            const conditions = [];
            if (params.where?.userId) conditions.push(eq(resources.userId, params.where.userId as number));
            if (params.where?.status) conditions.push(eq(resources.status, params.where.status as any));
            if (params.where?.category) conditions.push(eq(resources.category, params.where.category as string));

            const query = db
                .select()
                .from(resources)
                .orderBy(desc(resources.createdAt))
                .limit(params.take)
                .offset(params.skip);

            if (conditions.length > 0) {
                query.where(and(...conditions));
            }

            const result = await query;
            return result as Resource[];
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.findAllAsync");
            throw error;
        }
    }

    async countAsync(where?: Record<string, unknown>): Promise<number> {
        try {
            const conditions = [];
            if (where?.userId) conditions.push(eq(resources.userId, where.userId as number));
            if (where?.status) conditions.push(eq(resources.status, where.status as any));
            if (where?.category) conditions.push(eq(resources.category, where.category as string));

            const query = db.select({ value: count() }).from(resources);
            if (conditions.length > 0) {
                query.where(and(...conditions));
            }

            const [result] = await query;
            return result?.value ?? 0;
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.countAsync");
            throw error;
        }
    }

    async findByIdAsync(id: number): Promise<Resource | null> {
        try {
            const [resource] = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
            return (resource as Resource) || null;
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.findByIdAsync");
            throw error;
        }
    }

    async createAsync(data: Omit<Resource, "id" | "createdAt" | "updatedAt">): Promise<Resource> {
        try {
            const [resource] = await db.insert(resources).values(data as any).returning();
            return resource as Resource;
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.createAsync");
            throw error;
        }
    }

    /**
     * ╔══════════════════════════════════════════════════════════════╗
     * ║  📌 DRIZZLE TRANSACTION EXAMPLE                             ║
     * ║  Creates a resource and updates the user's updatedAt        ║
     * ║  timestamp atomically within a single DB transaction.       ║
     * ║  If either fails, both are rolled back.                     ║
     * ╚══════════════════════════════════════════════════════════════╝
     */
    async createWithTransactionAsync(
        data: Omit<Resource, "id" | "createdAt" | "updatedAt">,
        userId: number,
    ): Promise<Resource> {
        try {
            const resource = await db.transaction(async (tx) => {
                // Step 1: Create the resource
                const [newResource] = await tx.insert(resources).values(data as any).returning();

                // Step 2: Update user's updatedAt timestamp (within same transaction)
                // Demonstrates multi-table atomic operations — both succeed or both rollback
                await tx.update(users).set({ updatedAt: new Date() }).where(eq(users.id, userId));

                return newResource;
            });

            return resource as Resource;
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.createWithTransactionAsync");
            throw error;
        }
    }

    async updateAsync(id: number, data: Partial<Resource>): Promise<Resource> {
        try {
            const [resource] = await db.update(resources).set(data as any).where(eq(resources.id, id)).returning();
            return resource as Resource;
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.updateAsync");
            throw error;
        }
    }

    async deleteAsync(id: number): Promise<void> {
        try {
            await db.delete(resources).where(eq(resources.id, id));
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.deleteAsync");
            throw error;
        }
    }
}
