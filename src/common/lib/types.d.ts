// Type declarations for packages without built-in types

declare module "midtrans-client" {
    export class Snap {
        constructor(options: { isProduction: boolean; serverKey: string; clientKey: string });
        createTransaction(params: Record<string, unknown>): Promise<{
            token: string;
            redirect_url: string;
        }>;
    }

    export class CoreApi {
        constructor(options: { isProduction: boolean; serverKey: string; clientKey: string });
        transaction: {
            status(orderId: string): Promise<{
                order_id: string;
                transaction_status: string;
                fraud_status?: string;
                payment_type?: string;
                gross_amount: string;
                settlement_time?: string;
            }>;
        };
    }
}

declare module "speakeasy" {
    interface GenerateSecretOptions {
        name?: string;
        issuer?: string;
        length?: number;
    }

    interface GeneratedSecret {
        ascii: string;
        hex: string;
        base32: string;
        otpauth_url?: string;
    }

    interface TotpVerifyOptions {
        secret: string;
        encoding: "base32" | "hex" | "ascii";
        token: string;
        window?: number;
    }

    interface OtpauthURLOptions {
        secret: string;
        encoding: "base32" | "hex" | "ascii";
        label: string;
        issuer?: string;
    }

    export function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;
    export function otpauthURL(options: OtpauthURLOptions): string;

    export namespace totp {
        function verify(options: TotpVerifyOptions): boolean;
    }
}
