import { InkeepAnalytics } from '@inkeep/inkeep-analytics';
import type { CreateOpenAIConversation, Messages, UserProperties } from '@inkeep/inkeep-analytics/models/components';
import { createMcpHandler } from 'mcp-handler';
import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import * as z from 'zod';

const INKEEP_QA_MODEL = 'inkeep-qa-expert';
const INKEEP_RAG_MODEL = 'inkeep-rag';

// https://docs.inkeep.com/ai-api/rag-mode/openai-sdk
const InkeepRAGContentBlockSchema = z.object({
  type: z.string().describe('Type of content (text, image, video, etc.)'),
  text: z.string().describe('The actual text content'),
});

const InkeepRAGDocumentSchema = z.looseObject({
  // anthropic fields citation types
  type: z.string(),
  source: z.object({
    content: z
      .array(InkeepRAGContentBlockSchema)
      .describe('Array of structured content blocks extracted from the document'),
    type: z.string(),
  }),
  title: z.string().nullish().describe('Title of the source document'),
  context: z.string().nullish(),
  // inkeep specific fields
  record_type: z.string().nullish().describe('Type of record (documentation, blog, guide, etc.)'),
  url: z.string().nullish().describe('URL of the source document'),
});

const InkeepRAGResponseSchema = z.looseObject({
  content: z.array(InkeepRAGDocumentSchema),
});

const qaToolInputSchema = { question: z.string().describe('Question about the product') };
const ragToolInputSchema = {
  query: z.string().describe('The search query to find relevant documentation from the knowledge base'),
};

function extractApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

function getInkeepApiKey(request: Request): string | null {
  return extractApiKeyFromRequest(request) || process.env.INKEEP_API_KEY || null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toolError(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

async function logToInkeepAnalytics({
  apiIntegrationKey,
  messagesToLogToAnalytics,
  properties,
  userProperties,
}: {
  apiIntegrationKey: string;
  messagesToLogToAnalytics: Messages[];
  properties?: Record<string, unknown> | null | undefined;
  userProperties?: UserProperties | null | undefined;
}): Promise<void> {
  try {
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

function createHandlerWithCredentials(request: Request) {
  const inkeepApiKey = getInkeepApiKey(request);

  if (!inkeepApiKey) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Missing Inkeep API key. Set INKEEP_API_KEY or send header Authorization: Bearer <INKEEP_API_KEY>.',
        },
      }),
      { status: 401 },
    );
  }

  return createMcpHandler(
    async server => {
      const qaToolName = 'ask-question';
      const qaToolTitle = 'Ask Question';
      const qaToolDescription =
        'Use this tool to ask an AI Support Agent a question about the product. You can ask about specific troubleshooting, feature capability, or conceptual questions. Be specific and provide sufficient context needed to address your question in full.';

      const ragToolName = 'search-knowledge-base';
      const ragToolTitle = 'Search Knowledge Base';
      const ragToolDescription =
        'Use this tool to do a semantic search for reference content related to the product. The results provided will be extracts from the knowledge base. The content may not fully answer your question -- be circumspect when reviewing and interpreting these extracts before using them in your response.';

      const openai = new OpenAI({
        baseURL: process.env.INKEEP_API_BASE_URL || 'https://api.inkeep.com/v1',
        apiKey: inkeepApiKey,
      });

      server.registerTool(
        qaToolName,
        {
          title: qaToolTitle,
          description: qaToolDescription,
          inputSchema: qaToolInputSchema,
          annotations: {
            readOnlyHint: true,
            openWorldHint: true,
          },
        },
        async ({ question }: { question: string }) => {
          try {
            const response = await openai.chat.completions.create({
              model: INKEEP_QA_MODEL,
              messages: [{ role: 'user', content: question }],
            });

            const qaResponse = response.choices?.[0]?.message?.content;

            if (qaResponse) {
              await logToInkeepAnalytics({
                apiIntegrationKey: inkeepApiKey,
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

            return toolError('ask-question returned an empty response.');
          } catch (error) {
            console.error('ask-question tool failed:', error);
            return toolError(`${qaToolName} failed: ${getErrorMessage(error)}`);
          }
        },
      );

      server.registerTool(
        ragToolName,
        {
          title: ragToolTitle,
          description: ragToolDescription,
          inputSchema: ragToolInputSchema,
          annotations: {
            readOnlyHint: true,
            openWorldHint: true,
          },
        },
        async ({ query }: { query: string }) => {
          try {
            const response = await openai.chat.completions.parse({
              model: INKEEP_RAG_MODEL,
              messages: [{ role: 'user', content: query }],
              response_format: zodResponseFormat(InkeepRAGResponseSchema, 'InkeepRAGResponseSchema'),
            });

            const parsedResponse = response.choices[0].message.parsed;
            if (parsedResponse) {
              const links =
                parsedResponse.content
                  .filter(x => x.url)
                  .map(x => `- [${x.title || x.url}](${x.url})`)
                  .join('\n') || '';

              await logToInkeepAnalytics({
                apiIntegrationKey: inkeepApiKey,
                properties: {
                  tool: ragToolName,
                },
                messagesToLogToAnalytics: [
                  { role: 'user', content: query },
                  { role: 'assistant', content: links },
                ],
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

            return toolError('search-knowledge-base tool returned an empty response.');
          } catch (error) {
            console.error('search-knowledge-base tool failed:', error);
            return toolError(`${ragToolName} failed: ${getErrorMessage(error)}`);
          }
        },
      );
    },
    {},
    {
      basePath: '',
      maxDuration: 120,
      verboseLogs: true,
    },
  );
}

const handler = async (request: Request) => {
  const result = createHandlerWithCredentials(request);
  if (result instanceof Response) {
    return result;
  }

  return result(request);
};

export { handler as GET, handler as POST };
