import { Router } from "express";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middlewares/auth.middleware";
import { prisma } from "@repo/db";
import { decrypt, encrypt } from "../crypto";
import { pushProjectToGithub } from "./github-push";
import { validateBody } from "../middlewares/validate.middleware";
import { githubPushSchema } from "../validation/schemas";

interface GithubTokenResponse {
    access_token?: string,
    scope : string,
    token_type?: string,
    error ?: string,
    error_description?: string,

}
interface GithubUser { 
    id : number,
    login : string, 
    name? : string,
    email? : string | null,
}


const router = Router();

const  GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_REDIRECT_URL = process.env.GITHUB_REDIRECT_URL!;
const JWT_SECRET = process.env.JWT_SECRET!;
const   FRONTEND_URL =  process.env.FRONTEND_URL || "http://localhost:3000";


router.get("/connect" ,  (req, res) => {
    const {token} = req.query as {token?: string}
    if(!token) return res.status(401).json({error : "Missing token"})

        let ownerId : string;
        try {
            ({ownerId} = jwt.verify(token , JWT_SECRET) as {ownerId : string})
        } catch (error) {
            return res.status(401).json({error : "Invalid error"})
        }

    const state = jwt.sign({ownerId} , JWT_SECRET , {expiresIn : "10m"});

    const params = new URLSearchParams({
        client_id : GITHUB_CLIENT_ID,
        redirect_uri : GITHUB_REDIRECT_URL,
        scope : "repo read:user",
        state
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}) ;

router.get("/callback",async (req, res, next) => {
    try {
        const {code , state} = req.query as {code?: string , state ?:  string}
        if(!code || !state) {
            return res.status(400).json("Missing code and state")
        }
        let ownerId : string;

        try {
            ({ownerId} = jwt.verify(state ,JWT_SECRET) as {ownerId : string})
        } catch (error) {
            return res.status(400).json("Invalid and expried state")
        }

        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method : "POST",
            headers : {"Content-Type" : "application/json" , Accept : "application/json"},
            body : JSON.stringify({
                client_id : GITHUB_CLIENT_ID,
                client_secret : GITHUB_CLIENT_SECRET,
                code,
                redirect_uri : GITHUB_REDIRECT_URL,
            }),
        });
        const tokenData   = await tokenRes.json() as GithubTokenResponse;

        if(!tokenData.access_token) {
            return res.status(400).json("Github token exchange falied")
        }

        const userRes = await fetch("https://api.github.com/user", {
            headers : {Authorization : `Bearer ${tokenData.access_token}`},
        });
        const ghUser = await userRes.json() as GithubUser;

        const existing = await prisma.connection.findFirst({
            where: { provider: "github", externalId: String(ghUser.id) },
        });

        if (existing && existing.ownerId !== ownerId) {
            return res.redirect(
                `${FRONTEND_URL}/settings/connectors?github=error&reason=already_linked`
            );
        }

        await prisma.connection.upsert({
            where : {ownerId_provider : {ownerId ,provider : "github"}},
            create : {
                ownerId,
                provider : "github",
                accessToken : encrypt(tokenData.access_token),
                scope : tokenData.scope,
                externalId : String(ghUser.id),
                externalName : ghUser.login,
            },
            update : {
                accessToken : encrypt(tokenData.access_token),
                scope : tokenData.scope,
                externalId : String(ghUser.id),
                externalName : ghUser.login,
            },
        });

        res.redirect(`${FRONTEND_URL}/settings/connectors?github=connected`);
    } catch (error) {
        next(error)
    }
});

router.get("/status" , requireAuth , async(req , res , next) => {
    try {
        const ownerId = (req).ownerId as string;
        const conn = await prisma.connection.findUnique({
            where : {ownerId_provider : {ownerId , provider : "github"}},
            select : {externalName: true, createdAt : true},
        });
        res.json({connected : !!conn , username : conn?.externalName ?? null});
    } catch (error) {
        next(error)
    }
}) 

router.delete("/" , requireAuth , async (req , res , next) => {
    try {
         const ownerId = req.ownerId as string;
         await prisma.connection.deleteMany({
            where : {ownerId , provider : "github"}
         });
         res.json({message : "disconnected"});
    } catch (error) {
        next(error)
    }
})
router.post("/push" , requireAuth, validateBody(githubPushSchema), async (req , res , next) => {
   try {
    const ownerId = req.ownerId as string;
    const {projectId , repoName} = req.body as {projectId : string, repoName : string}

    if(!projectId || !repoName) {
        return res.status(400).json("missing projectId and reponame")
    }

    const result = await pushProjectToGithub(ownerId , projectId , repoName)
    res.json(result)

   } catch (error) {
    next(error)
   }


})

export async function getGithubToken(ownerId : string) : Promise<string | null> {
    const conn = await prisma.connection.findUnique({
        where : {ownerId_provider : {ownerId , provider : "github"}},
    });
    if(!conn) return null;
    return decrypt(conn.accessToken);
}

export default router;
