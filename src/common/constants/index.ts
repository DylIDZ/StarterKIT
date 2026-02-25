/** Default pagination values */
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
} as const;

/** User roles */
export const ROLES = {
    ADMIN: "ADMIN",
    USER: "USER",
    MODERATOR: "MODERATOR",
} as const;

/** Resource statuses */
export const RESOURCE_STATUS = {
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
    ARCHIVED: "ARCHIVED",
} as const;

/** Cookie configuration */
export const COOKIE_CONFIG = {
    REFRESH_TOKEN_NAME: "refreshToken",
    REFRESH_TOKEN_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
} as const;
