import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface JobOptions {
    delay?: number; // ms
    attempts?: number;
    backoff?: { type: "fixed" | "exponential"; delay: number };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
    priority?: number;
}

export type JobHandler<T = unknown, R = unknown> = (job: Job<T>) => Promise<R>;

// ─── Queue Manager Singleton ────────────────────────────────────────

const logger = pino({ name: "queue" });

class QueueManager {
    private static instance: QueueManager;
    private queues: Map<string, Queue> = new Map();
    private workers: Map<string, Worker> = new Map();
    private connection: ConnectionOptions;

    private constructor() {
        const redisUrl = env.REDIS_URL || "redis://localhost:6379";
        const url = new URL(redisUrl);
        this.connection = {
            host: url.hostname,
            port: Number(url.port) || 6379,
            password: url.password || undefined,
        };
    }

    static getInstance(): QueueManager {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager();
        }
        return QueueManager.instance;
    }

    /**
     * Get or create a named queue.
     */
    getQueue<T = unknown>(name: string): Queue<T> {
        if (!this.queues.has(name)) {
            const queue = new Queue<T>(name, { connection: this.connection });
            this.queues.set(name, queue as Queue);
            logger.info({ queue: name }, "Queue created");
        }
        return this.queues.get(name) as Queue<T>;
    }

    /**
     * Add a job to a named queue.
     */
    async addJob<T = unknown>(
        queueName: string,
        jobName: string,
        data: T,
        options: JobOptions = {},
    ): Promise<Job<T>> {
        const queue = this.getQueue<T>(queueName);
        const job = await queue.add(jobName as any, data as any, {
            attempts: options.attempts || 3,
            backoff: options.backoff || { type: "exponential", delay: 1000 },
            removeOnComplete: options.removeOnComplete ?? 100,
            removeOnFail: options.removeOnFail ?? 500,
            delay: options.delay,
            priority: options.priority,
        });

        logger.info({ queue: queueName, job: jobName, id: job.id }, "Job added to queue");
        return job as unknown as Job<T>;
    }

    /**
     * Register a worker to process jobs from a queue.
     */
    registerWorker<T = unknown, R = unknown>(
        queueName: string,
        handler: JobHandler<T, R>,
        concurrency = 1,
    ): Worker<T, R> {
        if (this.workers.has(queueName)) {
            logger.warn({ queue: queueName }, "Worker already registered, replacing");
            this.workers.get(queueName)?.close();
        }

        const worker = new Worker<T, R>(
            queueName,
            async (job: Job<T>) => {
                logger.info({ queue: queueName, job: job.name, id: job.id }, "Processing job");
                return handler(job);
            },
            {
                connection: this.connection,
                concurrency,
            },
        );

        worker.on("completed", (job: Job<T>) => {
            logger.info({ queue: queueName, job: job.name, id: job.id }, "Job completed");
        });

        worker.on("failed", (job: Job<T> | undefined, err: Error) => {
            logger.error(
                { queue: queueName, job: job?.name, id: job?.id, error: err.message },
                "Job failed",
            );
        });

        this.workers.set(queueName, worker as Worker);
        logger.info({ queue: queueName, concurrency }, "Worker registered");
        return worker;
    }

    /**
     * Close all queues and workers gracefully.
     */
    async shutdown(): Promise<void> {
        logger.info("Shutting down queue manager...");

        for (const [name, worker] of this.workers) {
            await worker.close();
            logger.info({ worker: name }, "Worker closed");
        }

        for (const [name, queue] of this.queues) {
            await queue.close();
            logger.info({ queue: name }, "Queue closed");
        }

        this.workers.clear();
        this.queues.clear();
        logger.info("Queue manager shut down");
    }
}

export const queueManager = QueueManager.getInstance();

// ─── Pre-built Queue Names ──────────────────────────────────────────

export const QUEUE_NAMES = {
    EMAIL: "email-queue",
    NOTIFICATION: "notification-queue",
    PDF_GENERATION: "pdf-generation-queue",
    DATA_EXPORT: "data-export-queue",
} as const;
