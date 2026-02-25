import { z } from "zod";

// ─── Request Schemas ────────────────────────────────────────────────

export const CreatePurchaseSchema = z.object({
    body: z.object({
        serviceName: z.string().min(1, "Service name is required"),
        serviceDescription: z.string().optional(),
        amount: z.number().positive("Amount must be positive"),
        quantity: z.number().int().positive().default(1),
        customerName: z.string().min(1, "Customer name is required"),
        customerEmail: z.string().email("Valid email is required"),
        customerPhone: z.string().optional(),
    }),
});

export const CheckStatusSchema = z.object({
    params: z.object({
        orderId: z.string().min(1, "Order ID is required"),
    }),
});

export type CreatePurchaseInput = z.infer<typeof CreatePurchaseSchema>["body"];

// ─── Response Types ─────────────────────────────────────────────────

export interface PurchaseResponse {
    orderId: string;
    paymentToken: string;
    paymentUrl: string;
    amount: number;
}

export interface WebhookResponse {
    orderId: string;
    status: string;
    invoiceSent: boolean;
}

export interface StatusResponse {
    orderId: string;
    transactionStatus: string;
    paymentType?: string;
    amount: string;
}
