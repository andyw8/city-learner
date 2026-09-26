import { PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles'
import { BASEMAP_URL } from './style'

const PROBE_LENGTH = 16384

/**
 * A pmtiles source that works whether or not the host honours range requests.
 *
 * Some proxies (e.g. Cloudflare in front of a custom domain) ignore `Range` and
 * answer with the whole file, which breaks pmtiles' own FetchSource and causes a
 * storm of full-archive downloads. This source probes once: if the host supports
 * byte serving it uses range requests, otherwise it keeps the full archive in
 * memory and slices it locally.
 */
export class HttpRangeSource implements Source {
  private url: string
  private fetchImpl: typeof fetch
  private buffer: ArrayBuffer | null = null
  private deciding: Promise<void> | null = null
  private ranged = false

  constructor(url: string, fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init)) {
    this.url = url
    this.fetchImpl = fetchImpl
  }

  getKey(): string {
    return this.url
  }

  private async rangeRequest(offset: number, length: number, signal?: AbortSignal): Promise<Response> {
    const response = await this.fetchImpl(this.url, {
      signal,
      headers: { Range: `bytes=${offset}-${offset + length - 1}` },
    })
    if (response.status >= 300 || response.status === 416) {
      throw new Error(`Bad response code: ${response.status}`)
    }
    return response
  }

  private async decide(signal?: AbortSignal): Promise<void> {
    const response = await this.rangeRequest(0, PROBE_LENGTH, signal)
    const body = await response.arrayBuffer()

    if (response.status === 206) {
      this.ranged = true
      return
    }
    // A 200 means the host ignored the range and returned the whole archive.
    this.buffer = body
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    const buffered = this.buffer
    if (buffered) return { data: buffered.slice(offset, offset + length) }

    if (!this.ranged) {
      this.deciding ??= this.decide(signal)
      await this.deciding
      const loaded = this.buffer
      if (loaded) return { data: loaded.slice(offset, offset + length) }
    }

    const response = await this.rangeRequest(offset, length, signal)
    const body = await response.arrayBuffer()
    if (response.status === 200) {
      // Range support degraded mid-session; cache the full archive from now on.
      this.buffer = body
      return { data: body.slice(offset, offset + length) }
    }
    return { data: body }
  }
}

export function createPmtilesProtocol(): Protocol {
  const protocol = new Protocol()
  protocol.add(new PMTiles(new HttpRangeSource(BASEMAP_URL)))
  return protocol
}
