import { Router } from "express";
import { createdThread, listCategories, listThreads, parseThreadListFilter } from "../modules/threads/threads.repository.js";
import { getAuth } from "../config/clerk.js";
import { UnauthorizedError } from "../lib/errors.js";
import {z} from "zod"
import { getUserFromClerk } from "../modules/users/user.service.js";

export const threadsRouter = Router()

const CreatedThreadSchema = z.object({
    title:z.string().min(5).max(200),
    body: z.string().min(10).max(2000),
    categorySlug: z.string().trim().min(1)
})

threadsRouter.get("/categories",async (_req,res,next)=>{
    try {
        const extractListOfCategories = await listCategories()
        res.json(extractListOfCategories)
    } catch (err) {
        next(err)
    }
})

threadsRouter.post("/threads",async(req,res,next)=>{
    try {
        const auth = getAuth(req)
        if(!auth.userId){
            throw new UnauthorizedError("Unauthorized")
        }

        const parsedBody = CreatedThreadSchema.parse(req.body)
        const profile = await getUserFromClerk(auth.userId)

        const newlyCreatedThread = await createdThread({
            categorySlug:parsedBody.categorySlug,
            authorUserId:profile.user.id,
            title:parsedBody.title,
            body:parsedBody.body
        })
        res.status(201).json({data:newlyCreatedThread})
    } catch (e) {
        next(e)
    }
})

threadsRouter.get("/threads",async(req,res,next)=>{
    try {
        const filter = parseThreadListFilter({
            page:req.query.page,
            pageSize:req.query.pageSize,
            category:req.query.category,
            q:req.query.query,
            sort:req.query.sort,
        })

        const extractListOfThreads = await listThreads(filter)
        res.json({data:extractListOfThreads})
    } catch (err) {
        next(err)
    }
})