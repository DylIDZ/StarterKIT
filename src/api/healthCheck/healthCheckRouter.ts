import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";

export const healthCheckRegistry = new OpenAPIRegistry();
export const healthCheckRouter: Router = express.Router();

healthCheckRegistry.registerPath({
    method: "get",
    path: "/health-check",
    tags: ["Health Check"],
    responses: createApiResponse(
        z.object({
            status: z.string(),
            uptime: z.number(),
            timestamp: z.string(),
            environment: z.string(),
        }),
        "Service is healthy",
    ),
});

healthCheckRouter.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: "Service is healthy",
        data: {
            status: "ok",
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "unknown",
        },
        statusCode: 200,
    });
});
