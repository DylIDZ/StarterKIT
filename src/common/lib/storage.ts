import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface UploadResult {
    publicUrl: string;
    filePath: string;
    fileName: string;
    mimeType: string;
    size: number;
}

export interface StorageDeleteResult {
    success: boolean;
    filePath: string;
}

// ─── Cloud Storage Singleton (Supabase Storage) ─────────────────────

const logger = pino({ name: "cloud-storage" });

class CloudStorage {
    private static instance: CloudStorage;
    private client: SupabaseClient | null = null;
    private bucket: string;

    private constructor() {
        this.bucket = env.SUPABASE_STORAGE_BUCKET || "uploads";
    }

    static getInstance(): CloudStorage {
        if (!CloudStorage.instance) {
            CloudStorage.instance = new CloudStorage();
        }
        return CloudStorage.instance;
    }

    private getClient(): SupabaseClient {
        if (!this.client) {
            if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
                throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required for cloud storage");
            }
            logger.info("Initializing Supabase Storage client");
            this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
        }
        return this.client;
    }

    /**
     * Upload a file buffer to Supabase Storage.
     */
    async upload(
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string,
        folder = "general",
    ): Promise<UploadResult> {
        const ext = path.extname(fileName);
        const uniqueName = `${crypto.randomUUID()}${ext}`;
        const filePath = `${folder}/${uniqueName}`;

        const { error } = await this.getClient().storage
            .from(this.bucket)
            .upload(filePath, fileBuffer, {
                contentType: mimeType,
                upsert: false,
            });

        if (error) {
            logger.error({ error, filePath }, "Failed to upload file");
            throw new Error(`Upload failed: ${error.message}`);
        }

        const { data: urlData } = this.getClient().storage
            .from(this.bucket)
            .getPublicUrl(filePath);

        logger.info({ filePath, fileName }, "File uploaded successfully");
        return {
            publicUrl: urlData.publicUrl,
            filePath,
            fileName: uniqueName,
            mimeType,
            size: fileBuffer.length,
        };
    }

    /**
     * Upload from a Multer file (Express request).
     */
    async uploadFromMulter(
        file: Express.Multer.File,
        folder = "general",
    ): Promise<UploadResult> {
        return this.upload(file.buffer, file.originalname, file.mimetype, folder);
    }

    /**
     * Delete a file from storage.
     */
    async delete(filePath: string): Promise<StorageDeleteResult> {
        const { error } = await this.getClient().storage
            .from(this.bucket)
            .remove([filePath]);

        if (error) {
            logger.error({ error, filePath }, "Failed to delete file");
            throw new Error(`Delete failed: ${error.message}`);
        }

        logger.info({ filePath }, "File deleted successfully");
        return { success: true, filePath };
    }

    /**
     * Get the public URL for a stored file.
     */
    getPublicUrl(filePath: string): string {
        const { data } = this.getClient().storage
            .from(this.bucket)
            .getPublicUrl(filePath);

        return data.publicUrl;
    }
}

export const cloudStorage = CloudStorage.getInstance();

// ─── Multer Middleware Factory ──────────────────────────────────────

interface UploadOptions {
    maxFileSize?: number; // bytes, default 5MB
    allowedMimeTypes?: string[];
    maxFiles?: number;
}

const DEFAULT_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
];

/**
 * Creates a Multer middleware configured for memory storage.
 * Files are stored in memory buffer for upload to Supabase Storage.
 */
export function createUploadMiddleware(options: UploadOptions = {}) {
    const {
        maxFileSize = 5 * 1024 * 1024, // 5MB
        allowedMimeTypes = DEFAULT_MIME_TYPES,
        maxFiles = 5,
    } = options;

    const storage = multer.memoryStorage();

    return multer({
        storage,
        limits: {
            fileSize: maxFileSize,
            files: maxFiles,
        },
        fileFilter: (_req, file, cb) => {
            if (allowedMimeTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(`File type '${file.mimetype}' is not allowed. Accepted: ${allowedMimeTypes.join(", ")}`));
            }
        },
    });
}
