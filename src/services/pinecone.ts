import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config';
import { PineconeDocument, PineconeSearchResult, PineconeService } from '../types';

export class PineconeClient {
  private client: Pinecone;
  private readonly services: Record<string, PineconeService>;

  constructor() {
    this.client = new Pinecone({
      apiKey: config.pinecone.apiKey,
    });

    this.services = {
      primary: { index: config.pinecone.indexName }
    };
  }

  private getIndex(serviceName: 'primary' | 'secondary') {
    const service = this.services[serviceName];
    return this.client.index(service.index);
  }

  async vectorSearch(
    embeddings: number[],
    serviceName: 'primary' | 'secondary',
    topK: number = 5
  ): Promise<PineconeSearchResult[]> {
    try {
      // console.log(`\nSearching Pinecone index "${this.services[serviceName].index}" with topK=${topK}`);
      const index = this.getIndex(serviceName);
      
      const queryResponse = await index.query({
        vector: embeddings,
        topK,
        includeMetadata: true,
        includeValues: true,
      });

      // console.log("Query parameters:", {
      //   vectorLength: embeddings.length,
      //   topK,
      //   indexName: this.services[serviceName].index
      // });
      
      if (queryResponse.matches.length === 0) {
        // console.log("No matches found. Checking index stats...");
        // const stats = await index.describeIndexStats();
        // console.log("Index stats:", stats);
      }

      return queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score ?? 0,
        content: String(match.metadata?.text || ''),
        metadata: match.metadata || {},
      }));
    } catch (error) {
      console.error(`Error in vectorSearch (${serviceName}):`, error);
      throw error;
    }
  }

  async upsertVectors(
    documents: PineconeDocument[],
    serviceName: 'primary' | 'secondary'
  ): Promise<void> {
    try {
      // console.log(`\nUpserting ${documents.length} vectors to Pinecone index "${this.services[serviceName].index}"`);
      // console.log("First document sample:", {
      //   id: documents[0].id,
      //   valuesLength: documents[0].values.length,
      //   metadata: documents[0].metadata
      // });
      const index = this.getIndex(serviceName);
      
      await index.upsert(
        documents.map(doc => ({
          id: doc.id,
          values: doc.values,
          metadata: doc.metadata,
        }))
      );
      // console.log("Upsert to Pinecone complete");
    } catch (error) {
      console.error(`Error in upsertVectors (${serviceName}):`, error);
      throw error;
    }
  }
} 