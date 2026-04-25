import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

type ApiRequest = {
  method?: string
  body?: unknown
}

type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string | string[]) => void
}

type ApiHandler = {
  default: (req: ApiRequest, res: ApiResponse) => Promise<void>
}

function parseRequestBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    req.on('data', chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined)
        return
      }

      const rawBody = Buffer.concat(chunks).toString('utf8')

      try {
        resolve(JSON.parse(rawBody))
      } catch {
        resolve(undefined)
      }
    })

    req.on('error', reject)
  })
}

function createLocalApiResponse(res: ServerResponse): ApiResponse {
  return {
    status(code: number) {
      res.statusCode = code
      return this
    },
    json(body: unknown) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json')
      }

      res.end(JSON.stringify(body))
    },
    setHeader(name: string, value: string | string[]) {
      res.setHeader(name, value)
    },
  }
}

function createLocalApiMiddleware(loadHandler: () => Promise<ApiHandler>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const body = await parseRequestBody(req)
      const handler = await loadHandler()

      await handler.default(
        {
          method: req.method,
          body,
        },
        createLocalApiResponse(res)
      )
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Local API handler failed',
      }))
    }
  }
}

async function loadApiHandler(loader: () => Promise<unknown>): Promise<ApiHandler> {
  return await loader() as ApiHandler
}

function localApiPlugin(): Plugin {
  return {
    name: 'sachi-sips-local-api',
    configureServer(server) {
      server.middlewares.use('/api/orders', createLocalApiMiddleware(() => loadApiHandler(() => import('./api/orders'))))
      server.middlewares.use('/api/orders-history', createLocalApiMiddleware(() => loadApiHandler(() => import('./api/orders-history'))))
      server.middlewares.use('/api/donations', createLocalApiMiddleware(() => loadApiHandler(() => import('./api/donations'))))
      server.middlewares.use('/api/donations-history', createLocalApiMiddleware(() => loadApiHandler(() => import('./api/donations-history'))))
      server.middlewares.use('/api/live-orders', createLocalApiMiddleware(() => loadApiHandler(() => import('./api/live-orders'))))
      server.middlewares.use('/api/complete-order', createLocalApiMiddleware(() => loadApiHandler(() => import('./api/complete-order'))))
      server.middlewares.use('/api/mark-station-ready', createLocalApiMiddleware(() => loadApiHandler(() => import('./api/mark-station-ready'))))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  process.env.SUPABASE_URL ??= env.SUPABASE_URL || env.VITE_SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= env.SUPABASE_SERVICE_ROLE_KEY

  return {
    plugins: [react(), localApiPlugin()],
  }
})
