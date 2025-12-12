const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Dynamic import for transformers (ESM module)
const getPipeline = async () => {
    const { pipeline } = await import('@xenova/transformers');
    return pipeline;
};

let embeddingPipeline = null;

async function ingestDocs() {
    console.log("🚀 Starting ingestion process (Local Embeddings + Groq Generation)...");

    // Load embedding model
    if (!embeddingPipeline) {
        console.log("📥 Loading local embedding model (Xenova/all-MiniLM-L6-v2)...");
        const pipeline = await getPipeline();
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    // 1. Load knowledge base files
    const knowledgeDir = path.join(__dirname, 'knowledge');
    const files = fs.readdirSync(knowledgeDir).filter(file => file.endsWith('.md'));

    let allDocs = [];
    for (const file of files) {
        const filePath = path.join(knowledgeDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        allDocs.push({
            pageContent: content,
            metadata: { source: file }
        });
        console.log(`📄 Loaded: ${file}`);
    }

    // 2. Split documents
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50
    });

    const chunks = [];
    for (const doc of allDocs) {
        const split = await splitter.splitText(doc.pageContent);
        split.forEach(text => {
            chunks.push({
                content: text,
                metadata: doc.metadata
            });
        });
    }

    console.log(`✂️  Split into ${chunks.length} chunks.`);

    // 3. Generate embeddings and insert
    console.log("🧠 Generating embeddings and saving to Supabase...");

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Generate embedding locally
        const output = await embeddingPipeline(chunk.content, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        // Insert into Supabase
        const { error } = await supabase
            .from('documents')
            .insert({
                content: chunk.content,
                metadata: chunk.metadata,
                embedding: embedding
            });

        if (error) {
            console.error(`❌ Error inserting chunk ${i + 1}:`, error);
        } else {
            process.stdout.write('.');
        }
    }

    console.log('\n✅ Ingestion complete!');
}

ingestDocs().catch(console.error);
