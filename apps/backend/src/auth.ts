import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "@repo/db"
import { requireAuth } from "./middlewares/auth.middleware";


const JWT_SECRET = process.env.JWT_SECRET!;

if(!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
}

export function verifyToken(token: string): { ownerId: string } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { ownerId: string };
    } catch {
        return null;
    }
}

class AuthController {
    public router: Router

    constructor() {
        this.router = Router();

        this.router.post("/signup", this.signup.bind(this));
        this.router.post("/login", this.login.bind(this));
        this.router.get("/me", requireAuth, this.me.bind(this));
    }

    private async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, 10);
    }

    private async verifyPassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    private sighToken(ownerId: string): string {
        return jwt.sign({ ownerId }, JWT_SECRET, {
            expiresIn: "7d",
        })
    }

    public verifyToken(token: string): { ownerId: string } | null {
        return verifyToken(token);
    }

    private async signup(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { name, email, password } = req.body;

            if (!name || !email || !password) {
                res.status(400).json({
                    error: "all fields are required",
                });
                return;
            }

            const existing = await prisma.user.findUnique({
                where: { email },
            });

            if (existing) {
                res.status(409).json({
                    error: "user already exists",
                });
                return;
            }

            const hash = await this.hashPassword(password);

            const user = await prisma.user.create({
                data: {
                    email,
                    name,
                    passwordHash: hash,
                },
            });

            const token = this.sighToken(user.id);

            res.status(201).json({
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                },
                token,
            });
        } catch (error) {
            next(error);
        }
    }

    private async login(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { email, password } = req.body;

            const user = await prisma.user.findUnique({
                where: { email },
            });

            if (!user) {
                res.status(401).json({
                    error: "user was not found",
                });
                return;
            }

            const valid = await this.verifyPassword(
                password,
                user.passwordHash
            );

            if (!valid) {
                res.status(401).json({
                    error : "invalid email or password",
                });
                return;
            }

            const token = this.sighToken(user.id);

            res.status(200).json({
                user : {
                    id : user.id,
                    name: user.name,
                    email : user.email
                },
                token,
            });
        } catch (error) {
           next(error);
        }
    }

    private async me(
        req: Request,
        res: Response,
        next: NextFunction
    ) : Promise<void> {
        try {
            const ownerId = (req  as any).ownerId;
            
            const user = await prisma.user.findUnique({
                where : {id : ownerId},
                select : {
                    id : true, 
                    email : true,
                    name : true,
                },
            });

            if(!user) {
                res.status(400).json({
                    error : "user not found",
                });
                return;
            }

            res.status(200).json({
                user,
            });
        } catch (error) {
            next(error);
        }
    }
}

const authController = new AuthController();

export default authController.router;