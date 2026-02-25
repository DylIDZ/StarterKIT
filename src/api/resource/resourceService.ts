import { StatusCodes } from "http-status-codes";

import type { Resource } from "@/api/resource/resourceModel";
import { ResourceRepository } from "@/api/resource/resourceRepository";
import { prisma } from "@/common/lib/prisma";
import { ServiceResponse } from "@/common/models/serviceResponse";
import type { PaginationMeta } from "@/common/utils/commonValidation";
import { logger } from "@/server";

export class ResourceService {
    private resourceRepository: ResourceRepository;

    constructor(repository: ResourceRepository = new ResourceRepository()) {
        this.resourceRepository = repository;
    }

    /**
     * List resources with pagination and optional filters.
     * Admins see all resources; regular users see only their own.
     */
    async findAll(
        params: { page: number; limit: number; status?: string; category?: string },
        requestingUserId: number,
        requestingUserRole: string,
    ): Promise<ServiceResponse<{ items: Resource[]; pagination: PaginationMeta } | null>> {
        try {
            const { page, limit, status, category } = params;
            const skip = (page - 1) * limit;

            // Build where clause: non-admins can only see their own resources
            const where: Record<string, unknown> = {};
            if (requestingUserRole !== "ADMIN") {
                where.userId = requestingUserId;
            }
            if (status) where.status = status;
            if (category) where.category = category;

            const [items, total] = await Promise.all([
                this.resourceRepository.findAllAsync({ skip, take: limit, where }),
                this.resourceRepository.countAsync(where),
            ]);

            const pagination: PaginationMeta = {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            };

            return ServiceResponse.success("Resources retrieved", { items, pagination });
        } catch (ex) {
            logger.error(`Error listing resources: ${(ex as Error).message}`);
            return ServiceResponse.failure("An error occurred while listing resources.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get a single resource by ID.
     * Non-admin users can only access their own resources.
     */
    async findById(
        id: number,
        requestingUserId: number,
        requestingUserRole: string,
    ): Promise<ServiceResponse<Resource | null>> {
        try {
            const resource = await this.resourceRepository.findByIdAsync(id);
            if (!resource) {
                return ServiceResponse.failure("Resource not found", null, StatusCodes.NOT_FOUND);
            }

            // Ownership check: non-admins can only access their own
            if (requestingUserRole !== "ADMIN" && resource.userId !== requestingUserId) {
                return ServiceResponse.failure("You do not have permission to access this resource", null, StatusCodes.FORBIDDEN);
            }

            return ServiceResponse.success<Resource>("Resource found", resource);
        } catch (ex) {
            logger.error(`Error finding resource ${id}: ${(ex as Error).message}`);
            return ServiceResponse.failure("An error occurred while finding resource.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Create a new resource with associated audit log entry.
     *
     * ╔══════════════════════════════════════════════════════════════╗
     * ║  📌 PRISMA TRANSACTION EXAMPLE                              ║
     * ║  This method demonstrates the use of Prisma's interactive   ║
     * ║  transaction ($transaction) to atomically create a resource  ║
     * ║  AND update a related record within a single DB transaction. ║
     * ║  If either operation fails, both are rolled back.           ║
     * ╚══════════════════════════════════════════════════════════════╝
     */
    async create(
        data: {
            title: string;
            description?: string;
            content?: string;
            status?: string;
            category?: string;
            tags?: string[];
            metadata?: Record<string, unknown>;
        },
        userId: number,
    ): Promise<ServiceResponse<Resource | null>> {
        try {
            // ─── Prisma Interactive Transaction ──────────────────────
            // All operations inside $transaction share the same DB connection.
            // If any operation throws, the entire transaction is rolled back.
            const resource = await prisma.$transaction(async (tx) => {
                // Step 1: Create the resource
                const newResource = await tx.resource.create({
                    data: {
                        title: data.title,
                        description: data.description || null,
                        content: data.content || null,
                        status: (data.status as any) || "DRAFT",
                        category: data.category || null,
                        tags: data.tags || [],
                        metadata: (data.metadata ?? undefined) as any,
                        userId,
                    },
                });

                // Step 2: Update the user's updatedAt timestamp (within same transaction)
                // This demonstrates multi-table operations in a single atomic transaction.
                // In a real app, you might: create audit logs, update counters, etc.
                await tx.user.update({
                    where: { id: userId },
                    data: { updatedAt: new Date() },
                });

                return newResource;
            });

            return ServiceResponse.success<Resource>("Resource created successfully", resource as unknown as Resource, StatusCodes.CREATED);
        } catch (ex) {
            logger.error(`Error creating resource: ${(ex as Error).message}`);
            return ServiceResponse.failure("An error occurred while creating resource.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Update an existing resource.
     * Non-admin users can only update their own resources.
     */
    async update(
        id: number,
        data: Partial<{
            title: string;
            description: string | null;
            content: string | null;
            status: string;
            category: string | null;
            tags: string[];
            metadata: Record<string, unknown> | null;
        }>,
        requestingUserId: number,
        requestingUserRole: string,
    ): Promise<ServiceResponse<Resource | null>> {
        try {
            const existing = await this.resourceRepository.findByIdAsync(id);
            if (!existing) {
                return ServiceResponse.failure("Resource not found", null, StatusCodes.NOT_FOUND);
            }

            // Ownership check
            if (requestingUserRole !== "ADMIN" && existing.userId !== requestingUserId) {
                return ServiceResponse.failure("You do not have permission to update this resource", null, StatusCodes.FORBIDDEN);
            }

            const updated = await this.resourceRepository.updateAsync(id, data as Partial<Resource>);
            return ServiceResponse.success<Resource>("Resource updated successfully", updated);
        } catch (ex) {
            logger.error(`Error updating resource ${id}: ${(ex as Error).message}`);
            return ServiceResponse.failure("An error occurred while updating resource.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Delete a resource.
     * Non-admin users can only delete their own resources.
     */
    async delete(
        id: number,
        requestingUserId: number,
        requestingUserRole: string,
    ): Promise<ServiceResponse<null>> {
        try {
            const existing = await this.resourceRepository.findByIdAsync(id);
            if (!existing) {
                return ServiceResponse.failure("Resource not found", null, StatusCodes.NOT_FOUND);
            }

            // Ownership check
            if (requestingUserRole !== "ADMIN" && existing.userId !== requestingUserId) {
                return ServiceResponse.failure("You do not have permission to delete this resource", null, StatusCodes.FORBIDDEN);
            }

            await this.resourceRepository.deleteAsync(id);
            return ServiceResponse.success<null>("Resource deleted successfully", null);
        } catch (ex) {
            logger.error(`Error deleting resource ${id}: ${(ex as Error).message}`);
            return ServiceResponse.failure("An error occurred while deleting resource.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }
}

export const resourceService = new ResourceService();
