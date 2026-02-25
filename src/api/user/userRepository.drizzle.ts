/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  DRIZZLE ORM ALTERNATIVE                                 ║
 * ║  Same API as userRepository.ts — swap import to switch.  ║
 * ║  Service & Controller remain unchanged.                  ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { eq } from "drizzle-orm";

import type { UserWithSecrets } from "@/api/user/userModel";
import { db } from "@/common/lib/drizzle";
import { logger } from "@/server";

import { users } from "../../../drizzle/schema";

export class UserRepository {
    async findAllAsync(): Promise<UserWithSecrets[]> {
        try {
            const result = await db.select().from(users);
            return result as UserWithSecrets[];
        } catch (error) {
            logger.error({ error }, "Database error in UserRepository.findAllAsync");
            throw error;
        }
    }

    async findByIdAsync(id: number): Promise<UserWithSecrets | null> {
        try {
            const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
            return (user as UserWithSecrets) || null;
        } catch (error) {
            logger.error({ error }, "Database error in UserRepository.findByIdAsync");
            throw error;
        }
    }

    async findByEmailAsync(email: string): Promise<UserWithSecrets | null> {
        try {
            const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
            return (user as UserWithSecrets) || null;
        } catch (error) {
            logger.error({ error }, "Database error in UserRepository.findByEmailAsync");
            throw error;
        }
    }

    async createUserAsync(userData: UserWithSecrets): Promise<UserWithSecrets> {
        try {
            const [newUser] = await db.insert(users).values(userData as any).returning();
            return newUser as UserWithSecrets;
        } catch (error) {
            logger.error({ error }, "Database error in UserRepository.createUserAsync");
            throw error;
        }
    }

    async updateUserAsync(id: number, userData: Partial<UserWithSecrets>): Promise<UserWithSecrets> {
        try {
            const [updatedUser] = await db.update(users).set(userData as any).where(eq(users.id, id)).returning();
            return updatedUser as UserWithSecrets;
        } catch (error) {
            logger.error({ error }, "Database error in UserRepository.updateUserAsync");
            throw error;
        }
    }

    async deleteUserAsync(id: number): Promise<void> {
        try {
            await db.delete(users).where(eq(users.id, id));
        } catch (error) {
            logger.error({ error }, "Database error in UserRepository.deleteUserAsync");
            throw error;
        }
    }
}
