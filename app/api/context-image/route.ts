import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const MAX_CONTENT_LENGTH = 5000

const FALLBACK_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/J%C3%B3zef_Che%C5%84ski_-_Bociany_1900.jpg/1200px-J%C3%B3zef_Che%C5%84ski_-_Bociany_1900.jpg'
const FALLBACK_SOURCE = 'https://commons.wikimedia.org/wiki/File:J%C3%B3zef_Che%C5%84ski_-_Bociany_1900.jpg'

async function fetchPolishArtImage(searchTerm: string) {
  const queries = [
    `${searchTerm} painting`,
    `Polish landscape painting`,
    `Młoda Polska painting`,
    searchTerm
  ]

  for (const q of queries) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: q,
      gsrnamespace: '6', // Tylko pliki graficzne
      gsrlimit: '12', // Pobieramy nieco więcej, żeby przesiać przez rygorystyczny filtr
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '1200',
      format: 'json',
      origin: '*',
    })

    console.log(`[DEBUG - Wiki Art] Searching Wikimedia for query: "${q}"`)

    try {
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { 'User-Agent': 'LesmianPoetryApp/1.0 (kontakt@twojadomena.pl)' },
        next: { revalidate: 3600 },
      })

      if (!response.ok) {
        console.log(`[DEBUG - Wiki Art] Response not OK for query: "${q}" (Status: ${response.status})`)
        continue
      }

      const data = await response.json()
      const pages = data?.query?.pages ? (Object.values(data.query.pages) as Array<{ title?: string; imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string }> }>) : []

      console.log(`[DEBUG - Wiki Art] Found ${pages.length} raw items for query: "${q}"`)

      // Rygorystyczne filtrowanie: akceptujemy TYLKO pliki graficzne i odrzucamy dokumenty / skany książek
      for (const page of pages) {
        const title = (page.title || '').toLowerCase()
        
        // Sprawdzamy rozszerzenie pliku - musi to być czysta grafika
        const isImage = title.endsWith('.jpg') || title.endsWith('.jpeg') || title.endsWith('.png')
        
        const isBookOrScan = 
          !isImage ||
          title.includes('.djvu') ||
          title.includes('.pdf') ||
          title.includes('page') ||
          title.includes('book') ||
          title.includes('cover') ||
          title.includes('ia_') ||
          title.includes('publication') ||
          title.includes('illustration from') ||
          title.includes('t. ') || 
          title.includes('str.') ||
          title.includes('biblioteka')

        if (isBookOrScan) {
          console.log(`[DEBUG - FILTERED OUT] Odrzucono dokument/skan/nie-obraz: "${page.title}"`)
          continue
        }

        const imageInfo = page.imageinfo?.[0]
        if (imageInfo?.thumburl || imageInfo?.url) {
          console.log(`[DEBUG - SUCCESS] Wybrano prawdziwy obraz malarski: "${page.title}"`)
          return {
            image: imageInfo.thumburl ?? imageInfo.url ?? null,
            source: imageInfo.descriptionurl ?? null,
          }
        }
      }
    } catch (e) {
      console.error(`[DEBUG - Wiki Art Error]`, e)
      continue
    }
  }

  console.log(`[DEBUG - Wiki Art] Nie znaleziono żadnego czystego obrazu malarskiego dla zapytań.`);
  return null
}

export async function POST(request: Request) {
  console.log(`\n--- [DEBUG] Polish Art Search Started ---`)
  try {
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const content = typeof body.content === 'string' ? body.content.trim() : ''

    if (!title || !content || title.length > 300 || content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: 'Nieprawidłowa treść wiersza.' }, { status: 400 })
    }

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert in Polish symbolist and landscape art (Młoda Polska, Józef Chełmoński, Jacek Malczewski). Based on the poem title and its excerpt, output ONLY 1 or 2 unique English art keywords capturing the specific atmosphere, mood, or subject of THIS exact poem (NO COMMAS, NO QUOTES). Examples: "dark forest", "lonely figure", "mysterious garden", "sunset shadows".',
        },
        {
          role: 'user',
          content: `Poem title: "${title}"\nPoem excerpt: ${content.slice(0, 400)}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7, // Zwiększamy delikatnie, żeby model bardziej eksperymentował i nie powtarzał tego samego słowa
      // @ts-ignore
      reasoning_effort: 'low',
      // @ts-ignore
      reasoning_format: 'hidden',
    })

    const rawContent = completion.choices[0]?.message?.content || ''
    console.log(`[Groq Raw Output]: "${rawContent}"`)

    let keyword = rawContent
      .replace(/["'.,!?;:()\[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 2)
      .join(' ')

    if (!keyword || keyword.length < 2) {
      keyword = 'forest landscape'
    }

    let result = await fetchPolishArtImage(keyword)

    if (!result) {
      console.log(`[Fallback Used] Returning Chełmoński fallback.`);
      return NextResponse.json({
        image: FALLBACK_IMAGE_URL,
        source: FALLBACK_SOURCE,
        search: keyword,
        status: 'fallback_no_match',
      })
    }

    return NextResponse.json({
      image: result.image,
      source: result.source,
      search: keyword,
      status: 'success',
    })
  } catch (error) {
    console.error('[API Error]:', error)
    return NextResponse.json({
      image: FALLBACK_IMAGE_URL,
      source: FALLBACK_SOURCE,
      search: 'API Error',
      status: 'fallback_error',
    })
  }
}