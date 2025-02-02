import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { parsePageId, getAllInSpace, getBlockTitle, getCanonicalPageId } from '@texonom/nutils'

import type { Block, ExtendedRecordMap } from '@texonom/ntypes'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { NotionAPI } from '@texonom/nclient'
import type { NotionExporter } from '@texonom/cli'
import type { Resource, Content } from '../index.js'

export function setListResources(server: Server, client: NotionAPI, exporter: NotionExporter) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const id = parsePageId(process.env.ROOT_PAGE as string)
    const { recordMap, pageTree, pageMap } = await getAllInSpace(
      id,
      client.getPage.bind(client),
      client.getBlocks.bind(client),
      client.fetchCollections.bind(client),
      {
        startRecordMap: exporter.recordMap,
        collectionConcurrency: 100,
        concurrency: 100,
        maxPage: 10,
        fetchOption: { timeout: 1000 }
      }
    )
    exporter.recordMap = recordMap
    exporter.pageTree = pageTree
    exporter.pageMap = pageMap
    const resources: Resource[] = []
    exporter.writeFile = async function writeFile (path: string, target: string) {
      const id = parsePageId(path)
      const slug = getCanonicalPageId(id, recordMap)
      resources.push({
        uri: `note://${slug}`,
        mimeType: 'text/markdown',
        name: getBlockTitle(recordMap.block[id]?.value, recordMap),
        description: getPageDescription(recordMap.block[id]?.value, recordMap)
      })
    }
    await exporter.exportMd(id)
    await Promise.all(exporter.promises)
    return { resources }
  })
}

export function setReadResource(server: Server, client: NotionAPI, exporter: NotionExporter) {
  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const id = parsePageId(request.params.uri)
    if (!id) throw new Error(`Note ${request.params.uri} not found`)
    const recordMap = await client.getPage(id)
    if (!recordMap) throw new Error(`Record Map ${id} not found`)
    const md = await exporter.pageToMarkdown(id, recordMap)
    const contents: Content[] = [
      {
        uri: request.params.uri,
        mimeType: 'text/markdown',
        text: md,
      }
    ]
    return { contents }
  })
}

function getPageDescription(block: Block, recordMap: ExtendedRecordMap) {
  const firstBlock = recordMap.block[block?.content?.[0] as string]?.value
  const firstBlockTitle = firstBlock ? getBlockTitle(firstBlock, recordMap).trim() : ''
  let contentDescription: string
  if (firstBlockTitle.length > 50) {
    contentDescription = firstBlockTitle
  } else {
    const secondBlock = recordMap.block[block?.content?.[1] as string]?.value
    const secondBlockTitle = secondBlock ? getBlockTitle(secondBlock, recordMap).trim() : ''
    contentDescription = `${firstBlockTitle}\n${secondBlockTitle}`
  }
  return contentDescription
}
