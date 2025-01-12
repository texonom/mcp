import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { parsePageId } from '@texonom/nutils'

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { NotionAPI } from '@texonom/nclient'
import type { NotionExporter } from '@texonom/cli'
import type { Note } from '../index.js'

export function setListResources(server: Server) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const notes: Note[] = []
    return {
      resources: Object.entries(notes).map(([id, note]) => ({
        uri: `note://${process.env.DOMAIN}/${id}`,
        mimeType: 'text/markdown',
        name: note.title,
        description: `A text note: ${note.title}`,
      })),
    }
  })
}

export function setReadResource(server: Server, client: NotionAPI, exporter: NotionExporter) {
  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const id = parsePageId(request.params.uri)
    if (!id) throw new Error(`Note ${request.params.uri} not found`)
    const recordMap = await client.getPage(id)
    if (!recordMap) throw new Error(`Record Map ${id} not found`)
    const md = exporter.pageToMarkdown(id, recordMap)

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'text/markdown',
          text: md,
        },
      ],
    }
  })
}
