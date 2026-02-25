import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "node:crypto";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface TwoFactorSecret {
    secret: string; // Base32-encoded secret
    otpauthUrl: string; // URL for QR code generation
    qrCodeDataUrl: string; // Data URL for inline QR image
}

export interface VerifyResult {
    valid: boolean;
    delta?: number; // Time step difference
}

// ─── Two-Factor Auth ────────────────────────────────────────────────

const logger = pino({ name: "2fa" });

export class TwoFactorAuth {
    /**
     * Generate a new TOTP secret + QR code for a user.
     */
    static async generateSecret(userEmail: string): Promise<TwoFactorSecret> {
        const appName = env.TWO_FACTOR_APP_NAME || "StarterKitApp";

        const secret = speakeasy.generateSecret({
            name: `${appName}:${userEmail}`,
            issuer: appName,
            length: 20,
        });

        if (!secret.base32 || !secret.otpauth_url) {
            throw new Error("Failed to generate 2FA secret");
        }

        const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

        logger.info({ email: userEmail }, "2FA secret generated");

        return {
            secret: secret.base32,
            otpauthUrl: secret.otpauth_url,
            qrCodeDataUrl,
        };
    }

    /**
     * Generate just the QR code data URL from an existing secret.
     */
    static async generateQrCodeUrl(
        secret: string,
        userEmail: string,
    ): Promise<string> {
        const appName = env.TWO_FACTOR_APP_NAME || "StarterKitApp";
        const otpauthUrl = speakeasy.otpauthURL({
            secret,
            encoding: "base32",
            label: `${appName}:${userEmail}`,
            issuer: appName,
        });

        return QRCode.toDataURL(otpauthUrl);
    }

    /**
     * Verify a TOTP token against the stored secret.
     */
    static verifyToken(token: string, secret: string): VerifyResult {
        const result = speakeasy.totp.verify({
            secret,
            encoding: "base32",
            token,
            window: 2, // Allow 2-step drift (±60 seconds)
        });

        logger.info({ valid: result }, "2FA token verification");
        return { valid: result };
    }

    /**
     * Generate backup codes (one-time use recovery codes).
     */
    static generateBackupCodes(count = 8): string[] {
        const codes: string[] = [];
        for (let i = 0; i < count; i++) {
            const code = crypto.randomBytes(4).toString("hex").toUpperCase();
            // Format as XXXX-XXXX for readability
            codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
        }

        logger.info({ count }, "Backup codes generated");
        return codes;
    }

    /**
     * Verify a backup code against a list of valid codes.
     * Returns the remaining valid codes (excluding the used one).
     */
    static verifyBackupCode(
        code: string,
        validCodes: string[],
    ): { valid: boolean; remainingCodes: string[] } {
        const normalizedCode = code.toUpperCase().replace(/\s/g, "");
        const index = validCodes.findIndex(
            (c) => c.replace(/\s/g, "").toUpperCase() === normalizedCode,
        );

        if (index === -1) {
            return { valid: false, remainingCodes: validCodes };
        }

        const remainingCodes = [...validCodes];
        remainingCodes.splice(index, 1);

        logger.info("Backup code used successfully");
        return { valid: true, remainingCodes };
    }
}
