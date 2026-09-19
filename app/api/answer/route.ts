import { createEmbeddings, generateAnswer } from "@/lib/llm";
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
        const question = body?.question;
        const questionEmbedding = await createEmbeddings(question);
        const chunks = await searchSimilarChunks(questionEmbedding, 5);
        const context = chunks
            .map((chunk) => chunk.content)
            .join("\n\n");
        const answer = await generateAnswer(question, context)
        if (!answer) {
            return Response.json(
                { error: "Failed to generate answer" },
                { status: 404 }
            );
        }
        return Response.json({
            // question,
            // context,
            answer,
            // chunks,
            // questionEmbedding
        })
    } catch (error: any) {
        return Response.json(
            {
                error: error.message || "Failed to generate answer",
                hint: "Ensure DATABASE_URL is set in .env and PostgreSQL is running.",
            },
            { status: 500 }
        );
    }
}