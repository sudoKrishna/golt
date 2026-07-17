import type { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../auth/auth";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];

 if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization header missing or malformed" });
  }

  const token = authHeader.slice(7); 
  const payload = verifyJwt(token);

  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  (req as any).ownerId = payload.ownerId;
  next();
}
