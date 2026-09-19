import { Ollama } from "ollama";

const ollama = new Ollama({
    host: process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434",
});

export async function createEmbeddings(input: string) {
    try {
        const response = await ollama.embeddings({
            model: "nomic-embed-text",
            prompt: input,
        });
        return response.embedding;
    } catch (error) {
        throw new Error(
            "Unable to connect to Ollama. Start Ollama and run " +
            '"ollama pull nomic-embed-text", or set OLLAMA_HOST to its URL.',
            { cause: error },
        );
    }
};

