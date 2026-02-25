import { relations } from "drizzle-orm";
import { permissions, profiles, resources, rolePermissions, users } from "./schema";

// ─── User Relations ────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
    profile: one(profiles, {
        fields: [users.id],
        references: [profiles.userId],
    }),
    resources: many(resources),
}));

// ─── Profile Relations ─────────────────────────────────────────────

export const profilesRelations = relations(profiles, ({ one }) => ({
    user: one(users, {
        fields: [profiles.userId],
        references: [users.id],
    }),
}));

// ─── Permission Relations ──────────────────────────────────────────

export const permissionsRelations = relations(permissions, ({ many }) => ({
    roles: many(rolePermissions),
}));

// ─── RolePermission Relations ──────────────────────────────────────

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
    permission: one(permissions, {
        fields: [rolePermissions.permissionId],
        references: [permissions.id],
    }),
}));

// ─── Resource Relations ────────────────────────────────────────────

export const resourcesRelations = relations(resources, ({ one }) => ({
    user: one(users, {
        fields: [resources.userId],
        references: [users.id],
    }),
}));
