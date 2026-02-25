import { integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, index, varchar } from "drizzle-orm/pg-core";

// ─── Enums ─────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("UserRole", ["ADMIN", "USER", "MODERATOR"]);
export const resourceStatusEnum = pgEnum("ResourceStatus", ["DRAFT", "PUBLISHED", "ARCHIVED"]);

// ─── Users ─────────────────────────────────────────────────────────

export const users = pgTable(
    "users",
    {
        id: serial("id").primaryKey(),
        email: varchar("email", { length: 255 }).notNull().unique(),
        passwordHash: text("passwordHash").notNull(),
        refreshTokenHash: text("refreshTokenHash"),
        role: userRoleEnum("role").default("USER").notNull(),
        createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
    },
    (table) => [index("users_email_idx").on(table.email)],
);

// ─── Profiles (1:1 with Users) ─────────────────────────────────────

export const profiles = pgTable("profiles", {
    id: serial("id").primaryKey(),
    firstName: varchar("firstName", { length: 100 }),
    lastName: varchar("lastName", { length: 100 }),
    bio: text("bio"),
    avatarUrl: text("avatarUrl"),
    phone: varchar("phone", { length: 20 }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
    userId: integer("userId")
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: "cascade" }),
});

// ─── Permissions (RBAC) ────────────────────────────────────────────

export const permissions = pgTable(
    "permissions",
    {
        id: serial("id").primaryKey(),
        action: varchar("action", { length: 50 }).notNull(),
        subject: varchar("subject", { length: 50 }).notNull(),
    },
    (table) => [uniqueIndex("permissions_action_subject_idx").on(table.action, table.subject)],
);

// ─── Role Permissions (junction) ───────────────────────────────────

export const rolePermissions = pgTable(
    "role_permissions",
    {
        id: serial("id").primaryKey(),
        role: userRoleEnum("role").notNull(),
        permissionId: integer("permissionId")
            .notNull()
            .references(() => permissions.id, { onDelete: "cascade" }),
    },
    (table) => [uniqueIndex("role_permissions_role_perm_idx").on(table.role, table.permissionId)],
);

// ─── Resources (Generic CRUD Boilerplate) ──────────────────────────

export const resources = pgTable(
    "resources",
    {
        id: serial("id").primaryKey(),
        title: varchar("title", { length: 255 }).notNull(),
        description: text("description"),
        content: text("content"),
        status: resourceStatusEnum("status").default("DRAFT").notNull(),
        category: varchar("category", { length: 100 }),
        tags: text("tags").array().default([]),
        metadata: jsonb("metadata"),
        createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
        userId: integer("userId")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
    },
    (table) => [
        index("resources_userId_idx").on(table.userId),
        index("resources_status_idx").on(table.status),
        index("resources_category_idx").on(table.category),
    ],
);
