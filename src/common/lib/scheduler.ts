import cron, { type ScheduledTask } from "node-cron";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

// ─── Types ──────────────────────────────────────────────────────────

export interface ScheduledJob {
    name: string;
    expression: string;
    description?: string;
    isRunning: boolean;
}

// ─── Scheduler Singleton ────────────────────────────────────────────

const logger = pino({ name: "scheduler" });

class Scheduler {
    private static instance: Scheduler;
    private jobs: Map<string, { task: ScheduledTask; expression: string; description?: string }> = new Map();

    private constructor() { }

    static getInstance(): Scheduler {
        if (!Scheduler.instance) {
            Scheduler.instance = new Scheduler();
        }
        return Scheduler.instance;
    }

    /**
     * Register a new cron job.
     *
     * @param name - Unique name for the job
     * @param expression - Cron expression (e.g., "0 0 * * *" for midnight daily)
     * @param handler - Async function to execute
     * @param description - Optional description
     *
     * Common cron patterns:
     * - "* * * * *"       → Every minute
     * - "0 * * * *"       → Every hour
     * - "0 0 * * *"       → Every day at midnight
     * - "0 0 * * 1"       → Every Monday at midnight
     * - "0 0 1 * *"       → First day of every month
     * - "0 9,18 * * 1-5"  → 9am & 6pm on weekdays
     */
    register(
        name: string,
        expression: string,
        handler: () => Promise<void> | void,
        description?: string,
    ): void {
        if (!cron.validate(expression)) {
            throw new Error(`Invalid cron expression: ${expression}`);
        }

        // Remove existing job if re-registering
        if (this.jobs.has(name)) {
            this.unregister(name);
        }

        const isEnabled = env.SCHEDULER_ENABLED ?? true;

        const task = cron.schedule(
            expression,
            async () => {
                logger.info({ job: name }, "Cron job started");
                const startTime = Date.now();

                try {
                    await handler();
                    const duration = Date.now() - startTime;
                    logger.info({ job: name, durationMs: duration }, "Cron job completed");
                } catch (error) {
                    logger.error({ error, job: name }, "Cron job failed");
                }
            },
            {
                timezone: "Asia/Jakarta",
            },
        );

        if (!isEnabled) {
            task.stop();
        }

        this.jobs.set(name, { task, expression, description });
        logger.info({ job: name, expression, enabled: isEnabled }, "Cron job registered");
    }

    /**
     * Unregister (stop and remove) a cron job.
     */
    unregister(name: string): boolean {
        const job = this.jobs.get(name);
        if (!job) return false;

        job.task.stop();
        this.jobs.delete(name);
        logger.info({ job: name }, "Cron job unregistered");
        return true;
    }

    /**
     * Start a specific job.
     */
    start(name: string): boolean {
        const job = this.jobs.get(name);
        if (!job) return false;

        job.task.start();
        logger.info({ job: name }, "Cron job started");
        return true;
    }

    /**
     * Stop a specific job (without removing).
     */
    stop(name: string): boolean {
        const job = this.jobs.get(name);
        if (!job) return false;

        job.task.stop();
        logger.info({ job: name }, "Cron job stopped");
        return true;
    }

    /**
     * List all registered jobs.
     */
    listJobs(): ScheduledJob[] {
        return Array.from(this.jobs.entries()).map(([name, job]) => ({
            name,
            expression: job.expression,
            description: job.description,
            isRunning: true, // node-cron doesn't expose running state
        }));
    }

    /**
     * Stop all jobs and clear the registry.
     */
    stopAll(): void {
        for (const [name, job] of this.jobs) {
            job.task.stop();
            logger.info({ job: name }, "Cron job stopped");
        }
        this.jobs.clear();
        logger.info("All cron jobs stopped");
    }
}

export const scheduler = Scheduler.getInstance();
