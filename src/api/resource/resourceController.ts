import type { Request, RequestHandler, Response } from "express";

import type { TokenPayload } from "@/api/auth/authModel";
import { resourceService } from "@/api/resource/resourceService";

class ResourceController {
    /**
     * GET /resources — List all resources (paginated, filtered)
     */
    public list: RequestHandler = async (req: Request, res: Response) => {
        const { page = 1, limit = 10, status, category } = req.query;
        const user = req.user as TokenPayload;

        const serviceResponse = await resourceService.findAll(
            {
                page: Number(page),
                limit: Number(limit),
                status: status as string | undefined,
                category: category as string | undefined,
            },
            user.userId,
            user.role,
        );
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };

    /**
     * GET /resources/:id — Get a single resource
     */
    public getById: RequestHandler = async (req: Request, res: Response) => {
        const id = Number.parseInt(req.params.id as string, 10);
        const user = req.user as TokenPayload;

        const serviceResponse = await resourceService.findById(id, user.userId, user.role);
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };

    /**
     * POST /resources — Create a new resource
     */
    public create: RequestHandler = async (req: Request, res: Response) => {
        const user = req.user as TokenPayload;
        const serviceResponse = await resourceService.create(req.body, user.userId);
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };

    /**
     * PUT /resources/:id — Update a resource
     */
    public update: RequestHandler = async (req: Request, res: Response) => {
        const id = Number.parseInt(req.params.id as string, 10);
        const user = req.user as TokenPayload;

        const serviceResponse = await resourceService.update(id, req.body, user.userId, user.role);
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };

    /**
     * DELETE /resources/:id — Delete a resource
     */
    public remove: RequestHandler = async (req: Request, res: Response) => {
        const id = Number.parseInt(req.params.id as string, 10);
        const user = req.user as TokenPayload;

        const serviceResponse = await resourceService.delete(id, user.userId, user.role);
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };
}

export const resourceController = new ResourceController();
