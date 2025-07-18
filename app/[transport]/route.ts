import { createMcpHandler } from '@vercel/mcp-adapter';
import { OpenAI } from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod.mjs';
import { InkeepAnalytics } from '@inkeep/inkeep-analytics';
import type { CreateOpenAIConversation, Messages, UserProperties } from '@inkeep/inkeep-analytics/models/components';

// https://docs.inkeep.com/ai-api/rag-mode/openai-sdk
const InkeepRAGDocumentSchema = z
  .object({
    // anthropic fields citation types
    type: z.string(),
    source: z.record(z.any()),
    title: z.string().nullish(),
    context: z.string().nullish(),
    // inkeep specific fields
    record_type: z.string().nullish(),
    url: z.string().nullish(),
  })
  .passthrough();

const InkeepRAGResponseSchema = z
  .object({
    content: z.array(InkeepRAGDocumentSchema),
  })
  .passthrough();

async function logToInkeepAnalytics({
  messagesToLogToAnalytics,
  properties,
  userProperties,
}: {
  messagesToLogToAnalytics: Messages[];
  properties?: { [k: string]: any } | null | undefined;
  userProperties?: UserProperties | null | undefined;
}): Promise<void> {
  try {
    const apiIntegrationKey = process.env.INKEEP_API_KEY;

    const inkeepAnalytics = new InkeepAnalytics({ apiIntegrationKey });

    const logConversationPayload: CreateOpenAIConversation = {
      type: 'openai',
      messages: messagesToLogToAnalytics,
      userProperties,
      properties,
    };

    await inkeepAnalytics.conversations.log(
      {
        apiIntegrationKey,
      },
      logConversationPayload,
    );
  } catch (err) {
    console.error('Error logging conversation', err);
  }
}

const handler = createMcpHandler(
  async server => {
    // QA tool
    const INKEEP_PRODUCT_SLUG = 'inkeep';
    const INKEEP_PRODUCT_NAME = 'Inkeep';

    // Create tool names and descriptions with parameters
    const qaToolName = `ask-question-about-${INKEEP_PRODUCT_SLUG}`;
    const qaToolDescription = `Use this tool to ask a question about ${INKEEP_PRODUCT_NAME} to an AI Support Agent that is knowledgeable about ${INKEEP_PRODUCT_NAME}. Use this tool to ask specific troubleshooting, feature capability, or conceptual questions. Be specific and provide the minimum context needed to address your question in full`;

    const ragToolName = `search-${INKEEP_PRODUCT_SLUG}-docs`;
    const ragToolDescription = `Use this tool to do a semantic search for reference content related to ${INKEEP_PRODUCT_NAME}. The results provided will be extracts from documentation sites and other public sources like GitHub. The content may not fully answer your question -- be circumspect when reviewing and interpreting these extracts before using them in your response.`;

    if (!process.env.INKEEP_API_KEY) return { content: [] };

    const openai = new OpenAI({ baseURL: process.env.INKEEP_API_BASE_URL || 'https://api.inkeep.com/v1', apiKey: process.env.INKEEP_API_KEY });

    server.tool(
      qaToolName,
      qaToolDescription,
      { question: z.string().describe('Question about the product') },
      {
        title: `Ask AI about ${INKEEP_PRODUCT_NAME}`,
        readOnlyHint: true,
        openWorldHint: true,
      },
      async ({ question }: { question: string }) => {
        try {
          const qaModel = 'inkeep-qa-expert';

          const response = await openai.chat.completions.create({
            model: qaModel,
            messages: [{ role: 'user', content: question }],
          });

          const qaResponse = response.choices?.[0]?.message?.content;

          if (qaResponse) {
            await logToInkeepAnalytics({
              properties: {
                tool: qaToolName,
              },
              messagesToLogToAnalytics: [
                { role: 'user', content: question },
                { role: 'assistant', content: qaResponse },
              ],
            });

            return {
              content: [
                {
                  type: 'text' as const,
                  text: qaResponse,
                },
              ],
            };
          }

          return { content: [] };
        } catch (error) {
          console.error('Error getting QA response:', error);
          return { content: [] };
        }
      },
    );

    server.tool(
      ragToolName,
      ragToolDescription,
      {
        query: z.string().describe('The search query to find relevant documentation'),
      },
      {
        title: `Search ${INKEEP_PRODUCT_NAME} Documentation`,
        readOnlyHint: true,
        openWorldHint: true,
      },
      async ({ query }: { query: string }) => {
        try {
          const ragModel = 'inkeep-rag';

          const response = await openai.chat.completions.parse({
            model: ragModel,
            messages: [{ role: 'user', content: query }],
            response_format: zodResponseFormat(InkeepRAGResponseSchema, 'InkeepRAGResponseSchema'),
          });

          const parsedResponse = response.choices[0].message.parsed;
          if (parsedResponse) {
            const links = parsedResponse.content
              .filter(x => x.url)
              .map(x => `- [${x.title || x.url}](${x.url})`)
              .join('\n') || '';

            await logToInkeepAnalytics({
              properties: {
                tool: ragToolName
              },
              messagesToLogToAnalytics: [{ role: "user", content: query }, { role: "assistant", content: links }],
            });

            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(parsedResponse),
                },
              ],
            };
          }

          // If no response, return empty array
          return { content: [] };
        } catch (error) {
          console.error('Error retrieving product docs:', error);
          return { content: [] };
        }
      },
    );
  },
  {
    // optional server options
  },
  {
    basePath: '',
    verboseLogs: true,
    maxDuration: 300,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
