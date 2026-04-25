# Inkeep MCP Server with Next.js

An Inkeep MCP Server with Next.js, deployable to Vercel. It includes two tools:
- `ask-question` (Use this tool to ask a question about the product)
- `search-knowledge-base` (Use this tool to do a semantic search for reference content related to the product)

## Prerequisites

- Node.js 24+ 
- pnpm (recommended) or npm
- Inkeep account with API key

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/inkeep/mcp-for-vercel.git
   cd mcp-for-vercel
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

## Authentication

To use the Inkeep MCP server, you’ll need an Inkeep API key.

- Go to the Inkeep portal and follow these steps [Get an API key](https://docs.inkeep.com/cloud/ai-api/chat-completions-api#get-an-api-key).
- When making MCP requests, include your API key in the Authorization header using the Bearer format:
```
Authorization: Bearer INKEEP_API_KEY
```

Alternatively, you can specify `INKEEP_API_KEY` as an environment variable to this MCP server. Be aware: exposing the key this way will make your MCP server accessible to others if not properly secured.

## Development Environment

```bash
pnpm dev
```

Your MCP server will be available at:
- `http://localhost:3000/mcp` (MCP transport)

## Vercel Deployment

1. Push your repository to GitHub
2. Create a new Vercel project and import the repository
3. Vercel should automatically detect this as a Next.js project. No special build configuration is required.

## Analytics

The server automatically logs conversations to Inkeep Analytics (please see the `logToInkeepAnalytics` function). You can view this usage in the Inkeep Portal.

## Resources

- [Vercel MCP Adapter Documentation](https://github.com/vercel/mcp-handler)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Inkeep API Documentation](https://docs.inkeep.com/cloud/ai-api/chat-completions-api)
- [Inkeep Analytics SDK](https://github.com/inkeep/inkeep-analytics-typescript)
- [Vercel Deployment Guide](https://vercel.com/docs)
