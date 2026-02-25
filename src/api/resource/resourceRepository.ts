import type { Resource } from "@/api/resource/resourceModel";
import { prisma } from "@/common/lib/prisma";
import { logger } from "@/server";

export class ResourceRepository {
    async findAllAsync(params: {
        skip: number;
        take: number;
        where?: Record<string, unknown>;
    }): Promise<Resource[]> {
        try {
            const resources = await prisma.resource.findMany({
                skip: params.skip,
                take: params.take,
                where: params.where as any,
                orderBy: { createdAt: "desc" },
            });
            return resources;
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.findAllAsync");
            throw error;
        }
    }

    async countAsync(where?: Record<string, unknown>): Promise<number> {
        try {
            return await prisma.resource.count({ where: where as any });
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.countAsync");
            throw error;
        }
    }

    async findByIdAsync(id: number): Promise<Resource | null> {
        try {
            const resource = await prisma.resource.findUnique({
                where: { id },
            });
            return resource || null;
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.findByIdAsync");
            throw error;
        }
    }

    async createAsync(data: Omit<Resource, "id" | "createdAt" | "updatedAt">): Promise<Resource> {
        try {
            const resource = await prisma.resource.create({ data: data as any });
            return resource;
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.createAsync");
            throw error;
        }
    }

    async updateAsync(id: number, data: Partial<Resource>): Promise<Resource> {
        try {
            const resource = await prisma.resource.update({
                where: { id },
                data: data as any,
            });
            return resource;
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.updateAsync");
            throw error;
        }
    }

    async deleteAsync(id: number): Promise<void> {
        try {
            await prisma.resource.delete({ where: { id } });
        } catch (error) {
            logger.error({ error }, "Database error in ResourceRepository.deleteAsync");
            throw error;
        }
    }
}
