import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { resourceController } from "@/api/resource/resourceController";
import {
    CreateResourceSchema,
    GetResourceSchema,
    ListResourcesSchema,
    ResourceSchema,
    UpdateResourceSchema,
} from "@/api/resource/resourceModel";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { authenticateJwt } from "@/common/middleware/authMiddleware";
import { validateRequest } from "@/common/utils/httpHandlers";

export const resourceRegistry = new OpenAPIRegistry();
export const resourceRouter: Router = express.Router();

// All resource routes require authentication
resourceRouter.use(authenticateJwt);

// ─── Routes ────────────────────────────────────────────────────────

resourceRouter.get("/", validateRequest(ListResourcesSchema), resourceController.list);
resourceRouter.get("/:id", validateRequest(GetResourceSchema), resourceController.getById);
resourceRouter.post("/", validateRequest(CreateResourceSchema), resourceController.create);
resourceRouter.put("/:id", validateRequest(UpdateResourceSchema), resourceController.update);
resourceRouter.delete("/:id", validateRequest(GetResourceSchema), resourceController.remove);

// ─── OpenAPI Registry (Swagger) ────────────────────────────────────

resourceRegistry.register("Resource", ResourceSchema);

const paginationMeta = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
});

resourceRegistry.registerPath({
    method: "get",
    path: "/resources",
    tags: ["Resource"],
    security: [{ bearerAuth: [] }],
    description: "List resources with pagination. Non-admin users see only their own resources.",
    request: { query: ListResourcesSchema.shape.query },
    responses: createApiResponse(
        z.object({ items: z.array(ResourceSchema), pagination: paginationMeta }),
        "Resources retrieved",
    ),
});

resourceRegistry.registerPath({
    method: "get",
    path: "/resources/{id}",
    tags: ["Resource"],
    security: [{ bearerAuth: [] }],
    request: { params: GetResourceSchema.shape.params },
    responses: createApiResponse(ResourceSchema, "Resource found"),
});

resourceRegistry.registerPath({
    method: "post",
    path: "/resources",
    tags: ["Resource"],
    security: [{ bearerAuth: [] }],
    description: "Create a new resource. Uses Prisma Transaction internally.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: CreateResourceSchema.shape.body,
                },
            },
        },
    },
    responses: createApiResponse(ResourceSchema, "Resource created successfully"),
});

resourceRegistry.registerPath({
    method: "put",
    path: "/resources/{id}",
    tags: ["Resource"],
    security: [{ bearerAuth: [] }],
    description: "Update a resource. Non-admin users can only update their own resources.",
    request: {
        params: GetResourceSchema.shape.params,
        body: {
            content: {
                "application/json": {
                    schema: UpdateResourceSchema.shape.body,
                },
            },
        },
    },
    responses: createApiResponse(ResourceSchema, "Resource updated successfully"),
});

resourceRegistry.registerPath({
    method: "delete",
    path: "/resources/{id}",
    tags: ["Resource"],
    security: [{ bearerAuth: [] }],
    description: "Delete a resource. Non-admin users can only delete their own resources.",
    request: { params: GetResourceSchema.shape.params },
    responses: createApiResponse(z.null(), "Resource deleted successfully"),
});
