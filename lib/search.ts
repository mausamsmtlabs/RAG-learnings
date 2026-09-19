import { getDbPool } from "./db";


// Accept a embedding and use IVFFlat search (nearest neighbor) to find semantically similar chunks 
export async function searchSimilarChunks(
  queryEmbedding: number[],
  limit = 5
) {
  const db = getDbPool();
  const query = `
    SELECT
      id,
      document_id,
      content,
      chunk_index,
      page_number,
      embedding <=> $1 AS distance
    FROM document_chunks
    ORDER by embedding <=> $1 
    LIMIT $2
    `;
  const result = await db.query(query, [JSON.stringify(queryEmbedding), limit]);
  return result.rows;
}