// @ts-nocheck
import { SystemSetting } from '../models';
import { CrawlerService } from './CrawlerService';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export class AgentService {
  static async generateReply(tweetText: string): Promise<string> {
    try {
      // 1. Get Settings
      const settings = await SystemSetting.findAll();
      const config = settings.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});

      const activeLlm = config.active_llm || 'anthropic';
      let model;

      // 2. Initialize LLM
      if (activeLlm === 'openai') {
        if (!config.openai_key) throw new Error('OpenAI API key missing');
        model = new ChatOpenAI({ openAIApiKey: config.openai_key, modelName: 'gpt-4o-mini', temperature: 0.2 });
      } else if (activeLlm === 'gemini') {
        if (!config.gemini_key) throw new Error('Gemini API key missing');
        model = new ChatGoogleGenerativeAI({ apiKey: config.gemini_key, model: 'gemini-3.5-flash', temperature: 0.2 });
      } else {
        if (!config.anthropic_key) throw new Error('Anthropic API key missing');
        model = new ChatAnthropic({ anthropicApiKey: config.anthropic_key, modelName: 'claude-3-5-sonnet-20240620', temperature: 0.2 });
      }

      // 3. Search Vector Database
      // Create mock embeddings just to instantiate the client to fetch search results
      const mockEmbeddings = {
        embedDocuments: async (texts: string[]) => CrawlerService.embedTexts(texts),
        embedQuery: async (text: string) => (await CrawlerService.embedTexts([text]))[0]
      };
      
      const vectorStore = await CrawlerService.getVectorStoreInstance(mockEmbeddings);
      let contextText = '';
      
      if (vectorStore) {
        const results = await vectorStore.similaritySearch(tweetText, 3);
        contextText = results.map((r: any) => `Source: ${r.metadata.source}\n${r.pageContent}`).join('\n\n');
      }

      // 4. Generate Response
      const systemPrompt = `You are VipiBot, a helpful, professional, and factual assistant.
Your goal is to reply to a user's message.
Keep your response concise (under 280 characters if possible) and highly relevant.

KNOWLEDGE BASE CONTEXT:
${contextText ? contextText : 'No relevant information found.'}

INSTRUCTIONS:
1. Answer the user's question using ONLY the facts provided in the KNOWLEDGE BASE CONTEXT.
2. If the answer is not in the context, politely state that you do not have that specific information right now.
3. Do not invent, assume, or hallucinate any facts or numbers.
4. Keep the tone professional but accessible.`;

      const response = await model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: tweetText }
      ]);

      return response.content.toString();
    } catch (error) {
      console.error('AgentService Error:', error);
      throw error;
    }
  }
}
