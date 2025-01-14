import axios from 'axios';
import { config } from './config';
import { SearchResult } from './types';
import { PineconeClient } from './services/pinecone';
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";

class RAGFusion {
  private readonly openaiApiKey: string;
  private readonly model: string;
  private readonly pinecone: PineconeClient;

  constructor() {
    this.openaiApiKey = config.openai.apiKey;
    this.model = config.openai.model;
    this.pinecone = new PineconeClient();
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text,
          model: 'text-embedding-3-large',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async searchWithQuery(query: string): Promise<SearchResult[]> {
    try {
      // console.log("\nExecuting search for query:", query);
      const queryEmbedding = await this.generateEmbedding(query);
      // console.log(`Generated query embedding of length ${queryEmbedding.length}`);

      const results = await this.pinecone.vectorSearch(queryEmbedding, 'primary', 5);
      // console.log(`Found ${results.length} results from Pinecone`);
      // console.log("Top result:", results[0]);

      return results;
    } catch (error) {
      console.error('Error in searchWithQuery:', error);
      throw error;
    }
  }

  async generateHypotheticalQuestions(query: string): Promise<string[]> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages: [{
            role: 'user',
            content: `Generate 3 hypothetical questions that are relevant to understanding: "${query}". 
                     Return only the questions, one per line, no numbering or prefixes.`
          }],
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0].message.content;
      return content.split('\n').filter((q: string) => q.trim().length > 0);
    } catch (error) {
      console.error('Error generating questions:', error);
      throw error;
    }
  }

  async searchWithHypothetical(query: string): Promise<SearchResult[]> {
    try {
      // Generate hypothetical questions
      const questions = await this.generateHypotheticalQuestions(query);
      
      // Search with original query and all hypothetical questions
      const searchPromises = [query, ...questions].map(q => 
        this.searchWithQuery(q)
      );

      const allResults = await Promise.all(searchPromises);
      
      // Combine all results using RRF
      return this.reciprocalRankFusion(allResults);
    } catch (error) {
      console.error('Error in searchWithHypothetical:', error);
      throw error;
    }
  }

  async addDocuments(documents: string[]): Promise<void> {
    const embeddings = new OpenAIEmbeddings();
    // console.log("Creating embeddings for documents:", documents);
    
    // Generate embeddings for all documents
    // console.log("Starting embedding generation...");
    const vectors = await Promise.all(documents.map(async (doc, i) => {
      // console.log(`Generating embedding for document ${i}: "${doc.substring(0, 50)}..."`);
      const embedding = await this.generateEmbedding(doc);
      // console.log(`Generated embedding of length ${embedding.length} for document ${i}`);
      return {
        id: i.toString(),
        values: embedding,
        metadata: { text: doc }
      };
    }));
    
    // console.log(`Generated ${vectors.length} embeddings, upserting to Pinecone...`);
    // console.log("First vector sample:", {
    //   id: vectors[0].id,
    //   valuesLength: vectors[0].values.length,
    //   metadata: vectors[0].metadata
    // });
    await this.pinecone.upsertVectors(vectors, 'primary');
    // console.log("Document upload complete");
  }

  private async reciprocalRankFusion(resultSets: SearchResult[][]): Promise<SearchResult[]> {
    const k = 60;
    const scores: Map<string, number> = new Map();
    
    resultSets.forEach(results => {
      results.forEach((result, rank) => {
        const rrf_score = 1 / (k + rank + 1);
        const currentScore = scores.get(result.id) || 0;
        scores.set(result.id, currentScore + rrf_score);
      });
    });

    const uniqueResults = new Map<string, SearchResult>();
    resultSets.flat().forEach(result => {
      if (!uniqueResults.has(result.id)) {
        uniqueResults.set(result.id, result);
      }
    });

    return Array.from(uniqueResults.values())
      .map(result => ({
        ...result,
        score: scores.get(result.id) || 0,
      }))
      .sort((a, b) => b.score - a.score);
  }
}

// Example usage
async function main() {
  try {
    const ragFusion = new RAGFusion();
    
    // First, let's add some test documents
    const documents = [
      "Climate change and economic impact.",
      "Public health concerns due to climate change.",
      "Climate change: A social perspective.",
      "Technological solutions to climate change.",
      "Policy changes needed to combat climate change.",
      "Climate change and its impact on biodiversity.",
      "Climate change: The science and models.",
      "Global warming: A subset of climate change.",
      "How climate change affects daily weather.",
      "The history of climate change activism."
    ];

    // console.log("Adding documents...");
    await ragFusion.addDocuments(documents);

    const query = "What are the economic effects of climate change?";
    
    console.log("\nRegular search results:");
    const regularResults = await ragFusion.searchWithQuery(query);
    console.log(regularResults);

    console.log("\nHypothetical questions search results:");
    const hypotheticalResults = await ragFusion.searchWithHypothetical(query);
    console.log(hypotheticalResults);
  } catch (error) {
    console.error('Error in main:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default RAGFusion; 