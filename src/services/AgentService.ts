// @ts-nocheck
import { SystemSetting, AIAuditLog } from '../models';
import { CrawlerService } from './CrawlerService';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export class AgentService {
  static async generateReply(tweetText: string): Promise<string> {
    let activeLlm = 'unknown';
    let modelName = 'unknown';
    let fullPrompt = '';
    
    try {
      // 1. Get Settings
      const settings = await SystemSetting.findAll();
      const config = settings.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});

      activeLlm = config.active_llm || 'anthropic';
      let model;

      // 2. Initialize LLM
      if (activeLlm === 'openai') {
        if (!config.openai_key) throw new Error('OpenAI API key missing');
        modelName = 'gpt-4o-mini';
        model = new ChatOpenAI({ openAIApiKey: config.openai_key, modelName, temperature: 0.2 });
      } else if (activeLlm === 'gemini') {
        if (!config.gemini_key) throw new Error('Gemini API key missing');
        modelName = 'gemini-3.5-flash';
        model = new ChatGoogleGenerativeAI({ apiKey: config.gemini_key, model: modelName, temperature: 0.2 });
      } else {
        if (!config.anthropic_key) throw new Error('Anthropic API key missing');
        modelName = 'claude-3-5-sonnet-20240620';
        model = new ChatAnthropic({ anthropicApiKey: config.anthropic_key, modelName, temperature: 0.2 });
      }

      // 3. Search Vector Database
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
      const knowledgeMode = config.ai_knowledge_mode || 'STRICT';
      const toneMode = config.ai_tone || 'PROFESSIONAL';
      
      let toneInstruction = 'Keep the tone strictly professional, helpful, and accessible.';
      if (toneMode === 'CASUAL') {
        toneInstruction = 'Keep the tone friendly, casual, and highly conversational. Use emojis naturally.';
      } else if (toneMode === 'SASSY') {
        toneInstruction = 'Keep the tone helpful, BUT if the user is nagging, complaining unfairly, or being annoying, you have full permission to playfully troll them, be sassy, or give a witty comeback.';
      }

      let instructions = '';
      if (knowledgeMode === 'STRICT') {
        instructions = `1. Answer the user's question using ONLY the facts provided in the KNOWLEDGE BASE CONTEXT.
2. If the answer is not in the context, politely state that you do not have that specific information right now.
3. Do not invent, assume, or hallucinate any facts or numbers.
4. ${toneInstruction}`;
      } else {
        instructions = `1. Prioritize answering the user's question using the facts provided in the KNOWLEDGE BASE CONTEXT.
2. If the answer is not in the provided context, you may use your general world knowledge to answer the question (e.g. general facts, history, science).
3. Do not invent or hallucinate company-specific facts or numbers that should be in the knowledge base.
4. ${toneInstruction}`;
      }

      const systemPrompt = `You are VipiBot, a helpful, professional, and factual assistant.
Your goal is to reply to a user's message.
Keep your response concise (under 280 characters if possible) and highly relevant.

KNOWLEDGE BASE CONTEXT:
${contextText ? contextText : 'No relevant company information found in context.'}

INSTRUCTIONS:
${instructions}`;

      fullPrompt = `SYSTEM: ${systemPrompt}\n\nUSER: ${tweetText}`;

      const response = await model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: tweetText }
      ]);

      const responseText = response.content.toString();

      // Log Success
      await AIAuditLog.create({
        provider: activeLlm.toUpperCase(),
        modelUsed: modelName,
        promptText: fullPrompt,
        responseText: responseText,
        status: 'SUCCESS'
      });

      return responseText;
      
    } catch (error: any) {
      console.error('AgentService Error:', error);
      
      const errorMessage = error?.message || String(error);
      
      // Log Error
      await AIAuditLog.create({
        provider: activeLlm.toUpperCase(),
        modelUsed: modelName,
        promptText: fullPrompt || tweetText,
        status: 'ERROR',
        errorMessage: errorMessage
      }).catch(e => console.error("Failed to write to AIAuditLog", e));

      // Handle friendly rate limit and billing messages
      if (errorMessage.includes('credit balance is too low') || errorMessage.includes('insufficient_quota')) {
        throw new Error('AI Billing Error: Your API account has run out of credits. Please add funds to your Anthropic/OpenAI/Gemini account to continue.');
      }
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('Quota exceeded')) {
        throw new Error('AI Rate Limit Exceeded: You have hit the API quota for this provider. Please wait a moment or check your API billing details.');
      }
      
      if (errorMessage.includes('API key missing')) {
        throw error; // keep this clear
      }

      throw new Error(`AI generation failed: ${errorMessage.substring(0, 100)}... Check logs for details.`);
    }
  }
}
