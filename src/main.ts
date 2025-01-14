import axios from 'axios';
import { config } from './config';
import { SearchResult } from './types';

class RAGFusion {
  private readonly openaiApiKey: string;
  private readonly model: string;

  constructor() {
    this.openaiApiKey = config.openai.apiKey;
    this.model = config.openai.model;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: text,
          model: 'text-embedding-ada-002',
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

  // We'll implement these methods next
  async reciprocalRankFusion(results: SearchResult[][]): Promise<SearchResult[]> {
    // Implementation coming soon
    return [];
  }

  async searchWithQuery(query: string): Promise<SearchResult[]> {
    // Implementation coming soon
    return [];
  }
}

// Example usage
async function main() {
  try {
    const ragFusion = new RAGFusion();
    const query = "What is RAG Fusion?";
    const results = await ragFusion.searchWithQuery(query);
    console.log('Search results:', results);
  } catch (error) {
    console.error('Error in main:', error);
  }
}

if (require.main === module) {
  main();
}

export default RAGFusion; 