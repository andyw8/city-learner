import { PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles'
import { BASEMAP_URL } from './style'

/**
 * A pmtiles source that tolerates CDNs which mishandle byte serving.
 *
 * pmtiles' own FetchSource throws when a Range request comes back as a full
 * 200 without a usable Content-Length (common behind some proxies, e.g.
 * Cloudflare in front of a custom domain). We instead slice the full response
 * ourselves, so the archive loads whether or not the host honours Range.
 */
export class HttpRangeSource implements Source {
  private url: string
  private fetchImpl: typeof fetch

  constructor(url: string, fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init)) {
    this.url = url
    this.fetchImpl = fetchImpl
  }

  getKey(): string {
    return this.url
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    const response = await this.fetchImpl(this.url, {
      signal,
      headers: { Range: `bytes=${offset}-${offset + length - 1}` },
    })

    if (response.status >= 300 || response.status === 416) {
      throw new Error(`Bad response code: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    if (response.status === 200 && buffer.byteLength > length) {
      return { data: buffer.slice(offset, offset + length) }
    }
    return { data: buffer }
  }
}

export function createPmtilesProtocol(): Protocol {
  const protocol = new Protocol()
  protocol.add(new PMTiles(new HttpRangeSource(BASEMAP_URL)))
  return protocol
}
