import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// In-memory cache for external data
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * API Route for fetching and caching data from external inventory website
 * This prevents CORS issues and implements intelligent caching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'inventory-hitk'
    const cacheKey = `external-${source}`

    // Check cache first
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        data: cached.data,
        source,
        cached: true,
        timestamp: cached.timestamp,
      })
    }

    let externalData: any = null

    if (source === 'inventory-hitk') {
      // Fetch from https://inventory-hitk.vercel.app/
      const response = await fetch('https://inventory-hitk.vercel.app/', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json, text/html',
        },
      })

      if (response.ok) {
        const html = await response.text()

        // Try to extract JSON data from the HTML
        let jsonData = null

        // Look for common patterns where data might be embedded
        const patterns = [
          /<script[^>]*>window\.__INITIAL_STATE__\s*=\s*({.*?})<\/script>/s,
          /<script[^>]*type="application\/json"[^>]*>({.*?})<\/script>/s,
          /data-state="([^"]+)"/,
        ]

        for (const pattern of patterns) {
          const match = html.match(pattern)
          if (match) {
            try {
              jsonData = JSON.parse(match[1])
              break
            } catch (e) {
              // Continue to next pattern
            }
          }
        }

        // If no JSON found, extract useful metadata from HTML
        if (!jsonData) {
          const titleMatch = html.match(/<title>([^<]+)<\/title>/)
          const descMatch = html.match(/<meta name="description" content="([^"]+)"/)

          jsonData = {
            source: 'inventory-hitk.vercel.app',
            title: titleMatch ? titleMatch[1] : 'Inventory System',
            description: descMatch ? descMatch[1] : 'External inventory management system',
            fetched_at: new Date().toISOString(),
            data_available: !!jsonData,
          }
        }

        externalData = jsonData
      }
    }

    if (!externalData) {
      externalData = {
        source,
        error: 'Unable to fetch external data',
        timestamp: new Date().toISOString(),
      }
    }

    // Cache the result
    cache.set(cacheKey, {
      data: externalData,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      data: externalData,
      source,
      cached: false,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[v0] External data fetch error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch external data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint to refresh cache or fetch with custom parameters
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source = 'inventory-hitk', refresh = false } = body

    const cacheKey = `external-${source}`

    // Clear cache if refresh is requested
    if (refresh) {
      cache.delete(cacheKey)
    }

    // Fetch fresh data
    const response = await fetch(
      new URL(request.url).origin +
        `/api/external-data?source=${encodeURIComponent(source)}`,
      {
        headers: request.headers,
      }
    )

    return response
  } catch (error) {
    console.error('[v0] External data POST error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
