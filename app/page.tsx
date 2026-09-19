"use client";

import { useState, useEffect } from "react";

interface SavedDbResult {
  document: {
    id: string;
    name: string;
    file_name: string;
    file_type: string;
    file_size: number;
    status: string;
    created_at: string;
  };
  chunk: {
    id: string;
    document_id: string;
    content: string;
    chunk_index: number;
    page_number: number | null;
    token_count: number;
    metadata: Record<string, any>;
    created_at: string;
  };
}

interface EmbeddingResponse {
  input: string;
  dimension: number;
  embeddings: number[];
  saved?: SavedDbResult | null;
  db_error?: string;
  hint?: string;
  error?: string;
}

interface ApiHealthResponse {
  status: string;
  service: string;
  model: string;
  provider: string;
  database?: {
    connected: boolean;
    message: string;
    tables: string[];
  };
}

interface DocumentItem {
  id: string;
  name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
  chunk_count: number;
}

interface DocumentDetail {
  document: DocumentItem;
  chunks: Array<{
    id: string;
    document_id: string;
    content: string;
    chunk_index: number;
    page_number: number | null;
    token_count: number;
    metadata: Record<string, any>;
    created_at: string;
  }>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"embedding" | "similarity" | "chunking" | "database" | "docs">("embedding");

  // Service health status
  const [health, setHealth] = useState<ApiHealthResponse | null>(null);
  const [isHealthChecking, setIsHealthChecking] = useState(true);

  // Tab 1: Single Embedding State
  const [inputText, setInputText] = useState(
    "Retrieval-Augmented Generation (RAG) grounds language model responses in verified external knowledge."
  );
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [response, setResponse] = useState<EmbeddingResponse | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"heatmap" | "stats" | "json">("heatmap");

  // Database persistence options in Tab 1
  const [saveToDb, setSaveToDb] = useState(false);
  const [docName, setDocName] = useState("RAG Knowledge Base Document");
  const [docFileName, setDocFileName] = useState("knowledge_base.txt");
  const [docIdInput, setDocIdInput] = useState("");
  const [pageNumberInput, setPageNumberInput] = useState("");
  const [metadataJson, setMetadataJson] = useState('{"category": "ai-learning", "verified": true}');

  // Tab 2: Semantic Similarity State
  const [textA, setTextA] = useState("How does machine learning work?");
  const [textB, setTextB] = useState("Explanation of machine learning algorithms and neural networks");
  const [simLoading, setSimLoading] = useState(false);
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [euclideanDist, setEuclideanDist] = useState<number | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // Tab 3: Chunking & Preprocessing State
  const [docText, setDocText] = useState(
    `Retrieval-Augmented Generation (RAG) is a technique that enhances large language models by retrieving relevant facts from an external knowledge base before generating a response.

By combining retrieval mechanisms with generative models, RAG reduces hallucinations and ensures answers are grounded in up-to-date proprietary or domain-specific documentation.

Embeddings are numerical vector representations of text where semantically related passages are located close to each other in high-dimensional vector space.`
  );
  const [chunkSize, setChunkSize] = useState<number>(120);
  const [chunkOverlap, setChunkOverlap] = useState<number>(20);
  const [chunks, setChunks] = useState<string[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  // Tab 4: Database Explorer State
  const [dbDocuments, setDbDocuments] = useState<DocumentItem[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [selectedDocDetail, setSelectedDocDetail] = useState<DocumentDetail | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // Check health on mount
  const refreshHealth = async () => {
    setIsHealthChecking(true);
    try {
      const res = await fetch("/api/embedding");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error("Health check error:", err);
    } finally {
      setIsHealthChecking(false);
    }
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  // Fetch documents from database
  const fetchDbDocuments = async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (res.ok && data.documents) {
        setDbDocuments(data.documents);
      } else {
        setDbError(data.error || "Failed to load database records.");
      }
    } catch (err: any) {
      setDbError(err.message || "Network error loading database records.");
    } finally {
      setDbLoading(false);
    }
  };

  const loadDocumentDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/documents?id=${id}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedDocDetail(data);
      }
    } catch (err) {
      console.error("Error loading document details:", err);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Run Embedding API
  const handleGenerateEmbedding = async (customInput?: string) => {
    const textToSend = customInput ?? inputText;
    if (!textToSend.trim()) return;

    setLoading(true);
    setStatusCode(null);
    const startTime = performance.now();

    let parsedMeta = {};
    if (saveToDb && metadataJson.trim()) {
      try {
        parsedMeta = JSON.parse(metadataJson);
      } catch {
        parsedMeta = { raw_metadata: metadataJson };
      }
    }

    const payload: any = {
      input: textToSend,
      save_to_db: saveToDb,
    };

    if (saveToDb) {
      if (docName.trim()) payload.name = docName.trim();
      if (docFileName.trim()) payload.file_name = docFileName.trim();
      if (docIdInput.trim()) payload.document_id = docIdInput.trim();
      if (pageNumberInput.trim()) payload.page_number = parseInt(pageNumberInput.trim(), 10);
      payload.metadata = parsedMeta;
    }

    try {
      const res = await fetch("/api/embedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const elapsed = Math.round(performance.now() - startTime);
      setLatency(elapsed);
      setStatusCode(res.status);

      const data = await res.json();
      setResponse(data);

      if (saveToDb && data.saved) {
        refreshHealth();
      }
    } catch (err: any) {
      setStatusCode(500);
      setResponse({
        input: textToSend,
        dimension: 0,
        embeddings: [],
        error: err.message || "Network error while connecting to /api/embedding",
      });
    } finally {
      setLoading(false);
    }
  };

  // Batch Save all chunks from chunking simulator
  const handleSaveAllChunksToDb = async () => {
    if (chunks.length === 0) return;
    setBatchSaving(true);
    setBatchProgress(`Saving 1 of ${chunks.length}...`);

    try {
      // 1. Save first chunk creating the document
      const firstRes = await fetch("/api/embedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: chunks[0],
          save_to_db: true,
          name: `Ingested Doc (${new Date().toLocaleTimeString()})`,
          file_name: "chunked_document.txt",
          chunk_index: 0,
          metadata: { total_chunks: chunks.length, source: "Chunking Simulator" },
        }),
      });

      const firstData = await firstRes.json();
      const createdDocId = firstData.saved?.document?.id;

      if (!createdDocId) {
        throw new Error(firstData.db_error || "Could not create parent document in PostgreSQL.");
      }

      // 2. Save remaining chunks attached to the same document_id
      for (let i = 1; i < chunks.length; i++) {
        setBatchProgress(`Saving ${i + 1} of ${chunks.length}...`);
        await fetch("/api/embedding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: chunks[i],
            save_to_db: true,
            document_id: createdDocId,
            chunk_index: i,
            metadata: { chunk_of: chunks.length },
          }),
        });
      }

      setBatchProgress(`Successfully saved all ${chunks.length} chunks to PostgreSQL!`);
      refreshHealth();
    } catch (err: any) {
      setBatchProgress(`Batch save failed: ${err.message}`);
    } finally {
      setBatchSaving(false);
    }
  };

  // Run Cosine Similarity Comparison
  const calculateCosineSimilarity = (vecA: number[], vecB: number[]) => {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dot / magnitude;
  };

  const calculateEuclideanDistance = (vecA: number[], vecB: number[]) => {
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
      const diff = vecA[i] - vecB[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  };

  const handleCompareTexts = async () => {
    if (!textA.trim() || !textB.trim()) return;

    setSimLoading(true);
    setSimError(null);
    setSimilarityScore(null);
    setEuclideanDist(null);

    try {
      const [resA, resB] = await Promise.all([
        fetch("/api/embedding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: textA }),
        }),
        fetch("/api/embedding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: textB }),
        }),
      ]);

      const dataA = await resA.json();
      const dataB = await resB.json();

      if (dataA.error || !dataA.embeddings) {
        throw new Error(dataA.error || "Failed to embed Text A");
      }
      if (dataB.error || !dataB.embeddings) {
        throw new Error(dataB.error || "Failed to embed Text B");
      }

      const sim = calculateCosineSimilarity(dataA.embeddings, dataB.embeddings);
      const euc = calculateEuclideanDistance(dataA.embeddings, dataB.embeddings);

      setSimilarityScore(sim);
      setEuclideanDist(euc);
    } catch (err: any) {
      setSimError(err.message || "Error comparing embeddings");
    } finally {
      setSimLoading(false);
    }
  };

  // Chunking simulator
  const handleChunkDocument = () => {
    if (!docText.trim()) return;
    const words = docText.split(/\s+/);
    const generatedChunks: string[] = [];
    let i = 0;

    while (i < words.length) {
      const chunkWords = words.slice(i, i + chunkSize);
      generatedChunks.push(chunkWords.join(" "));
      i += Math.max(1, chunkSize - chunkOverlap);
    }
    setChunks(generatedChunks);
  };

  // Vector metrics
  const vectorStats = response?.embeddings?.length
    ? {
      min: Math.min(...response.embeddings).toFixed(4),
      max: Math.max(...response.embeddings).toFixed(4),
      avg: (
        response.embeddings.reduce((a, b) => a + b, 0) /
        response.embeddings.length
      ).toFixed(4),
      l2Norm: Math.sqrt(
        response.embeddings.reduce((sum, val) => sum + val * val, 0)
      ).toFixed(4),
    }
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white font-sans antialiased">
      {/* Top Banner & Gradient Glow */}
      <div className="relative overflow-hidden border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-xl">
        <div className="absolute top-0 left-1/4 -z-10 h-48 w-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 -z-10 h-48 w-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  RAG System Studio
                </span>
                <span className="text-xs text-zinc-400 font-mono">v0.2.0 • pgvector</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                API Test & Database Workbench
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Generate 768-d embeddings, test semantic similarity, and persist chunks to PostgreSQL (<code className="text-zinc-300">documents</code> &amp; <code className="text-zinc-300">document_chunks</code>).
              </p>
            </div>

            {/* Service & Database Connectivity Pills */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Ollama Pill */}
              <div className="flex items-center gap-2.5 bg-zinc-900/90 border border-zinc-800 px-3.5 py-2 rounded-xl shadow-inner text-xs">
                <div className="relative flex h-2.5 w-2.5">
                  {health?.status === "online" ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  )}
                </div>
                <div>
                  <div className="font-medium text-zinc-200">
                    {health ? `${health.model}` : "Ollama Loading"}
                  </div>
                  <div className="text-zinc-500 text-[10px] font-mono">Ollama (768-d)</div>
                </div>
              </div>

              {/* PostgreSQL Pill */}
              <div
                title={health?.database?.message || "PostgreSQL connection status"}
                className="flex items-center gap-2.5 bg-zinc-900/90 border border-zinc-800 px-3.5 py-2 rounded-xl shadow-inner text-xs"
              >
                <div className="relative flex h-2.5 w-2.5">
                  {health?.database?.connected ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  )}
                </div>
                <div>
                  <div className="font-medium text-zinc-200 flex items-center gap-1">
                    PostgreSQL
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${health?.database?.connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {health?.database?.connected ? "Ready" : "Config Required"}
                    </span>
                  </div>
                  <div className="text-zinc-500 text-[10px] font-mono">pgvector: documents + chunks</div>
                </div>
              </div>
            </div>
          </div>

          {/* RAG Pipeline Lifecycle Stepper */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-4 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setActiveTab("embedding")}
              className={`text-left rounded-lg p-3 transition-all border ${activeTab === "embedding"
                  ? "bg-indigo-950/40 border-indigo-500/40 shadow-sm"
                  : "bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                  Step 1 • Live
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              </div>
              <p className="text-sm font-medium text-zinc-200 mt-1">Embeddings</p>
              <p className="text-xs text-zinc-500 truncate">Generate &amp; save to DB</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("similarity")}
              className={`text-left rounded-lg p-3 transition-all border ${activeTab === "similarity"
                  ? "bg-indigo-950/40 border-indigo-500/40 shadow-sm"
                  : "bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                  Step 2 • Active
                </span>
                <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              </div>
              <p className="text-sm font-medium text-zinc-200 mt-1">Semantic Match</p>
              <p className="text-xs text-zinc-500 truncate">Cosine distance testing</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chunking")}
              className={`text-left rounded-lg p-3 transition-all border ${activeTab === "chunking"
                  ? "bg-indigo-950/40 border-indigo-500/40 shadow-sm"
                  : "bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  Step 3 • Prep
                </span>
                <span className="h-2 w-2 rounded-full bg-amber-400/60"></span>
              </div>
              <p className="text-sm font-medium text-zinc-200 mt-1">Text Chunking</p>
              <p className="text-xs text-zinc-500 truncate">Token split &amp; batch ingest</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("database");
                fetchDbDocuments();
              }}
              className={`text-left rounded-lg p-3 transition-all border ${activeTab === "database"
                  ? "bg-indigo-950/40 border-indigo-500/40 shadow-sm"
                  : "bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                  Step 4 • Storage
                </span>
                <span className="text-[10px] font-mono text-zinc-400">pgvector</span>
              </div>
              <p className="text-sm font-medium text-zinc-200 mt-1">Database Records</p>
              <p className="text-xs text-zinc-500 truncate">Saved docs &amp; chunks</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("docs")}
              className={`text-left rounded-lg p-3 transition-all border ${activeTab === "docs"
                  ? "bg-indigo-950/40 border-indigo-500/40 shadow-sm"
                  : "bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Reference
                </span>
                <span className="text-[10px] font-mono text-zinc-400">cURL/JS</span>
              </div>
              <p className="text-sm font-medium text-zinc-200 mt-1">API Client Docs</p>
              <p className="text-xs text-zinc-500 truncate">Schema &amp; snippets</p>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: EMBEDDING API TESTER WITH DB OPTIONS */}
        {activeTab === "embedding" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Request Builder */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      POST
                    </span>
                    <span className="font-mono text-xs text-zinc-300">/api/embedding</span>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">JSON Body</span>
                </div>

                {/* Query Presets */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-zinc-400 mb-2">
                    Quick Presets for RAG Testing:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "RAG Overview", text: "What is Retrieval-Augmented Generation and how does it prevent LLM hallucination?" },
                      { label: "Vector Math", text: "Dense vector embeddings represent textual semantic proximity." },
                      { label: "Geography Fact", text: "Mount Everest is the highest mountain peak above sea level." },
                      { label: "Code Snippet", text: "const client = new OpenAI({ apiKey: process.env.API_KEY });" },
                    ].map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setInputText(preset.text);
                          handleGenerateEmbedding(preset.text);
                        }}
                        className="text-xs bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 px-2.5 py-1 rounded-md border border-zinc-700/60 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Textarea */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-zinc-300">
                    Chunk Content (<code className="text-indigo-400">body.input</code>)
                  </label>
                  <textarea
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter text to convert into vector embeddings..."
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-sans resize-y"
                  />
                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span>{inputText.length} chars • ~{Math.ceil(inputText.trim().split(/\s+/).filter(Boolean).length)} words</span>
                  </div>
                </div>

                {/* PostgreSQL Persistence Options Toggle */}
                <div className="mt-5 pt-4 border-t border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-200">
                      <input
                        type="checkbox"
                        checked={saveToDb}
                        onChange={(e) => setSaveToDb(e.target.checked)}
                        className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 bg-zinc-950 h-4 w-4"
                      />
                      <span>Save to PostgreSQL Database (<code className="text-indigo-400">documents</code> &amp; <code className="text-indigo-400">document_chunks</code>)</span>
                    </label>
                  </div>

                  {saveToDb && (
                    <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3.5 space-y-3 text-xs">
                      <div>
                        <label className="block text-zinc-400 mb-1">Document Name (creates new document if ID empty)</label>
                        <input
                          type="text"
                          value={docName}
                          onChange={(e) => setDocName(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-zinc-400 mb-1">File Name</label>
                          <input
                            type="text"
                            value={docFileName}
                            onChange={(e) => setDocFileName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-zinc-200 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-400 mb-1">Page Number (optional)</label>
                          <input
                            type="number"
                            placeholder="e.g. 1"
                            value={pageNumberInput}
                            onChange={(e) => setPageNumberInput(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-zinc-200 font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-zinc-400 mb-1">Attach to Existing Document ID (optional UUID)</label>
                        <input
                          type="text"
                          placeholder="leave empty to auto-create document"
                          value={docIdInput}
                          onChange={(e) => setDocIdInput(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-zinc-200 font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 mb-1">Metadata (JSONB)</label>
                        <input
                          type="text"
                          value={metadataJson}
                          onChange={(e) => setMetadataJson(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-zinc-200 font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => handleGenerateEmbedding()}
                  disabled={loading || !inputText.trim()}
                  className="mt-5 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] text-white font-medium py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      Generating {saveToDb ? "& Saving to PostgreSQL..." : "Embeddings..."}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Execute /api/embedding {saveToDb ? "+ Save to DB" : ""}
                    </>
                  )}
                </button>
              </div>

              {/* API Info Card */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-400 space-y-2">
                <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Schema Persistence
                </div>
                <p>
                  When enabled, this writes a parent record into <strong>documents</strong> and a child vector row into <strong>document_chunks</strong> with <code className="text-zinc-300">vector(768)</code>.
                </p>
              </div>
            </div>

            {/* Right Column: Live Response & Vector Inspector */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col min-h-[500px]">
                {/* Header with Status & Latency */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-zinc-200">Response Inspector</span>
                    {statusCode !== null && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${statusCode === 200
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : statusCode === 207
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}
                      >
                        {statusCode} {statusCode === 200 ? "OK" : statusCode === 207 ? "PARTIAL (DB PENDING)" : "ERROR"}
                      </span>
                    )}
                    {latency !== null && (
                      <span className="text-xs font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/50">
                        ⚡ {latency} ms
                      </span>
                    )}
                  </div>

                  {/* View Mode Switcher */}
                  <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode("heatmap")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${viewMode === "heatmap"
                          ? "bg-indigo-600 text-white font-medium"
                          : "text-zinc-400 hover:text-zinc-200"
                        }`}
                    >
                      Heatmap
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("stats")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${viewMode === "stats"
                          ? "bg-indigo-600 text-white font-medium"
                          : "text-zinc-400 hover:text-zinc-200"
                        }`}
                    >
                      Vector Stats
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("json")}
                      className={`px-2.5 py-1 rounded-md transition-colors ${viewMode === "json"
                          ? "bg-indigo-600 text-white font-medium"
                          : "text-zinc-400 hover:text-zinc-200"
                        }`}
                    >
                      Raw JSON
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                {response ? (
                  <div className="flex-1 mt-4 flex flex-col justify-between">
                    {/* Database Warning / Error if saving failed */}
                    {response.db_error && (
                      <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1">
                        <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                          <span>⚠️</span> PostgreSQL Persistence Notice
                        </div>
                        <p className="text-amber-200">{response.db_error}</p>
                        {response.hint && <p className="text-zinc-400 text-[11px] font-mono">{response.hint}</p>}
                      </div>
                    )}

                    {/* Database Success Banner */}
                    {response.saved && (
                      <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-2">
                        <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                          <span>✅</span> Successfully Saved to PostgreSQL
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] text-zinc-300">
                          <div>
                            <span className="text-zinc-500">Doc ID:</span> {response.saved.document.id}
                          </div>
                          <div>
                            <span className="text-zinc-500">Chunk ID:</span> {response.saved.chunk.id}
                          </div>
                          <div>
                            <span className="text-zinc-500">Document:</span> {response.saved.document.name}
                          </div>
                          <div>
                            <span className="text-zinc-500">Chunk Index:</span> #{response.saved.chunk.chunk_index}
                          </div>
                        </div>
                      </div>
                    )}

                    {response.error ? (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm">
                        <div className="font-semibold mb-1">API Error Received:</div>
                        <div className="font-mono text-xs">{response.error}</div>
                      </div>
                    ) : (
                      <>
                        {/* High-level Vector Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                          <div className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-xl">
                            <span className="text-[11px] text-zinc-500 uppercase tracking-wider block font-mono">
                              Dimensions
                            </span>
                            <span className="text-lg font-bold text-indigo-400 font-mono">
                              {response.dimension}
                            </span>
                          </div>
                          <div className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-xl">
                            <span className="text-[11px] text-zinc-500 uppercase tracking-wider block font-mono">
                              L2 Norm
                            </span>
                            <span className="text-lg font-bold text-cyan-400 font-mono">
                              {vectorStats?.l2Norm ?? "1.000"}
                            </span>
                          </div>
                          <div className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-xl">
                            <span className="text-[11px] text-zinc-500 uppercase tracking-wider block font-mono">
                              Min Value
                            </span>
                            <span className="text-lg font-bold text-emerald-400 font-mono">
                              {vectorStats?.min}
                            </span>
                          </div>
                          <div className="bg-zinc-950/60 border border-zinc-800/80 p-3 rounded-xl">
                            <span className="text-[11px] text-zinc-500 uppercase tracking-wider block font-mono">
                              Max Value
                            </span>
                            <span className="text-lg font-bold text-amber-400 font-mono">
                              {vectorStats?.max}
                            </span>
                          </div>
                        </div>

                        {/* VIEW MODE: HEATMAP */}
                        {viewMode === "heatmap" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                              <span>
                                Visualizing first <strong>128</strong> dimensions (colored by sign &amp; magnitude):
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500"></span> Positive
                                <span className="inline-block w-2.5 h-2.5 rounded bg-rose-500 ml-2"></span> Negative
                              </div>
                            </div>
                            <div className="bg-zinc-950/90 border border-zinc-800 p-3 rounded-xl overflow-y-auto max-h-72">
                              <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
                                {response.embeddings.slice(0, 128).map((val, idx) => {
                                  const isPos = val >= 0;
                                  const intensity = Math.min(1, Math.abs(val) * 1.5);
                                  return (
                                    <div
                                      key={idx}
                                      title={`Dim [${idx}]: ${val}`}
                                      style={{
                                        backgroundColor: isPos
                                          ? `rgba(16, 185, 129, ${0.2 + intensity * 0.8})`
                                          : `rgba(244, 63, 94, ${0.2 + intensity * 0.8})`,
                                      }}
                                      className="h-6 rounded flex items-center justify-center text-[9px] font-mono text-white/90 font-medium cursor-default transition-transform hover:scale-110"
                                    >
                                      {idx}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <p className="text-[11px] text-zinc-500">
                              Hover over any cell to view exact float coordinate. Total {response.dimension} dimensions generated.
                            </p>
                          </div>
                        )}

                        {/* VIEW MODE: VECTOR STATS TABLE */}
                        {viewMode === "stats" && (
                          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-3 overflow-y-auto max-h-72">
                            <div className="text-xs font-semibold text-zinc-300">
                              Sample Coordinates (First 10 Dimensions):
                            </div>
                            <div className="space-y-1">
                              {response.embeddings.slice(0, 10).map((dim, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-xs font-mono py-1 px-2.5 bg-zinc-900/50 rounded border border-zinc-800/60"
                                >
                                  <span className="text-indigo-400">index[{i}]</span>
                                  <span className={dim >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                    {dim.toFixed(8)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* VIEW MODE: RAW JSON */}
                        {viewMode === "json" && (
                          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-300 overflow-y-auto max-h-72">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(
                                {
                                  input: response.input,
                                  dimension: response.dimension,
                                  saved: response.saved,
                                  embeddings: [
                                    ...response.embeddings.slice(0, 8),
                                    `... ${response.embeddings.length - 8} more floats`,
                                  ],
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        )}
                      </>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-6 border-t border-zinc-800">
                      <div className="text-xs text-zinc-400">
                        {response.embeddings?.length ? (
                          <span>Vector Array Ready ({response.dimension} floats)</span>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(JSON.stringify(response.embeddings), "vector")
                          }
                          className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {copiedType === "vector" ? "Copied Vector!" : "Copy Vector"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(JSON.stringify(response, null, 2), "json")
                          }
                          className="px-3 py-1.5 text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg border border-indigo-500/30 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {copiedType === "json" ? "Copied Response!" : "Copy JSON"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
                    <div className="w-12 h-12 rounded-full bg-zinc-800/80 border border-zinc-700 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-zinc-400">Ready to test /api/embedding</p>
                    <p className="text-xs text-zinc-500 max-w-sm mt-1">
                      Type your test query on the left or select a preset, optionally toggle PostgreSQL persistence, and click Execute.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SEMANTIC SIMILARITY COMPARATOR */}
        {activeTab === "similarity" && (
          <div className="space-y-6">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="max-w-3xl mb-6">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2">
                  Semantic Distance Playground
                </span>
                <h2 className="text-xl font-bold text-white">Compare Embedding Similarity</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  How Vector Search works in RAG: The server runs both texts through <code>/api/embedding</code> and computes their Cosine Similarity in 768-dimensional space.
                </p>
              </div>

              {/* Similarity Presets */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-xs text-zinc-400 self-center mr-1">Preset Pairs:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTextA("How does machine learning work?");
                    setTextB("Explanation of machine learning algorithms and neural networks");
                  }}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700"
                >
                  🟢 High Similarity (Concepts)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTextA("What is the capital city of France?");
                    setTextB("Paris is the capital and most populous city of France.");
                  }}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700"
                >
                  🔵 Question vs Answer Chunk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTextA("Quantum computing uses qubits to perform superposition.");
                    setTextB("How to bake a chocolate fudge birthday cake with frosting.");
                  }}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700"
                >
                  🔴 Low Similarity (Unrelated)
                </button>
              </div>

              {/* Two Column Input Boxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                      Text A (e.g. User Query)
                    </label>
                  </div>
                  <textarea
                    rows={4}
                    value={textA}
                    onChange={(e) => setTextA(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-sans"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      Text B (e.g. Knowledge Chunk)
                    </label>
                  </div>
                  <textarea
                    rows={4}
                    value={textB}
                    onChange={(e) => setTextB(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-sans"
                  />
                </div>
              </div>

              {/* Compare Button */}
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleCompareTexts}
                  disabled={simLoading || !textA.trim() || !textB.trim()}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:opacity-95 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {simLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      Embedding &amp; Computing Cosine Distance...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Compute Semantic Similarity
                    </>
                  )}
                </button>
              </div>

              {/* Error Display */}
              {simError && (
                <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm">
                  {simError}
                </div>
              )}

              {/* Results Gauge & Visualization */}
              {similarityScore !== null && (
                <div className="mt-8 pt-8 border-t border-zinc-800">
                  <div className="max-w-xl mx-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-inner">
                    <span className="text-xs uppercase tracking-widest text-zinc-400 font-mono">
                      Cosine Similarity Score
                    </span>

                    <div className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 font-mono">
                      {(similarityScore * 100).toFixed(2)}%
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden p-0.5 border border-zinc-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(0, Math.min(100, similarityScore * 100))}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2 border-t border-zinc-800/80">
                      <div>
                        <span className="text-zinc-500 block">Raw Cosine:</span>
                        <span className="text-zinc-200 font-bold">{similarityScore.toFixed(6)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Euclidean Distance:</span>
                        <span className="text-zinc-200 font-bold">{euclideanDist?.toFixed(4)}</span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-400 pt-2">
                      {similarityScore > 0.75 ? (
                        <span className="text-emerald-400 font-medium">
                          🎯 High Semantic Overlap — Vector DB would rank Text B as a strong context match for Text A.
                        </span>
                      ) : similarityScore > 0.5 ? (
                        <span className="text-cyan-400 font-medium">
                          🔎 Moderate Match — Shares thematic vocabulary or contextual domain.
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-medium">
                          ⚪ Low Similarity — Distinct conceptual meanings with distant vector coordinates.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DOCUMENT CHUNKING SIMULATOR */}
        {activeTab === "chunking" && (
          <div className="space-y-6">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="max-w-3xl mb-6">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
                  Document Preprocessing &amp; Chunking
                </span>
                <h2 className="text-xl font-bold text-white">Chunking &amp; Ingestion Playground</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Split longer texts into overlapping segments, test them in the embedding engine, and save them straight into your PostgreSQL database.
                </p>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">
                    Chunk Size (Words): <strong className="text-indigo-400">{chunkSize}</strong>
                  </label>
                  <input
                    type="range"
                    min={20}
                    max={300}
                    step={10}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">
                    Chunk Overlap (Words): <strong className="text-cyan-400">{chunkOverlap}</strong>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
              </div>

              {/* Input Document */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300 block">Raw Document Text</label>
                <textarea
                  rows={5}
                  value={docText}
                  onChange={(e) => setDocText(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3 items-center justify-between">
                <button
                  type="button"
                  onClick={handleChunkDocument}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors"
                >
                  Generate Chunks
                </button>

                {chunks.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveAllChunksToDb}
                    disabled={batchSaving}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {batchSaving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        {batchProgress}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Save All {chunks.length} Chunks to PostgreSQL
                      </>
                    )}
                  </button>
                )}
              </div>

              {batchProgress && (
                <div className="mt-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 font-mono">
                  {batchProgress}
                </div>
              )}

              {/* Generated Chunks List */}
              {chunks.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Generated <strong>{chunks.length}</strong> Chunks</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {chunks.map((chunk, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-mono font-bold text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/20">
                              Chunk #{idx + 1}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {chunk.split(/\s+/).length} words
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed font-sans">{chunk}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setInputText(chunk);
                              setActiveTab("embedding");
                              handleGenerateEmbedding(chunk);
                            }}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                          >
                            Send to /api/embedding →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DATABASE EXPLORER (DOCUMENTS & DOCUMENT_CHUNKS) */}
        {activeTab === "database" && (
          <div className="space-y-6">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-2">
                    PostgreSQL Tables
                  </span>
                  <h2 className="text-xl font-bold text-white">Database Records Explorer</h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Direct view of records stored in <code className="text-zinc-300">documents</code> and <code className="text-zinc-300">document_chunks</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchDbDocuments}
                  disabled={dbLoading}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium border border-zinc-700 self-start sm:self-auto flex items-center gap-2"
                >
                  <svg className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Records
                </button>
              </div>

              {/* DB Connection Notice */}
              {dbError && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-2 mb-6">
                  <div className="font-semibold text-amber-400 flex items-center gap-2">
                    <span>⚠️</span> PostgreSQL Connection Notice
                  </div>
                  <p className="text-amber-200">{dbError}</p>
                  <p className="text-zinc-400">
                    To connect to your PostgreSQL database, specify your connection parameters in your <code className="text-zinc-200">.env</code> file:
                  </p>
                  <pre className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-[11px] text-zinc-300 font-mono">
                    DB_HOST="localhost"
                    DB_PORT=5432
                    DB_USER="postgres"
                    DB_PASSWORD="your_password"
                    DB_NAME="rag-system-db"
                  </pre>
                </div>
              )}

              {/* Documents Table */}
              <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-950 text-zinc-400 uppercase font-mono text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Document Name</th>
                      <th className="px-4 py-3">File Name</th>
                      <th className="px-4 py-3">Chunks</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {dbDocuments.length > 0 ? (
                      dbDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-zinc-100">
                            <div>{doc.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{doc.id}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-400">{doc.file_name}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                              {doc.chunk_count} chunks
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => loadDocumentDetail(doc.id)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                            >
                              View Chunks →
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-zinc-500">
                          {dbLoading ? "Loading records from database..." : "No documents saved yet. Enable 'Save to PostgreSQL Database' in Step 1 or batch-ingest from Step 3."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Document Detail Modal / Drawer */}
              {selectedDocDetail && (
                <div className="mt-8 pt-8 border-t border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Chunks for &ldquo;{selectedDocDetail.document.name}&rdquo;
                      </h3>
                      <p className="text-xs text-zinc-400 font-mono">
                        Document UUID: {selectedDocDetail.document.id} • {selectedDocDetail.chunks.length} chunks with vector(768)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDocDetail(null)}
                      className="text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Close ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedDocDetail.chunks.map((chunk) => (
                      <div key={chunk.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs space-y-2">
                        <div className="flex items-center justify-between text-zinc-500 font-mono text-[10px]">
                          <span className="text-indigo-400 font-bold">Chunk #{chunk.chunk_index}</span>
                          <span>{chunk.token_count ?? "~"} tokens</span>
                        </div>
                        <p className="text-zinc-200 leading-relaxed font-sans">{chunk.content}</p>
                        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                          <span>ID: {chunk.id.slice(0, 16)}...</span>
                          <span className="text-emerald-400">Embedding: vector(768)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: API CLIENT REFERENCE */}
        {activeTab === "docs" && (
          <div className="space-y-6">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
                  API Integration Guide
                </span>
                <h2 className="text-xl font-bold text-white">How to Query Your RAG Endpoints</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Use these ready-to-run snippets in terminal scripts, backend worker jobs, or Next.js server actions.
                </p>
              </div>

              {/* cURL Snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                  <span>cURL Command (With PostgreSQL Persistence)</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X POST http://localhost:3100/api/embedding \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "input": "Your knowledge text chunk",\n    "save_to_db": true,\n    "name": "Knowledge Document",\n    "file_name": "source.txt",\n    "chunk_index": 0\n  }'`,
                        "curl"
                      )
                    }
                    className="text-indigo-400 hover:text-indigo-300 text-xs"
                  >
                    {copiedType === "curl" ? "Copied!" : "Copy cURL"}
                  </button>
                </div>
                <pre className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto">
                  {`curl -X POST http://localhost:3100/api/embedding \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "Your knowledge text chunk",
    "save_to_db": true,
    "name": "Knowledge Document",
    "file_name": "source.txt",
    "chunk_index": 0
  }'`}
                </pre>
              </div>

              {/* JavaScript / TypeScript Fetch */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                  <span>JavaScript / TypeScript (fetch)</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `const res = await fetch("/api/embedding", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    input: "What is RAG?",\n    save_to_db: true,\n    name: "RAG Documentation"\n  })\n});\nconst { dimension, embeddings, saved } = await res.json();\nconsole.log("Vector dimension:", dimension);\nconsole.log("Saved Document ID:", saved?.document?.id);`,
                        "fetch"
                      )
                    }
                    className="text-indigo-400 hover:text-indigo-300 text-xs"
                  >
                    {copiedType === "fetch" ? "Copied!" : "Copy JS"}
                  </button>
                </div>
                <pre className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto">
                  {`const res = await fetch("/api/embedding", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    input: "What is RAG?",
    save_to_db: true,
    name: "RAG Documentation"
  })
});
const { dimension, embeddings, saved } = await res.json();
console.log("Vector dimension:", dimension);
console.log("Saved Document ID:", saved?.document?.id);`}
                </pre>
              </div>

              {/* Database Schema Reference */}
              <div className="space-y-2 pt-2">
                <div className="text-xs text-zinc-400 font-medium">PostgreSQL Schema Reference</div>
                <pre className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-400 overflow-x-auto">
                  {`-- 1. documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    storage_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. document_chunks table with pgvector
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768),
    chunk_index INTEGER NOT NULL,
    page_number INTEGER,
    token_count INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
