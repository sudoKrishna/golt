export class HttpError extends Error {
    public readonly status: number;
    public readonly code?: string;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        this.code = code;
    }
}

export function notFound(message = "not found"): HttpError {
    return new HttpError(404, message, "NOT_FOUND");
}

export function unauthorized(message = "unauthorized"): HttpError {
    return new HttpError(401, message, "UNAUTHORIZED");
}

export function badRequest(message = "bad request"): HttpError {
    return new HttpError(400, message, "BAD_REQUEST");
}
