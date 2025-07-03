# Next.js MCP Server with Inkeep Integration

A Model Context Protocol (MCP) server built with Next.js and the Vercel MCP Adapter, featuring Inkeep Analytics integration for AI-powered documentation search and Q&A capabilities.

## Features

- **MCP Server**: Drop-in MCP server implementation using Vercel MCP Adapter
- **Inkeep Integration**: AI-powered documentation search and Q&A tools
- **Analytics**: Conversation logging with Inkeep Analytics
- **Vercel Deployment**: Optimized for Vercel with Fluid compute support

## Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Vercel CLI (for deployment)
- Inkeep account with API key

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd mcp-for-vercel
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   # or
   npm install
   ```

## Environment Setup

### 1. Create Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Required: Inkeep API key
INKEEP_API_KEY=your_inkeep_api_key_here

# Optional: Custom Inkeep API base URL (defaults to 'https://api.inkeep.com/v1')
INKEEP_API_BASE_URL=https://api.inkeep.com/v1
```

### 2. Get Your Inkeep API Key

1. Sign up for an [Inkeep account](https://inkeep.com)
2. Navigate to your Inkeep portal
3. Generate an API key following the [authentication documentation](https://docs.inkeep.com/analytics-api/authentication#get-an-api-key)
4. Add the API key to your `.env.local` file

## Development Environment

### Running Locally

**Option 1: Using Next.js (Recommended for development):**
```bash
pnpm dev
# or
npm run dev
```

**Option 2: Using Vercel CLI (Simulates production environment):**
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Run locally with Vercel
vercel dev
```

Your MCP server will be available at:
- `http://localhost:3000/mcp` (MCP transport)

### Development Configuration

For development, you can customize the MCP server by editing `app/[transport]/route.ts`:

1. **Add custom tools**: Follow the [MCP TypeScript SDK documentation](https://github.com/modelcontextprotocol/typescript-sdk/tree/main?tab=readme-ov-file#server)
2. **Configure prompts and resources**: Add your own prompts and resources
3. **Modify analytics logging**: Customize the conversation logging behavior

## Production Deployment

### Vercel Deployment

#### Prerequisites for Production

1. **Vercel account**: Sign up at [vercel.com](https://vercel.com)
2. **Fluid compute enabled**: Enable [Fluid compute](https://vercel.com/docs/functions/fluid-compute) in your Vercel dashboard for efficient execution

#### Vercel Configuration

Create a `vercel.json` file in the root directory:

```json
{
  "functions": {
    "app/[transport]/route.ts": {
      "maxDuration": 300
    }
  }
}
```

**For Vercel Pro or Enterprise accounts**, you can increase the timeout:
```json
{
  "functions": {
    "app/[transport]/route.ts": {
      "maxDuration": 800
    }
  }
}
```

#### Environment Variables in Vercel

1. **Via Vercel Dashboard:**
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add `INKEEP_API_KEY` and optionally `INKEEP_API_BASE_URL`

2. **Via Vercel CLI:**
   ```bash
   vercel env add INKEEP_API_KEY
   vercel env add INKEEP_API_BASE_URL
   ```

#### Deploy to Vercel

**Option 1: Using Vercel CLI (Recommended)**
```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

**Option 2: Git Integration**
1. Connect your repository to Vercel
2. Push to your main branch
3. Vercel will automatically deploy

**Option 3: One-click Deploy**
Deploy using the [Next.js MCP template](https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js)

### Manual Deployment (Other Platforms)

1. **Build the project:**
   ```bash
   pnpm build
   ```

2. **Start the production server:**
   ```bash
   pnpm start
   ```

## Usage

This MCP server provides two main tools:

### 1. AI Q&A Tool (`ask-question-about-inkeep`)
Ask specific questions about Inkeep functionality, troubleshooting, or concepts.

### 2. Documentation Search Tool (`search-inkeep-docs`)
Perform semantic search across Inkeep documentation and related resources.

### Integration with MCP Clients

Connect your MCP client to the server using the MCP transport:
- **MCP**: `https://your-domain.vercel.app/mcp`

## Customization

### Adding Custom Tools

Edit `app/[transport]/route.ts` to add your own MCP tools:

```typescript
server.tool(
  'your-tool-name',
  'Tool description',
  { parameter: z.string().describe('Parameter description') },
  {
    title: 'Your Tool Title',
    readOnlyHint: true,
    openWorldHint: true,
  },
  async ({ parameter }) => {
    // Your tool logic here
    return {
      content: [{
        type: 'text' as const,
        text: 'Your response',
      }],
    };
  }
);
```

### Modifying Analytics

The server automatically logs conversations to Inkeep Analytics. You can customize this behavior by modifying the `logToInkeepAnalytics` function in `route.ts`.


## Resources

- [Vercel MCP Adapter Documentation](https://www.npmjs.com/package/@vercel/mcp-adapter)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Inkeep Analytics SDK](https://github.com/inkeep/inkeep-analytics-typescript)
- [Inkeep API Documentation](https://docs.inkeep.com/)
- [Vercel Deployment Guide](https://vercel.com/docs)
