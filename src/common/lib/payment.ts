import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface CreateTransactionParams {
    orderId: string;
    amount: number;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    itemDetails?: Array<{
        id: string;
        name: string;
        price: number;
        quantity: number;
    }>;
}

export interface TransactionResult {
    token: string;
    redirectUrl: string;
    orderId: string;
}

export interface TransactionStatus {
    orderId: string;
    transactionStatus: string;
    fraudStatus?: string;
    paymentType?: string;
    grossAmount: string;
    settlementTime?: string;
}

export interface WebhookPayload {
    order_id: string;
    transaction_status: string;
    fraud_status?: string;
    payment_type?: string;
    gross_amount?: string;
    signature_key?: string;
    status_code?: string;
    [key: string]: unknown;
}

export interface IPaymentProvider {
    createTransaction(params: CreateTransactionParams): Promise<TransactionResult>;
    verifyWebhook(payload: WebhookPayload): Promise<TransactionStatus>;
    checkStatus(orderId: string): Promise<TransactionStatus>;
}

// ─── Midtrans Provider ──────────────────────────────────────────────

class MidtransProvider implements IPaymentProvider {
    private snap: InstanceType<typeof import("midtrans-client").Snap>;
    private core: InstanceType<typeof import("midtrans-client").CoreApi>;

    constructor() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const midtrans = require("midtrans-client");

        this.snap = new midtrans.Snap({
            isProduction: env.MIDTRANS_IS_PRODUCTION ?? false,
            serverKey: env.MIDTRANS_SERVER_KEY!,
            clientKey: env.MIDTRANS_CLIENT_KEY!,
        });

        this.core = new midtrans.CoreApi({
            isProduction: env.MIDTRANS_IS_PRODUCTION ?? false,
            serverKey: env.MIDTRANS_SERVER_KEY!,
            clientKey: env.MIDTRANS_CLIENT_KEY!,
        });
    }

    async createTransaction(params: CreateTransactionParams): Promise<TransactionResult> {
        const payload = {
            transaction_details: {
                order_id: params.orderId,
                gross_amount: params.amount,
            },
            customer_details: {
                first_name: params.customerName,
                email: params.customerEmail,
                phone: params.customerPhone || "",
            },
            item_details: params.itemDetails?.map((item) => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
            })),
        };

        const response = await this.snap.createTransaction(payload);
        return {
            token: response.token,
            redirectUrl: response.redirect_url,
            orderId: params.orderId,
        };
    }

    async verifyWebhook(payload: WebhookPayload): Promise<TransactionStatus> {
        // Verify by checking status directly from Midtrans API
        const status = await this.core.transaction.status(payload.order_id);
        return {
            orderId: status.order_id,
            transactionStatus: status.transaction_status,
            fraudStatus: status.fraud_status,
            paymentType: status.payment_type,
            grossAmount: status.gross_amount,
            settlementTime: status.settlement_time,
        };
    }

    async checkStatus(orderId: string): Promise<TransactionStatus> {
        const status = await this.core.transaction.status(orderId);
        return {
            orderId: status.order_id,
            transactionStatus: status.transaction_status,
            fraudStatus: status.fraud_status,
            paymentType: status.payment_type,
            grossAmount: status.gross_amount,
            settlementTime: status.settlement_time,
        };
    }
}

// ─── Xendit Provider ────────────────────────────────────────────────

class XenditProvider implements IPaymentProvider {
    private xenditClient: import("xendit-node").default;

    constructor() {
        const Xendit = require("xendit-node").default;
        this.xenditClient = new Xendit({
            secretKey: env.XENDIT_SECRET_KEY!,
        });
    }

    async createTransaction(params: CreateTransactionParams): Promise<TransactionResult> {
        const invoice = await (this.xenditClient as any).Invoice.createInvoice({
            data: {
                externalId: params.orderId,
                amount: params.amount,
                payerEmail: params.customerEmail,
                description: `Payment for order ${params.orderId}`,
                customer: {
                    givenNames: params.customerName,
                    email: params.customerEmail,
                    mobileNumber: params.customerPhone,
                },
                items: params.itemDetails?.map((item) => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                })),
            },
        });

        return {
            token: invoice.id,
            redirectUrl: invoice.invoiceUrl,
            orderId: params.orderId,
        };
    }

    async verifyWebhook(payload: WebhookPayload): Promise<TransactionStatus> {
        const callbackToken = env.XENDIT_WEBHOOK_TOKEN;
        if (callbackToken && payload.signature_key !== callbackToken) {
            throw new Error("Invalid webhook signature");
        }

        return {
            orderId: payload.order_id || (payload as any).external_id || "",
            transactionStatus: String(payload.transaction_status || (payload as any).status || "").toLowerCase(),
            paymentType: payload.payment_type || (payload as any).payment_method || undefined,
            grossAmount: String(payload.gross_amount || (payload as any).amount || "0"),
        };
    }

    async checkStatus(orderId: string): Promise<TransactionStatus> {
        const invoices = await (this.xenditClient as any).Invoice.getInvoices({
            externalId: orderId,
        });
        const invoice = Array.isArray(invoices) ? invoices[0] : invoices;

        return {
            orderId,
            transactionStatus: invoice?.status?.toLowerCase() || "unknown",
            grossAmount: String(invoice?.amount || "0"),
        };
    }
}

// ─── Payment Gateway Singleton ──────────────────────────────────────

const logger = pino({ name: "payment-gateway" });

class PaymentGateway {
    private static instance: PaymentGateway;
    private provider: IPaymentProvider | null = null;

    private constructor() { }

    static getInstance(): PaymentGateway {
        if (!PaymentGateway.instance) {
            PaymentGateway.instance = new PaymentGateway();
        }
        return PaymentGateway.instance;
    }

    private getProvider(): IPaymentProvider {
        if (!this.provider) {
            const providerType = env.PAYMENT_PROVIDER || "midtrans";
            logger.info(`Initializing payment provider: ${providerType}`);

            switch (providerType) {
                case "xendit":
                    if (!env.XENDIT_SECRET_KEY) {
                        throw new Error("XENDIT_SECRET_KEY is required for Xendit provider");
                    }
                    this.provider = new XenditProvider();
                    break;
                case "midtrans":
                default:
                    if (!env.MIDTRANS_SERVER_KEY) {
                        throw new Error("MIDTRANS_SERVER_KEY is required for Midtrans provider");
                    }
                    this.provider = new MidtransProvider();
                    break;
            }
        }
        return this.provider;
    }

    async createTransaction(params: CreateTransactionParams): Promise<TransactionResult> {
        try {
            logger.info({ orderId: params.orderId, amount: params.amount }, "Creating transaction");
            const result = await this.getProvider().createTransaction(params);
            logger.info({ orderId: params.orderId }, "Transaction created successfully");
            return result;
        } catch (error) {
            logger.error({ error, orderId: params.orderId }, "Failed to create transaction");
            throw error;
        }
    }

    async handleWebhook(payload: WebhookPayload): Promise<TransactionStatus> {
        try {
            logger.info({ orderId: payload.order_id }, "Processing payment webhook");
            const status = await this.getProvider().verifyWebhook(payload);
            logger.info({ orderId: status.orderId, status: status.transactionStatus }, "Webhook processed");
            return status;
        } catch (error) {
            logger.error({ error }, "Failed to process webhook");
            throw error;
        }
    }

    async checkStatus(orderId: string): Promise<TransactionStatus> {
        try {
            const status = await this.getProvider().checkStatus(orderId);
            logger.info({ orderId, status: status.transactionStatus }, "Status checked");
            return status;
        } catch (error) {
            logger.error({ error, orderId }, "Failed to check transaction status");
            throw error;
        }
    }
}

export const paymentGateway = PaymentGateway.getInstance();
