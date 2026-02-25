import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { demoController } from "@/api/demo/demoController";
import { CheckStatusSchema, CreatePurchaseSchema } from "@/api/demo/demoModel";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { authenticateJwt } from "@/common/middleware/authMiddleware";
import { validateRequest } from "@/common/utils/httpHandlers";

export const demoRegistry = new OpenAPIRegistry();
export const demoRouter: Router = express.Router();

// ─── Routes ─────────────────────────────────────────────────────────

// Create purchase (requires auth)
demoRouter.post(
    "/purchase",
    authenticateJwt,
    validateRequest(CreatePurchaseSchema),
    demoController.createPurchase,
);

// Payment webhook (public — called by payment gateway)
demoRouter.post("/webhook/payment", demoController.handleWebhook);

// Check payment status (requires auth)
demoRouter.get(
    "/purchase/:orderId/status",
    authenticateJwt,
    validateRequest(CheckStatusSchema),
    demoController.checkStatus,
);

// ─── OpenAPI Registry (Swagger) ─────────────────────────────────────

demoRegistry.registerPath({
    method: "post",
    path: "/demo/purchase",
    tags: ["Demo — Purchase Flow"],
    security: [{ bearerAuth: [] }],
    description:
        "Create a purchase and initialize payment. Demonstrates: Payment Gateway → generates payment URL for customer.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: CreatePurchaseSchema.shape.body,
                },
            },
        },
    },
    responses: createApiResponse(
        z.object({
            orderId: z.string(),
            paymentToken: z.string(),
            paymentUrl: z.string(),
            amount: z.number(),
        }),
        "Purchase created successfully",
    ),
});

demoRegistry.registerPath({
    method: "post",
    path: "/demo/webhook/payment",
    tags: ["Demo — Purchase Flow"],
    description:
        "Payment webhook handler. On successful payment: generates PDF invoice → sends email with PDF attachment. Called by payment gateway (Midtrans/Xendit).",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        order_id: z.string(),
                        transaction_status: z.string(),
                        fraud_status: z.string().optional(),
                        payment_type: z.string().optional(),
                        gross_amount: z.string().optional(),
                        customer_name: z.string().optional(),
                        customer_email: z.string().optional(),
                        item_name: z.string().optional(),
                    }),
                },
            },
        },
    },
    responses: createApiResponse(
        z.object({
            orderId: z.string(),
            status: z.string(),
            invoiceSent: z.boolean(),
        }),
        "Webhook processed",
    ),
});

demoRegistry.registerPath({
    method: "get",
    path: "/demo/purchase/{orderId}/status",
    tags: ["Demo — Purchase Flow"],
    security: [{ bearerAuth: [] }],
    description: "Check the payment status of an order.",
    request: { params: CheckStatusSchema.shape.params },
    responses: createApiResponse(
        z.object({
            orderId: z.string(),
            transactionStatus: z.string(),
            paymentType: z.string().optional(),
            amount: z.string(),
        }),
        "Payment status retrieved",
    ),
});
