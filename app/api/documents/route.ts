import { NextRequest } from "next/server";
import { getRecentDocuments, getDocumentWithChunks } from "../../../lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id");

    if (documentId) {
      const data = await getDocumentWithChunks(documentId);
      if (!data) {
        return Response.json({ error: "Document not found" }, { status: 404 });
      }
      return Response.json(data);
    }

    const documents = await getRecentDocuments(50);
    return Response.json({ documents });
  } catch (err: any) {
    return Response.json(
      {
        error: err.message || "Failed to fetch documents from database",
        hint: "Ensure DATABASE_URL is set in .env and PostgreSQL is running.",
      },
      { status: 500 }
    );
  }
}
