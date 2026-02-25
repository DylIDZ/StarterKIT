import { z } from "zod";

export const commonValidations = {
    /** Coerce string param to positive integer (for route params like /:id) */
    id: z.coerce.number().int().positive("ID must be a positive integer"),

    /** Pagination query params */
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
};

/** Reusable pagination query schema */
export const PaginationQuerySchema = z.object({
    page: commonValidations.page,
    limit: commonValidations.limit,
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Pagination metadata for list responses */
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
