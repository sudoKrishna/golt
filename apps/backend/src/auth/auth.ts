import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma, withRetry } from "@repo/db";
import * as z from "zod";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function signJwt(ownerId: string): string {
  return jwt.sign({ ownerId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyJwt(token: string): { ownerId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { ownerId: string };
  } catch {
    return null;
  }
}

export async function createUser(email: string, password: string, name: string) {
  const hashedPassword = await hashPassword(password);
  return withRetry(() =>
    prisma.user.create({
      data: { email, name, passwordHash: hashedPassword },
    })
  );
}

export async function loginUser(email: string, password: string) {
  const user = await withRetry(() =>
    prisma.user.findUnique({ where: { email } })
  );

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    throw new Error("Invalid email or password");
  }

  const token = signJwt(user.id);
  return { user, token };
}

router.post("/auth/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", issues: parsed.error.flatten() });
    }

    const { email, password, name } = parsed.data;

    const existing = await withRetry(() =>
      prisma.user.findUnique({ where: { email } })
    );

    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const user = await createUser(email, password, name);
    const token = signJwt(user.id);

    return res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", issues: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;

    const { user, token } = await loginUser(email, password);

    return res.status(200).json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid email or password") {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
});

router.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const ownerId = (req as any).ownerId as string;

    const user = await withRetry(() =>
      prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true, email: true, name: true },
      })
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;