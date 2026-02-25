import type { Request, RequestHandler, Response } from "express";

import type { TokenPayload } from "@/api/auth/authModel";
import { demoService } from "@/api/demo/demoService";

class DemoController {
    /**
     * POST /api/demo/purchase — Create a new purchase (authenticated)
     */
    public createPurchase: RequestHandler = async (req: Request, res: Response) => {
        const user = req.user as TokenPayload;

        const serviceResponse = await demoService.createPurchase({
            ...req.body,
            customerName: req.body.customerName || user.email,
            customerEmail: req.body.customerEmail || user.email,
        });
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };

    /**
     * POST /api/demo/webhook/payment — Handle payment webhook (public)
     */
    public handleWebhook: RequestHandler = async (req: Request, res: Response) => {
        const serviceResponse = await demoService.handlePaymentWebhook(req.body);
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };

    /**
     * GET /api/demo/purchase/:orderId/status — Check payment status (authenticated)
     */
    public checkStatus: RequestHandler = async (req: Request, res: Response) => {
        const orderId = req.params.orderId as string;
        const serviceResponse = await demoService.checkPaymentStatus(orderId);
        res.status(serviceResponse.statusCode).send(serviceResponse);
    };
}

export const demoController = new DemoController();
