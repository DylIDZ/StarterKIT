import type { Request, RequestHandler, Response } from "express";

import type { TokenPayload } from "@/api/auth/authModel";
import { AuthService } from "@/api/auth/authService";
import { UserService } from "@/api/user/userService";
import { COOKIE_CONFIG } from "@/common/constants";

class AuthController {
    private authService: AuthService;
    private userService: UserService;

    constructor() {
        this.authService = new AuthService();
        this.userService = new UserService();
    }

    /**
     * Set refresh token as HttpOnly secure cookie.
     * The refresh token is NEVER exposed in the response body.
     */
    private setRefreshTokenCookie(res: Response, refreshToken: string): void {
        res.cookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME, refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: COOKIE_CONFIG.REFRESH_TOKEN_MAX_AGE,
            path: "/",
        });
    }

    /**
     * Clear refresh token cookie on logout.
     */
    private clearRefreshTokenCookie(res: Response): void {
        res.clearCookie(COOKIE_CONFIG.REFRESH_TOKEN_NAME, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        });
    }

    /**
     * POST /auth/register — Register a new user
     */
    public register: RequestHandler = async (req: Request, res: Response) => {
        const { email, password, name } = req.body;
        const serviceResponse = await this.authService.registerAsync(email, password, name);
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };

    /**
     * POST /auth/login — Login and receive access token + HttpOnly refresh cookie
     */
    public login: RequestHandler = async (req: Request, res: Response) => {
        const { email, password } = req.body;
        const serviceResponse = await this.authService.loginAsync(email, password);

        if (serviceResponse.success && serviceResponse.data) {
            // Store refresh token in HttpOnly cookie (never in response body)
            this.setRefreshTokenCookie(res, serviceResponse.data.refreshToken);

            const responseData = {
                success: serviceResponse.success,
                message: serviceResponse.message,
                data: {
                    user: serviceResponse.data.user,
                    accessToken: serviceResponse.data.accessToken,
                },
                statusCode: serviceResponse.statusCode,
            };
            res.status(serviceResponse.statusCode).send(responseData);
        } else {
            res.status(serviceResponse.statusCode).send(serviceResponse);
        }
    };

    /**
     * POST /auth/refresh — Refresh access token using HttpOnly cookie
     */
    public refresh: RequestHandler = async (req: Request, res: Response) => {
        const refreshToken = req.cookies[COOKIE_CONFIG.REFRESH_TOKEN_NAME];

        if (!refreshToken) {
            res.status(401).send({
                success: false,
                message: "Refresh token not found",
                data: null,
                statusCode: 401,
            });
            return;
        }

        const serviceResponse = await this.authService.refreshTokenAsync(refreshToken);

        if (serviceResponse.success && serviceResponse.data) {
            // Set rotated refresh token in HttpOnly cookie
            this.setRefreshTokenCookie(res, serviceResponse.data.refreshToken);

            const responseData = {
                success: serviceResponse.success,
                message: serviceResponse.message,
                data: {
                    accessToken: serviceResponse.data.accessToken,
                },
                statusCode: serviceResponse.statusCode,
            };
            res.status(serviceResponse.statusCode).send(responseData);
        } else {
            res.status(serviceResponse.statusCode).send(serviceResponse);
        }
    };

    /**
     * POST /auth/logout — Clear session and HttpOnly cookie
     */
    public logout: RequestHandler = async (req: Request, res: Response) => {
        const userId = (req.user as TokenPayload).userId;
        const serviceResponse = await this.authService.logoutAsync(userId);

        if (serviceResponse.success) {
            this.clearRefreshTokenCookie(res);
        }

        res.status(serviceResponse.statusCode).send(serviceResponse);
    };

    /**
     * GET /auth/profile — Get current authenticated user
     */
    public me: RequestHandler = async (req: Request, res: Response) => {
        const userId = (req.user as TokenPayload).userId;
        const serviceResponse = await this.authService.getCurrentUserAsync(userId);
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };

    /**
     * PUT /auth/profile — Update own profile
     */
    public updateProfile: RequestHandler = async (req: Request, res: Response) => {
        const userData = req.body;
        const userId = (req.user as TokenPayload).userId;
        const serviceResponse = await this.userService.updateUser(userId, userData);
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };
}

export const authController = new AuthController();
