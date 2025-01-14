import dotenv from 'dotenv';
import { AppConfig } from './types';

dotenv.config();

export const config: AppConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-3.5-turbo',
  },
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY || '',
    indexName: process.env.PINECONE_INDEX || '',
    indexNameTwo: process.env.PINECONE_INDEX_TWO || '',
  },
  langchain: {
    apiKey: process.env.LANGCHAIN_API_KEY || '',
    project: process.env.LANGCHAIN_PROJECT || '',
    tracingV2: process.env.LANGCHAIN_TRACING_V2 === 'true',
  },
};

// Validate configuration
const validateConfig = () => {
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_INDEX',
    'PINECONE_INDEX_TWO',
    'LANGCHAIN_API_KEY',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
};

validateConfig(); 