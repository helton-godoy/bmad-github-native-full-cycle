#!/usr/bin/env node
/**
 * scripts/search-memory.js
 * Searches the Qdrant vector database for semantic context.
 * Usage: node scripts/search-memory.js "authentication rules"
 */

const QDRANT_URL = 'http://localhost:6333';
const COLLECTION_NAME = 'bmad_agent_memory';

// Mock embedding (Must match the one in agent-doc.js for this demo)
function mockEmbedding(text) {
    const vector = new Array(384).fill(0);
    for (let i = 0; i < text.length; i++) {
        vector[i % 384] = (vector[i % 384] + text.charCodeAt(i)) / 255;
    }
    return vector;
}

async function search(query) {
    try {
        const vector = mockEmbedding(query);
        const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vector: vector,
                limit: 5,
                with_payload: true
            })
        });

        const data = await response.json();

        if (data.result) {
            console.log(`\n🔍 Results for "${query}":\n`);
            data.result.forEach(hit => {
                const p = hit.payload;
                console.log(`[${p.type.toUpperCase()}] ${p.file}`);
                console.log(`   ${p.content}`);
                console.log(`   (Score: ${hit.score.toFixed(4)})\n`);
            });
        } else {
            console.log("No results found.");
        }

    } catch (e) {
        console.error("Search failed:", e.message);
    }
}

const query = process.argv[2];
if (!query) {
    console.log("Usage: npm run bmad:search 'your query here'");
    process.exit(1);
}

search(query);
