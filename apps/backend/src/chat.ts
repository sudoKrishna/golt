
import {
    Router,
    type Request,
    type Response,
    type NextFunction,
} from "express";
import { requireAuth } from "./middlewares/auth.middleware";
import { prisma } from "@repo/db";
import { runAgent } from "./agent";

class ChatController {
    public router: Router;

    constructor() {
        this.router = Router();

        this.router.post(
            "/:projectId/messages",
            requireAuth,
            this.sendMessage.bind(this)
        );

        this.router.get(
            "/:projectId/messages",
            requireAuth,
            this.getMessages.bind(this)
        );
    }

    private async sendMessage(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const ownerId = (req as any).ownerId as string;
            const projectId = req.params.projectId as string;

            const project = await prisma.project.findUnique({
                where: { id: projectId },
            });

            if (!project || project.ownerId !== ownerId) {
                res.status(404).json({
                    error: "project not found",
                });
                return;
            }

            const { message } = req.body;

            if (!message || typeof message !== "string") {
                res.status(400).json({
                    error: "message is required",
                });
                return;
            }

            runAgent(projectId, message).catch(next);

            res.status(200).json({
                status: "ok",
            });
        } catch (error) {
            next(error);
        }
    }

    private async getMessages(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const ownerId = (req as any).ownerId as string;
            const projectId = req.params.projectId as string;

            const project = await prisma.project.findUnique({
                where: { id: projectId },
            });

            if (!project || project.ownerId !== ownerId) {
                res.status(404).json({
                    error: "project not found",
                });
                return;
            }

            const messages = await prisma.message.findMany({
                where: { projectId },
                orderBy: { createdAt: "asc" },
            });

            res.status(200).json({ messages });
        } catch (error) {
            next(error);
        }
    }
}

const chatController = new ChatController();

export default chatController.router;