import { Pool, PoolConfig } from "pg";

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    const hasParams = Boolean(process.env.DB_NAME || process.env.DB_HOST || process.env.DB_USER);

    if (hasParams) {
      const config: PoolConfig = {
        host: process.env.DB_HOST || process.env.PGHOST || "localhost",
        port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
        user: process.env.DB_USER || process.env.PGUSER || "postgres",
        password: process.env.DB_PASSWORD ?? process.env.PGPASSWORD ?? "",
        database: process.env.DB_NAME || process.env.PGDATABASE || "postgres",
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      };
      console.log("Database config:", config);
      pool = new Pool(config);
    } else if (process.env.DATABASE_URL) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } else {
      throw new Error(
        "Database parameters not configured. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env"
      );
    }
  }
  return pool;
}

export async function checkDbConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const hasConfig = Boolean(
      process.env.DB_NAME || process.env.DB_HOST || process.env.DATABASE_URL
    );
    if (!hasConfig) {
      return {
        connected: false,
        message: "Database parameters (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) not configured in .env",
      };
    }
    const db = getDbPool();
    const result = await db.query("SELECT NOW() as now, version() as version;");
    return {
      connected: true,
      message: `Connected: ${result.rows[0]?.now ? new Date(result.rows[0].now).toLocaleTimeString() : "OK"}`,
    };
  } catch (err: any) {
    return {
      connected: false,
      message: err.message || "Could not connect to PostgreSQL database",
    };
  }
}

export interface SaveEmbeddingParams {
  content: string;
  embedding: number[];
  document_id?: string;
  name?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  storage_url?: string;
  chunk_index?: number;
  page_number?: number;
  token_count?: number;
  metadata?: Record<string, any>;
}

export async function saveEmbeddingToDb(params: SaveEmbeddingParams) {
  const db = getDbPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    let docId = params.document_id;
    let docRow: any = null;

    // 1. If document_id was provided, verify it exists
    if (docId) {
      const existing = await client.query("SELECT * FROM documents WHERE id = $1", [docId]);
      if (existing.rows.length === 0) {
        throw new Error(`Document with ID ${docId} not found in database.`);
      }
      docRow = existing.rows[0];
    } else {
      // Create new document record
      const docName = params.name?.trim() || `Document ${new Date().toISOString().slice(0, 10)}`;
      const fileName = params.file_name?.trim() || "manual_entry.txt";
      const fileType = params.file_type || "text/plain";
      const fileSize = params.file_size || Buffer.byteLength(params.content, "utf-8");

      const insertDocQuery = `
        INSERT INTO documents (name, file_name, file_type, file_size, storage_url, status)
        VALUES ($1, $2, $3, $4, $5, 'completed')
        RETURNING *;
      `;
      const docRes = await client.query(insertDocQuery, [
        docName,
        fileName,
        fileType,
        fileSize,
        params.storage_url || null,
      ]);
      docRow = docRes.rows[0];
      docId = docRow.id;
    }

    // Determine chunk index if not explicitly provided
    let chunkIndex = params.chunk_index;
    if (chunkIndex === undefined || chunkIndex === null) {
      const countRes = await client.query(
        "SELECT COUNT(*)::int as count FROM document_chunks WHERE document_id = $1",
        [docId]
      );
      chunkIndex = countRes.rows[0]?.count ?? 0;
    }

    // Format vector as string: '[0.123, -0.456, ...]'
    const vectorString = `[${params.embedding.join(",")}]`;

    const tokenCount =
      params.token_count ?? Math.ceil(params.content.trim().split(/\s+/).filter(Boolean).length * 1.3);

    const insertChunkQuery = `
      INSERT INTO document_chunks (
        document_id, content, embedding, chunk_index, page_number, token_count, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, document_id, content, chunk_index, page_number, token_count, metadata, created_at;
    `;

    const chunkRes = await client.query(insertChunkQuery, [
      docId,
      params.content,
      vectorString,
      chunkIndex,
      params.page_number || null,
      tokenCount,
      params.metadata || {},
    ]);

    await client.query("COMMIT");

    return {
      document: docRow,
      chunk: chunkRes.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRecentDocuments(limit = 20) {
  const db = getDbPool();
  const query = `
    SELECT 
      d.id,
      d.name,
      d.file_name,
      d.file_type,
      d.file_size,
      d.status,
      d.created_at,
      COUNT(c.id)::int as chunk_count
    FROM documents d
    LEFT JOIN document_chunks c ON d.id = c.document_id
    GROUP BY d.id
    ORDER BY d.created_at DESC
    LIMIT $1;
  `;
  const result = await db.query(query, [limit]);
  return result.rows;
}

export async function getDocumentWithChunks(documentId: string) {
  const db = getDbPool();
  const docQuery = `SELECT * FROM documents WHERE id = $1;`;
  const chunksQuery = `
    SELECT 
      id, document_id, content, chunk_index, page_number, token_count, metadata, created_at
    FROM document_chunks
    WHERE document_id = $1
    ORDER BY chunk_index ASC;
  `;

  const [docRes, chunksRes] = await Promise.all([
    db.query(docQuery, [documentId]),
    db.query(chunksQuery, [documentId]),
  ]);

  if (docRes.rows.length === 0) {
    return null;
  }

  return {
    document: docRes.rows[0],
    chunks: chunksRes.rows,
  };
}
