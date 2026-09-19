import { createEmbeddings } from "@/lib/llm";
import { checkDbConnection, saveEmbeddingToDb } from "../../../lib/db";

export async function GET() {
    const dbStatus = await checkDbConnection();

    return Response.json({
        status: "online",
        service: "RAG Embedding API",
        model: "nomic-embed-text",
        provider: "Ollama",
        database: {
            connected: dbStatus.connected,
            message: dbStatus.message,
            tables: ["documents", "document_chunks", "conversations"],
        },
        docs: {
            method: "POST",
            body: {
                input: "string (required)",
                save_to_db: "boolean (optional, default: false)",
                name: "string (optional - document name)",
                file_name: "string (optional - original file name)",
                document_id: "string (optional - UUID of existing document to attach chunk to)",
                chunk_index: "number (optional)",
                page_number: "number (optional)",
                token_count: "number (optional)",
                metadata: "object (optional - JSON metadata)",
            },
            returns: {
                input: "string",
                dimension: "number",
                embeddings: "number[]",
                saved: "{ document, chunk } (present if saved to DB)",
            },
        },
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (!body || typeof body.input !== "string" || body.input.trim() === "") {
            return Response.json(
                { error: "Invalid request payload: 'input' must be a non-empty string." },
                { status: 400 }
            );
        }

        // 1. Generate the embedding vector
        const embeddings = await createEmbeddings(body.input);

        if (!embeddings || embeddings.length === 0) {
            return Response.json(
                { error: "Embedding generator returned an empty vector." },
                { status: 500 }
            );
        }

        // 2. If save_to_db is requested (or document parameters supplied), save to PostgreSQL
        let savedResult = null;
        if (body.save_to_db || body.document_id || body.name) {
            try {
                savedResult = await saveEmbeddingToDb({
                    content: body.input,
                    embedding: embeddings,
                    document_id: body.document_id,
                    name: body.name,
                    file_name: body.file_name,
                    file_type: body.file_type,
                    file_size: body.file_size,
                    storage_url: body.storage_url,
                    chunk_index: body.chunk_index,
                    page_number: body.page_number,
                    token_count: body.token_count,
                    metadata: body.metadata,
                });
            } catch (dbErr: any) {
                console.log("DB error : ", dbErr)
                return Response.json(
                    {
                        input: body.input,
                        dimension: embeddings.length,
                        embeddings: embeddings,
                        db_error: `Embedding was generated, but saving to PostgreSQL failed: ${dbErr.message}`,
                        hint: "Check that PostgreSQL is running, DATABASE_URL is valid, and tables (documents, document_chunks) exist with vector(768).",
                    },
                    { status: 207 } // 207 Multi-Status / Partial Success
                );
            }
        }

        return Response.json({
            input: body.input,
            dimension: embeddings?.length ?? 0,
            embeddings: embeddings,
            saved: savedResult,
        });
    } catch (error: any) {
        return Response.json(
            { error: error?.message || "Failed to generate embedding" },
            { status: 500 }
        );
    }
}