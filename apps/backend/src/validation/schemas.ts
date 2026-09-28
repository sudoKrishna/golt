import { z } from "zod";

const safePath = z
    .string()
    .trim()
    .min(1, "path is required")
    .max(512, "path is too long")
    .refine(
        (p) =>
            !p.startsWith("/") &&
            !p.startsWith("\\") &&
            !p.includes("..") &&
            !p.includes("\\") &&
            !p.includes("\0"),
        { message: "path must be a safe relative path" }
    );

export const signupSchema = z.object({
    name: z.string().trim().min(1, "name is required").max(100, "name is too long"),
    email: z.string().trim().toLowerCase().pipe(z.email("email is invalid")).pipe(z.string().max(254)),
    password: z
        .string()
        .min(8, "password must be at least 8 characters")
        .max(128, "password is too long"),
});

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email("email is invalid")).pipe(z.string().max(254)),
    password: z.string().min(1, "password is required").max(128, "password is too long"),
});

export const createProjectSchema = z.object({
    prompt: z.string().trim().min(1, "prompt is required").max(4000, "prompt is too long"),
});

export const sendMessageSchema = z.object({
    message: z.string().trim().min(1, "message is required").max(8000, "message is too long"),
});

export const writeFileSchema = z.object({
    path: safePath,
    content: z.string().max(2_000_000, "file content is too large"),
});

export const deleteFileSchema = z.object({
    path: safePath,
});

export const githubPushSchema = z.object({
    projectId: z.string().trim().min(1, "projectId is required").max(128),
    repoName: z
        .string()
        .trim()
        .min(1, "repoName is required")
        .max(100, "repoName is too long")
        .regex(/^[a-zA-Z0-9._-]+$/, "repoName contains invalid characters"),
});
