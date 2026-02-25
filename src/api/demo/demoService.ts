import { StatusCodes } from "http-status-codes";
import crypto from "node:crypto";
import { pino } from "pino";

import type {
    CreatePurchaseInput,
    PurchaseResponse,
    StatusResponse,
    WebhookResponse,
} from "@/api/demo/demoModel";
import { paymentGateway, type WebhookPayload } from "@/common/lib/payment";
import { PdfGenerator } from "@/common/lib/pdf";
import { mailer } from "@/common/lib/mailer";
import { ServiceResponse } from "@/common/models/serviceResponse";

const logger = pino({ name: "demo-service" });

/**
 * Demo Service — Demonstrates integration of 3+ modules:
 *
 * 1. Payment Gateway (Midtrans/Xendit) — Create transaction
 * 2. PDF Generator (PDFKit) — Generate invoice PDF
 * 3. Mailer (Nodemailer + Brevo) — Send invoice email with PDF attachment
 */
export class DemoService {
    /**
     * Step 1: Create a purchase → initiate payment transaction.
     */
    async createPurchase(input: CreatePurchaseInput): Promise<ServiceResponse<PurchaseResponse | null>> {
        try {
            const orderId = `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

            const transaction = await paymentGateway.createTransaction({
                orderId,
                amount: input.amount * input.quantity,
                customerName: input.customerName,
                customerEmail: input.customerEmail,
                customerPhone: input.customerPhone,
                itemDetails: [
                    {
                        id: `SVC-${crypto.randomBytes(2).toString("hex")}`,
                        name: input.serviceName,
                        price: input.amount,
                        quantity: input.quantity,
                    },
                ],
            });

            return ServiceResponse.success<PurchaseResponse>(
                "Purchase created. Redirect customer to payment URL.",
                {
                    orderId: transaction.orderId,
                    paymentToken: transaction.token,
                    paymentUrl: transaction.redirectUrl,
                    amount: input.amount * input.quantity,
                },
                StatusCodes.CREATED,
            );
        } catch (error) {
            logger.error({ error }, "Failed to create purchase");
            return ServiceResponse.failure(
                `Failed to create purchase: ${(error as Error).message}`,
                null,
                StatusCodes.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Step 2: Handle payment webhook → on success, generate PDF invoice → send email.
     */
    async handlePaymentWebhook(payload: WebhookPayload): Promise<ServiceResponse<WebhookResponse | null>> {
        try {
            // Verify webhook with payment provider
            const status = await paymentGateway.handleWebhook(payload);

            logger.info(
                { orderId: status.orderId, status: status.transactionStatus },
                "Webhook received",
            );

            // Only process successful payments
            const isSuccess =
                status.transactionStatus === "settlement" ||
                status.transactionStatus === "capture" ||
                status.transactionStatus === "paid";

            if (!isSuccess) {
                return ServiceResponse.success<WebhookResponse>(
                    `Payment status: ${status.transactionStatus}`,
                    {
                        orderId: status.orderId,
                        status: status.transactionStatus,
                        invoiceSent: false,
                    },
                );
            }

            // ─── Generate PDF Invoice ───────────────────────────
            const invoicePdf = await PdfGenerator.generateInvoice({
                invoiceNumber: status.orderId,
                date: new Date().toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                }),
                company: {
                    name: "StarterKit Inc.",
                    address: "Jakarta, Indonesia",
                    email: "billing@starterkit.dev",
                },
                customer: {
                    name: payload.customer_name as string || "Customer",
                    email: payload.customer_email as string || "",
                },
                items: [
                    {
                        name: (payload.item_name as string) || "Service",
                        quantity: 1,
                        price: Number(status.grossAmount) || 0,
                    },
                ],
                notes: "Thank you for your purchase! This invoice was generated automatically.",
            });

            // ─── Send Invoice Email ─────────────────────────────
            let invoiceSent = false;
            const customerEmail = payload.customer_email as string;

            if (customerEmail) {
                try {
                    await mailer.sendTemplatedMail({
                        to: customerEmail,
                        subject: `Invoice #${status.orderId} — Payment Confirmed`,
                        template: "invoice",
                        context: {
                            invoiceNumber: status.orderId,
                            date: new Date().toLocaleDateString("id-ID"),
                            customerName: payload.customer_name || "Customer",
                            customerEmail,
                            isPaid: true,
                            items: [
                                {
                                    name: (payload.item_name as string) || "Service",
                                    quantity: 1,
                                    price: Number(status.grossAmount)?.toLocaleString("id-ID") || "0",
                                    subtotal: Number(status.grossAmount)?.toLocaleString("id-ID") || "0",
                                },
                            ],
                            totalAmount: Number(status.grossAmount)?.toLocaleString("id-ID") || "0",
                            companyName: "StarterKit Inc.",
                            companyAddress: "Jakarta, Indonesia",
                        },
                        attachments: [
                            {
                                filename: `invoice-${status.orderId}.pdf`,
                                content: invoicePdf,
                                contentType: "application/pdf",
                            },
                        ],
                    });
                    invoiceSent = true;
                    logger.info({ orderId: status.orderId, email: customerEmail }, "Invoice email sent");
                } catch (emailError) {
                    logger.error({ error: emailError }, "Failed to send invoice email (non-fatal)");
                }
            }

            return ServiceResponse.success<WebhookResponse>(
                "Payment processed, invoice generated and sent",
                {
                    orderId: status.orderId,
                    status: status.transactionStatus,
                    invoiceSent,
                },
            );
        } catch (error) {
            logger.error({ error }, "Webhook processing failed");
            return ServiceResponse.failure(
                `Webhook error: ${(error as Error).message}`,
                null,
                StatusCodes.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Step 3: Check payment status of an order.
     */
    async checkPaymentStatus(orderId: string): Promise<ServiceResponse<StatusResponse | null>> {
        try {
            const status = await paymentGateway.checkStatus(orderId);

            return ServiceResponse.success<StatusResponse>("Payment status retrieved", {
                orderId: status.orderId,
                transactionStatus: status.transactionStatus,
                paymentType: status.paymentType,
                amount: status.grossAmount,
            });
        } catch (error) {
            logger.error({ error, orderId }, "Failed to check payment status");
            return ServiceResponse.failure(
                `Failed to check status: ${(error as Error).message}`,
                null,
                StatusCodes.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

export const demoService = new DemoService();
