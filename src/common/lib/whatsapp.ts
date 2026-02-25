import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface SendMessageParams {
    to: string; // Phone number (e.g., "6281234567890")
    message: string;
}

export interface SendMediaParams extends SendMessageParams {
    mediaUrl: string;
    mediaType?: "image" | "video" | "audio" | "document";
    fileName?: string;
}

export interface BulkMessageParams {
    recipients: string[];
    message: string;
}

export interface WhatsAppResult {
    success: boolean;
    messageId?: string;
    detail?: string;
}

// ─── WhatsApp Client Singleton (Fonnte) ─────────────────────────────

const logger = pino({ name: "whatsapp" });

class WhatsAppClient {
    private static instance: WhatsAppClient;
    private apiToken: string | null = null;
    private apiUrl: string;

    private constructor() {
        this.apiUrl = env.FONNTE_API_URL || "https://api.fonnte.com";
    }

    static getInstance(): WhatsAppClient {
        if (!WhatsAppClient.instance) {
            WhatsAppClient.instance = new WhatsAppClient();
        }
        return WhatsAppClient.instance;
    }

    private getToken(): string {
        if (!this.apiToken) {
            if (!env.FONNTE_API_TOKEN) {
                throw new Error("FONNTE_API_TOKEN is required for WhatsApp integration");
            }
            this.apiToken = env.FONNTE_API_TOKEN;
        }
        return this.apiToken;
    }

    /**
     * Send a text message.
     */
    async sendMessage(params: SendMessageParams): Promise<WhatsAppResult> {
        try {
            const response = await fetch(`${this.apiUrl}/send`, {
                method: "POST",
                headers: {
                    Authorization: this.getToken(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    target: params.to,
                    message: params.message,
                }),
            });

            const data = await response.json() as Record<string, unknown>;

            if (!response.ok) {
                logger.error({ status: response.status, data }, "WhatsApp send failed");
                return { success: false, detail: String(data.detail || data.reason || "Unknown error") };
            }

            logger.info({ to: params.to }, "WhatsApp message sent");
            return {
                success: true,
                messageId: String(data.id || ""),
                detail: String(data.detail || "sent"),
            };
        } catch (error) {
            logger.error({ error, to: params.to }, "WhatsApp send error");
            throw error;
        }
    }

    /**
     * Send a message with media attachment.
     */
    async sendMediaMessage(params: SendMediaParams): Promise<WhatsAppResult> {
        try {
            const response = await fetch(`${this.apiUrl}/send`, {
                method: "POST",
                headers: {
                    Authorization: this.getToken(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    target: params.to,
                    message: params.message,
                    url: params.mediaUrl,
                    filename: params.fileName,
                }),
            });

            const data = await response.json() as Record<string, unknown>;

            if (!response.ok) {
                logger.error({ status: response.status, data }, "WhatsApp media send failed");
                return { success: false, detail: String(data.detail || "Unknown error") };
            }

            logger.info({ to: params.to, mediaType: params.mediaType }, "WhatsApp media message sent");
            return {
                success: true,
                messageId: String(data.id || ""),
                detail: String(data.detail || "sent"),
            };
        } catch (error) {
            logger.error({ error, to: params.to }, "WhatsApp media send error");
            throw error;
        }
    }

    /**
     * Send bulk text messages to multiple recipients.
     */
    async sendBulkMessage(params: BulkMessageParams): Promise<WhatsAppResult> {
        try {
            const targets = params.recipients.join(",");

            const response = await fetch(`${this.apiUrl}/send`, {
                method: "POST",
                headers: {
                    Authorization: this.getToken(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    target: targets,
                    message: params.message,
                }),
            });

            const data = await response.json() as Record<string, unknown>;

            if (!response.ok) {
                logger.error({ status: response.status, data }, "WhatsApp bulk send failed");
                return { success: false, detail: String(data.detail || "Unknown error") };
            }

            logger.info({ recipientCount: params.recipients.length }, "WhatsApp bulk message sent");
            return {
                success: true,
                detail: String(data.detail || "sent"),
            };
        } catch (error) {
            logger.error({ error }, "WhatsApp bulk send error");
            throw error;
        }
    }
}

export const whatsAppClient = WhatsAppClient.getInstance();
