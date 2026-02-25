import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { commonValidations, PaginationQuerySchema } from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

// ─── Resource Schema (Public) ──────────────────────────────────────

export const ResourceSchema = z.object({
    id: z.number(),
    title: z.string(),
    description: z.string().nullable(),
    content: z.string().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    category: z.string().nullable(),
    tags: z.array(z.string()),
    metadata: z.any().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    userId: z.number(),
});

export type Resource = z.infer<typeof ResourceSchema>;

// ─── Request Validation Schemas ────────────────────────────────────

export const GetResourceSchema = z.object({
    params: z.object({ id: commonValidations.id }),
});

export const ListResourcesSchema = z.object({
    query: PaginationQuerySchema.extend({
        status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
        category: z.string().optional(),
    }),
});

export const CreateResourceSchema = z.object({
    body: z.object({
        title: z.string().min(1, "Title is required").max(255),
        description: z.string().max(1000).optional(),
        content: z.string().optional(),
        status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
        category: z.string().max(100).optional(),
        tags: z.array(z.string().max(50)).max(10).default([]),
        metadata: z.record(z.unknown()).optional(),
    }),
});

export const UpdateResourceSchema = z.object({
    params: z.object({ id: commonValidations.id }),
    body: z.object({
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).nullable().optional(),
        content: z.string().nullable().optional(),
        status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
        category: z.string().max(100).nullable().optional(),
        tags: z.array(z.string().max(50)).max(10).optional(),
        metadata: z.record(z.unknown()).nullable().optional(),
    }),
});

export type GetResourceRequest = z.infer<typeof GetResourceSchema>;
export type ListResourcesRequest = z.infer<typeof ListResourcesSchema>;
export type CreateResourceRequest = z.infer<typeof CreateResourceSchema>;
export type UpdateResourceRequest = z.infer<typeof UpdateResourceSchema>;
