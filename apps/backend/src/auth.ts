import { Router} from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {prisma} from "@repo/db"
import { requireAuth } from "./middlewares/auth.middleware";

const router  = Router();
const JWT_SECRET = process.env.JWT_SECRET!;


export async function hashPassword(password : string ): Promise<string> {
    return bcrypt.hash(password, 10)
}

export async function verifyPassword(password : string, hash: string) : Promise<boolean> {
    return bcrypt.compare(password , hash)
}
export async function signToken(ownerId : string) {
   return jwt.sign({ownerId}, JWT_SECRET , {expiresIn : "7d"});
}

export async function verifyToken(token : string) {
    try {
        return jwt.verify(token, JWT_SECRET,) as {ownerId : string};
    } catch {
        return null;
    }
}

router.post("/signup", async (req , res, next) => {
  try {
      const {name , email, password} = req.body;
  
      if(!name || !email || !password) {
          return res.status(400).json({
              error : "all fileds are required"
          })
      }
  
      const hash = await hashPassword(password)
      const existing = await prisma.user.findUnique({
          where : {email}
      })
  
      if(existing) {
          return res.status(409).json({error : "user already exists"})
      }
  
      const user = await prisma.user.create({
          data : {email , name , passwordHash : hash}
      })
  
      const token = await signToken(user.id)
      return res.status(201).json({
          user : {id : user.id , email : user.email, name : user.name},
          token
      })
  } catch (error) {
    next(error)
  }
})

router.post("/login", async (req , res, next) => {
  try {
      const {email , password } = req.body;
  
      const user = await prisma.user.findUnique({
          where : {email}
      })
  
      if(!user) {
          return res.status(401).json({error : "user was not found"})
      }
  
      const valid = await verifyPassword(password, user.passwordHash)
  
      if(!valid){ 
          return res.status(401).json({error :"invalid email or password"})
      }
  
      const token = await signToken(user.id)
      return res.status(200).json({user : {id: user.id , name : user.name , email : user.email}, token})
  } catch (error) {
    next(error)
  }
})

router.get("/me",requireAuth, async (req , res, next) => {
  try {
    const ownerId = (req as any).ownerId ;
    const user = await prisma.user.findUnique({
        where : {id : ownerId},
        select : {id : true , email : true ,name : true}
    });

    if(!user) {
        return res.status(404).json({error : "user not found"})
    }
    return res.status(200).json({user})
  } catch (error) {
    next(error)
  }
})


export default router;

