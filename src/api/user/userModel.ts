import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { commonValidations } from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

// ─── Public User Schema (without sensitive fields) ─────────────────

export const UserSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    role: z.enum(["ADMIN", "USER", "MODERATOR"]),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

// ─── Internal User Schema (includes sensitive auth fields) ─────────

export const UserWithSecretsSchema = UserSchema.extend({
    passwordHash: z.string(),
    refreshTokenHash: z.string().nullable(),
});

export type UserWithSecrets = z.infer<typeof UserWithSecretsSchema>;

// ─── Request Validation Schemas ────────────────────────────────────

export const GetUserSchema = z.object({
    params: z.object({ id: commonValidations.id }),
});

export const CreateUserSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        role: z.enum(["ADMIN", "USER", "MODERATOR"]),
        password: z.string().min(8, "Password must be at least 8 characters"),
    }),
});

export const UpdateUserSchema = z.object({
    params: z.object({ id: commonValidations.id }),
    body: z.object({
        email: z.string().email("Invalid email address").optional(),
        role: z.enum(["ADMIN", "USER", "MODERATOR"]).optional(),
        password: z.string().min(8, "Password must be at least 8 characters").optional(),
    }),
});

export const UpdateProfileSchema = z.object({
    body: UpdateUserSchema.shape.body,
});

export type GetUserRequest = z.infer<typeof GetUserSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
