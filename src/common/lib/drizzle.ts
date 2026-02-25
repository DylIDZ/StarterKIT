import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../drizzle/schema";
import * as relations from "../../../drizzle/relations";

const globalForDrizzle = globalThis as unknown as { db: ReturnType<typeof drizzle> | undefined };

export const db =
    globalForDrizzle.db ??
    drizzle({
        connection: process.env.DATABASE_URL!,
        schema: { ...schema, ...relations },
        logger: process.env.NODE_ENV === "development",
    });

if (process.env.NODE_ENV !== "production") {
    globalForDrizzle.db = db;
}
