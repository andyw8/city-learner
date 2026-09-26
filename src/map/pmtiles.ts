import { PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles'
import { BASEMAP_URL } from './style'

/**
 * A pmtiles source backed by a single in-memory copy of the archive.
 *
 * Some hosts do not honour HTTP range requests (the custom domain is behind a
 * proxy that can answer a `Range` request with the whole file), and concurrent
 * per-tile range requests against such a host fail and abort. Downloading the
 * archive once and slicing it here works regardless of how the host handles
 * byte serving; the archive is cached by the browser between visits.
 */
export class ArchiveSource implements Source {
  private url: string
  private fetchImpl: typeof fetch
  private archive: Promise<ArrayBuffer> | null = null

  constructor(url: string, fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init)) {
    this.url = url
    this.fetchImpl = fetchImpl
  }

  getKey(): string {
    return this.url
  }

  private load(): Promise<ArrayBuffer> {
    this.archive ??= this.fetchImpl(this.url).then((response) => {
      if (!response.ok) throw new Error(`Bad response code: ${response.status}`)
      return response.arrayBuffer()
    })
    return this.archive
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const buffer = await this.load()
    return { data: buffer.slice(offset, offset + length) }
  }
}

export function createPmtilesProtocol(): Protocol {
  const protocol = new Protocol()
  protocol.add(new PMTiles(new ArchiveSource(BASEMAP_URL)))
  return protocol
}
