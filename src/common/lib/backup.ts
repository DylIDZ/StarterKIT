import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";
import { cloudStorage } from "@/common/lib/storage";

const execFileAsync = promisify(execFile);

// ─── Types ──────────────────────────────────────────────────────────

export interface BackupResult {
    filePath: string;
    fileName: string;
    size: number;
    createdAt: Date;
}

export interface BackupUploadResult extends BackupResult {
    publicUrl: string;
    storagePath: string;
}

// ─── Database Backup ────────────────────────────────────────────────

const logger = pino({ name: "db-backup" });

export class DatabaseBackup {
    /**
     * Create a PostgreSQL dump file.
     */
    static async createBackup(outputDir?: string): Promise<BackupResult> {
        const dbUrl = new URL(env.DATABASE_URL);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `backup_${dbUrl.pathname.slice(1)}_${timestamp}.sql`;
        const dir = outputDir || path.join(os.tmpdir(), "db-backups");

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, fileName);

        const pgDumpArgs = [
            "-h", dbUrl.hostname,
            "-p", dbUrl.port || "5432",
            "-U", dbUrl.username,
            "-d", dbUrl.pathname.slice(1),
            "--no-password",
            "-f", filePath,
            "--format=plain",
            "--clean",
            "--if-exists",
        ];

        try {
            logger.info({ database: dbUrl.pathname.slice(1) }, "Starting database backup");

            await execFileAsync("pg_dump", pgDumpArgs, {
                env: {
                    ...process.env,
                    PGPASSWORD: dbUrl.password,
                },
                timeout: 300000, // 5 minutes max
            });

            const stats = fs.statSync(filePath);

            logger.info(
                { fileName, size: stats.size },
                "Database backup completed",
            );

            return {
                filePath,
                fileName,
                size: stats.size,
                createdAt: new Date(),
            };
        } catch (error) {
            logger.error({ error }, "Database backup failed");
            throw new Error(`Database backup failed: ${(error as Error).message}`);
        }
    }

    /**
     * Upload a backup file to cloud storage (Supabase).
     */
    static async uploadToStorage(backupResult: BackupResult): Promise<BackupUploadResult> {
        try {
            const buffer = fs.readFileSync(backupResult.filePath);

            const uploadResult = await cloudStorage.upload(
                buffer,
                backupResult.fileName,
                "application/sql",
                "backups",
            );

            logger.info(
                { fileName: backupResult.fileName, url: uploadResult.publicUrl },
                "Backup uploaded to storage",
            );

            // Clean up local file
            fs.unlinkSync(backupResult.filePath);

            return {
                ...backupResult,
                publicUrl: uploadResult.publicUrl,
                storagePath: uploadResult.filePath,
            };
        } catch (error) {
            logger.error({ error }, "Failed to upload backup to storage");
            throw error;
        }
    }

    /**
     * Create a backup and upload it to cloud storage in one step.
     */
    static async createAndUpload(): Promise<BackupUploadResult> {
        const backup = await DatabaseBackup.createBackup();
        return DatabaseBackup.uploadToStorage(backup);
    }
}
