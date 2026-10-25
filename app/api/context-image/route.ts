import { generateText } from 'ai'
import { NextResponse } from 'next/server'

const MAX_CONTENT_LENGTH = 5000

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const content = typeof body.content === 'string' ? body.content.trim() : ''

    if (!title || !content || title.length > 300 || content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: 'Nieprawidłowa treść wiersza.' }, { status: 400 })
    }

    const { text } = await generateText({
      model: 'openai/gpt-oss-20b',
      system: 'Jesteś kuratorem sztuki i tłumaczem poezji. Z tekstu wiersza wyciągasz konkretny, wizualny kontekst do wyszukania w Wikimedia Commons. Odpowiadasz wyłącznie krótką frazą po angielsku, bez cudzysłowów, bez interpunkcji i bez nazwiska autora.',
      prompt: `Tytuł: ${title}\n\nWiersz:\n${content}\n\nPodaj 3–6 słów opisujących motyw lub scenę, którą najlepiej zilustruje fotografia, obraz albo rycina.`,
      maxOutputTokens: 24,
    })

    const search = text.replace(/["'.,!?;:()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
    if (!search) return NextResponse.json({ image: null, search: null })

    const params = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: search, gsrnamespace: '6',
      gsrlimit: '5', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1200', format: 'json', origin: '*',
    })
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { next: { revalidate: 3600 } })
    if (!response.ok) return NextResponse.json({ image: null, search })
    const data = await response.json()
    const pages = data?.query?.pages ? Object.values(data.query.pages) as Array<{ imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string }> }> : []
    const image = pages.map((page) => page.imageinfo?.[0]).find((info) => info?.thumburl || info?.url)

    return NextResponse.json({ image: image?.thumburl ?? image?.url ?? null, source: image?.descriptionurl ?? null, search })
  } catch {
    const fallbackSearch = 'moon night landscape painting'
    const params = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: fallbackSearch, gsrnamespace: '6',
      gsrlimit: '5', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1200', format: 'json', origin: '*',
    })
    try {
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { next: { revalidate: 3600 } })
      const data = await response.json()
      const pages = data?.query?.pages ? Object.values(data.query.pages) as Array<{ imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string }> }> : []
      const image = pages.map((page) => page.imageinfo?.[0]).find((info) => info?.thumburl || info?.url)
      return NextResponse.json({ image: image?.thumburl ?? image?.url ?? null, source: image?.descriptionurl ?? null, search: fallbackSearch })
    } catch {
      return NextResponse.json({ image: null, search: fallbackSearch })
    }
  }
}
