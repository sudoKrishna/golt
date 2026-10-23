import { Router } from "express";
import { prisma } from "@repo/db";
import { requireAuth } from "./middlewares/auth.middleware";
import { ensureSandbox } from "./sandbox";

const router = Router();

router.post("/:projectId/sandbox", requireAuth, async (req, res, next) => {
    try {
        const ownerId = (req as any).ownerId as string;
        const { projectId } = req.params as { projectId: string };

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project || project.ownerId !== ownerId) {
            return res.status(404).json({ error: "project not found" });
        }

        // fire and forget — don't await full readiness here
        ensureSandbox(projectId).catch((err) => {
            console.error(`[sandbox route] ensureSandbox failed for ${projectId}`, err);
        });

        return res.status(202).json({ status: "creating" });
    } catch (error) {
        next(error);
    }
});

router.get("/:projectId/sandbox/status", requireAuth, async (req, res, next) => {
    try {
        const ownerId = (req as any).ownerId as string;
        const { projectId } = req.params as { projectId: string };

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project || project.ownerId !== ownerId) {
            return res.status(404).json({ error: "project not found" });
        }

        const pod = await prisma.sandboxPod.findUnique({ where: { projectId } });

        return res.status(200).json({
            status: pod?.status ?? "none",
            previewUrl: project.previewUrl ?? null,
        });
    } catch (error) {
        next(error);
    }
});


export default router;
