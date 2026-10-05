import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodType } from "zod";

/**
 * Returns an Express middleware that validates `req.body` against a zod
 * schema. On success the parsed (and coerced/trimmed) value replaces
 * `req.body`; on failure a 400 with field-level details is returned.
 */
export function validateBody(schema: ZodType) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    error: "Validation failed",
                    details: error.issues.map((issue) => ({
                        path: issue.path.join("."),
                        message: issue.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}
