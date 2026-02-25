import type { ErrorRequestHandler, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

const unexpectedRequest: RequestHandler = (_req, res) => {
    res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Resource not found",
        data: null,
        statusCode: StatusCodes.NOT_FOUND,
    });
};

const addErrorToRequestLog: ErrorRequestHandler = (err, _req, res, next) => {
    res.locals.err = err;
    next(err);
};

export default (): [RequestHandler, ErrorRequestHandler] => [unexpectedRequest, addErrorToRequestLog];
