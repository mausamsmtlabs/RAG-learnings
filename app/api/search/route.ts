import { createEmbeddings } from "@/lib/llm";
import { searchSimilarChunks } from "@/lib/search";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (!body || typeof body.question !== "string" || body.question.trim() === "") {
            return Response.json(
                { error: "Invalid request payload: 'question' must be a non-empty string." },
                { status: 400 }
            );
        }
        const questionEmbedding = await createEmbeddings(body?.question);
        const chunks = await searchSimilarChunks(questionEmbedding, 5);
        if (!chunks || chunks.length == 0) {
            return Response.json({ error: "No chunks found" }, { status: 404 })
        }
        return Response.json({
            question: body?.question,
            chunks,
            questionEmbeddings: questionEmbedding
        });
    } catch (error: any) {
        return Response.json({
            error: error.message || "Failed to search chunks",
            hint: "Ensure PostgreSQL is running, DATABASE_URL is set in .env and tables exist"
        }, { status: 500 })
    }
}