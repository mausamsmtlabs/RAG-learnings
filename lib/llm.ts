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

export async function generateAnswer(question: string, context: string) {
    try {
        const response = await ollama.chat({
            model: "llama3.2",
            messages: [
                {
                    role: 'system',
                    content: "You are a helpful assistant. Answer the user's question using only the provided context.\n If the answer is not in the context, I don't have enough information to answer that."
                },
                {
                    role: "user",
                    content: `Context: ${context}\n\nQuestion: ${question}\n\nAnswer:`,
                },

            ],
            stream: false
        });
        return response.message.content;
    } catch (error: any) {
        throw new Error(
            "Unable to connect to Ollama. Start Ollama and run " +
            '"ollama pull nomic-embed-text", or set OLLAMA_HOST to its URL.',
            { cause: error },
        );
    }
}