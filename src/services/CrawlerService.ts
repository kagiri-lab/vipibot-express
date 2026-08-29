// @ts-nocheck
import { KnowledgeDocument } from '../models';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import pdfParse from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
// @ts-nocheck
import { pipeline } from '@xenova/transformers';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { QdrantVectorStore } from '@langchain/qdrant';
import { SystemSetting } from '../models';

export class CrawlerService {
  private static extractor: any = null;
  private static vectorStore: HNSWLib | null = null;
  private static readonly VECTOR_STORE_DIR = path.join(process.cwd(), 'vector_store');

  static async init() {
    if (!this.extractor) {
      console.log('Loading Xenova embeddings model...');
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
         quantized: true,
      });
      console.log('Embeddings model loaded.');
    }

    if (!fs.existsSync(this.VECTOR_STORE_DIR)) {
      fs.mkdirSync(this.VECTOR_STORE_DIR, { recursive: true });
    }
  }

  // Very basic embedding function wrapping Transformers.js for LangChain compatibility
  static clearVectorStoreCache() {
    this.vectorStore = null;
    console.log('Cleared Vector Store in-memory cache.');
  }

  static async embedTexts(texts: string[]): Promise<number[][]> {
    await this.init();
    const embeddings = [];
    for (const text of texts) {
      const output = await this.extractor(text, { pooling: 'mean', normalize: true });
      embeddings.push(Array.from(output.data));
    }
    return embeddings;
  }

  
  static async getVectorStoreInstance(mockEmbeddings: any, chunks: string[] = [], metadatas: any[] = []) {
    const providerSetting = await SystemSetting.findOne({ where: { key: 'vector_db_provider' } });
    const provider = providerSetting?.value || 'HNSWLIB';

    if (provider === 'QDRANT') {
      const urlSetting = await SystemSetting.findOne({ where: { key: 'qdrant_url' } });
      const url = urlSetting?.value || 'http://localhost:6333';
      
      console.log(`Connecting to Qdrant at ${url}...`);
      
      if (chunks.length === 0) {
        return await QdrantVectorStore.fromExistingCollection(mockEmbeddings, {
          url: url,
          collectionName: "vipi_knowledge",
        });
      } else {
        return await QdrantVectorStore.fromTexts(
          chunks,
          metadatas,
          mockEmbeddings,
          {
            url: url,
            collectionName: "vipi_knowledge",
          }
        );
      }
    } else {
      // HNSWLIB
      if (!this.vectorStore && fs.existsSync(this.VECTOR_STORE_DIR)) {
        console.log('Loading HNSWLib from disk...');
        this.vectorStore = await HNSWLib.load(this.VECTOR_STORE_DIR, mockEmbeddings);
      }

      if (chunks.length > 0) {
        if (this.vectorStore) {
          await this.vectorStore.addDocuments(
            chunks.map((pageContent, idx) => ({ pageContent, metadata: metadatas[idx] }))
          );
        } else {
          this.vectorStore = await HNSWLib.fromTexts(chunks, metadatas, mockEmbeddings);
        }
        await this.vectorStore.save(this.VECTOR_STORE_DIR);
        return this.vectorStore;
      }
      return this.vectorStore;
    }
  }

  static async runCrawlingJob() {

    console.log('Running Crawler Job...');
    try {
      const pendingDocs = await KnowledgeDocument.findAll({
        where: { status: 'PENDING' },
        limit: 5 // Process 5 at a time
      });

      if (pendingDocs.length === 0) return;

      await this.init();
      

      for (const doc of pendingDocs) {
        await doc.update({ status: 'CRAWLING' });
        
        try {
          let text = '';
          
          if (doc.url.startsWith('local://')) {
             const filePath = doc.url.replace('local://', '');
             if (!fs.existsSync(filePath)) throw new Error('File not found');
             
             const ext = path.extname(filePath).toLowerCase();
             if (ext === '.pdf') {
               const dataBuffer = fs.readFileSync(filePath);
               const data = await pdfParse(dataBuffer);
               text = data.text;
             } else if (ext === '.txt') {
               text = fs.readFileSync(filePath, 'utf8');
             } else {
               throw new Error('Unsupported file type');
             }
          } else {
             // Fetch URL
             const response = await fetch(doc.url);
             if (!response.ok) throw new Error(`HTTP ${response.status}`);
             const html = await response.text();
             const $ = cheerio.load(html);
             $('script, style, nav, footer, header').remove();
             text = $('body').text().replace(/\s+/g, ' ').trim();
          }

          if (!text || text.length < 50) {
            throw new Error('Not enough text extracted');
          }

          // Chunk text
          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
          });
          const chunks = await splitter.splitText(text);
          const metadatas = chunks.map(c => ({ source: doc.url, title: doc.title }));

          const mockEmbeddings = {
            embedDocuments: async (texts: string[]) => this.embedTexts(texts),
            embedQuery: async (text: string) => (await this.embedTexts([text]))[0]
          };

          await this.getVectorStoreInstance(mockEmbeddings, chunks, metadatas);
          
          await doc.update({ 
            status: 'INDEXED', 
            lastIndexedAt: new Date() 
          });
          
          console.log(`Successfully indexed ${doc.url}`);
        } catch (err: any) {
          console.error(`Failed to index ${doc.url}:`, err.message);
          await doc.update({ status: 'FAILED' });
        }
      }

    } catch (error) {
      console.error('Crawler Job Error:', error);
    }
  }
}
