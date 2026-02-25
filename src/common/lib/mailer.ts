import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import Handlebars from "handlebars";
import fs from "node:fs";
import path from "node:path";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface MailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
}

export interface TemplatedMailOptions {
    to: string | string[];
    subject: string;
    template: string; // template file name (without .hbs)
    context: Record<string, unknown>; // template variables
    attachments?: MailOptions["attachments"];
}

export interface MailResult {
    messageId: string;
    accepted: string[];
    rejected: string[];
}

// ─── Mailer Singleton ───────────────────────────────────────────────

const logger = pino({ name: "mailer" });

class Mailer {
    private static instance: Mailer;
    private transporter: Transporter | null = null;
    private templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();

    private constructor() { }

    static getInstance(): Mailer {
        if (!Mailer.instance) {
            Mailer.instance = new Mailer();
        }
        return Mailer.instance;
    }

    private getTransporter(): Transporter {
        if (!this.transporter) {
            if (!env.SMTP_USER || !env.SMTP_PASS) {
                throw new Error("SMTP_USER and SMTP_PASS are required for mailer");
            }

            logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, "Initializing SMTP transporter");
            this.transporter = nodemailer.createTransport({
                host: env.SMTP_HOST || "smtp-relay.brevo.com",
                port: env.SMTP_PORT || 587,
                secure: (env.SMTP_PORT || 587) === 465,
                auth: {
                    user: env.SMTP_USER,
                    pass: env.SMTP_PASS,
                },
            });
        }
        return this.transporter;
    }

    /**
     * Compile a Handlebars template from file, with caching.
     */
    private compileTemplate(templateName: string): Handlebars.TemplateDelegate {
        const cached = this.templateCache.get(templateName);
        if (cached) return cached;

        const templatePath = path.resolve(
            import.meta.dirname || __dirname,
            "templates",
            `${templateName}.hbs`,
        );

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Email template '${templateName}' not found at ${templatePath}`);
        }

        const source = fs.readFileSync(templatePath, "utf-8");
        const compiled = Handlebars.compile(source);
        this.templateCache.set(templateName, compiled);
        return compiled;
    }

    /**
     * Send a plain email.
     */
    async sendMail(options: MailOptions): Promise<MailResult> {
        try {
            const info = await this.getTransporter().sendMail({
                from: `"${env.MAIL_FROM_NAME || "StarterKit"}" <${env.MAIL_FROM_ADDRESS || "noreply@example.com"}>`,
                to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
                attachments: options.attachments,
            });

            logger.info({ messageId: info.messageId, to: options.to }, "Email sent successfully");
            return {
                messageId: info.messageId,
                accepted: info.accepted as string[],
                rejected: info.rejected as string[],
            };
        } catch (error) {
            logger.error({ error, to: options.to }, "Failed to send email");
            throw error;
        }
    }

    /**
     * Send an email using a Handlebars template.
     */
    async sendTemplatedMail(options: TemplatedMailOptions): Promise<MailResult> {
        const template = this.compileTemplate(options.template);
        const html = template(options.context);

        return this.sendMail({
            to: options.to,
            subject: options.subject,
            html,
            attachments: options.attachments,
        });
    }

    /**
     * Verify SMTP connection is working.
     */
    async verifyConnection(): Promise<boolean> {
        try {
            await this.getTransporter().verify();
            logger.info("SMTP connection verified successfully");
            return true;
        } catch (error) {
            logger.error({ error }, "SMTP connection verification failed");
            return false;
        }
    }
}

export const mailer = Mailer.getInstance();
