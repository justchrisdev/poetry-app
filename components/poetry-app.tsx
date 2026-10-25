'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, ChevronRight, Copy, Image as ImageIcon, Leaf, LoaderCircle, Moon, Search, Shuffle, Sun, X } from 'lucide-react'

type Poem = { id: string | number; title: string; page_id?: string | number | null; content: string }

const fallbackPoem: Poem = {
  id: 'fallback',
  title: 'W malinowym chruśniaku',
  content: 'W malinowym chruśniaku, przed ciekawych wzrokiem\nZapodziani pośród liściastych sprzeczek,\n\nCzy zrozumiesz tę chwilę, gdy cisza dojrzewa\nI światło osiada na dłoniach jak pył?\n\nTam, gdzie ścieżka gubi swój własny początek,\nNajłatwiej odnaleźć to, co było snem.',
}

function dayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date.getTime() - start.getTime()) / 86400000)
}

export default function PoetryApp({ poems, envError = false }: { poems: Poem[]; envError?: boolean }) {
  const allPoems = poems.length ? poems : [fallbackPoem]
  const [poem, setPoem] = useState(() => allPoems[dayOfYear() % allPoems.length])
  const [dark, setDark] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [slowReading, setSlowReading] = useState(false)
  const [contextImage, setContextImage] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setImageLoading(true)
    setContextImage(null)
    fetch('/api/context-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: poem.title, content: poem.content }),
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled) return
        setContextImage(data?.image ?? null)
      })
      .catch(() => { if (!cancelled) setContextImage(null) })
      .finally(() => { if (!cancelled) setImageLoading(false) })
    return () => { cancelled = true }
  }, [poem])

  useEffect(() => {
    if (!slowReading) return
    const interval = window.setInterval(() => {
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atEnd) setSlowReading(false)
      else window.scrollBy({ top: 1, behavior: 'auto' })
    }, 75)
    return () => window.clearInterval(interval)
  }, [slowReading])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pl-PL')
    return allPoems.filter((item) => item.title.toLocaleLowerCase('pl-PL').includes(normalizedQuery))
  }, [allPoems, query])
  const chooseRandom = () => setPoem(allPoems[Math.floor(Math.random() * allPoems.length)])
  const copyPoem = async () => {
    await navigator.clipboard?.writeText(`${poem.title}\n\n${poem.content}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className={dark ? 'poetry-shell dark' : 'poetry-shell'}>
      <header className="site-header">
        <div className="brand"><span className="brand-mark"><Leaf size={18} strokeWidth={1.5} /></span><span>LEŚMIAN / 24</span></div>
        <nav><button className="text-button" onClick={() => setArchiveOpen(true)}><BookOpen size={16} /> Archiwum</button><button className="icon-button" aria-label="Przełącz motyw" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></nav>
      </header>

      <main className="poetry-main">
        <div><section className="intro"><p className="eyebrow">Codzienny wiersz</p><h1>Na dziś,<br /><em>dla Ciebie.</em></h1><p className="intro-copy">Chwila zatrzymania w świecie słów<br className="desktop-break" /> Bolesława Leśmiana.</p><div className="archive-stat"><span className="stat-dot" />{allPoems.length} {allPoems.length === 1 ? 'wiersz' : 'wierszy'} w archiwum</div><div className="context-image" aria-live="polite">{imageLoading ? <span className="image-status"><LoaderCircle size={15} className="spin" /> Szukam obrazu do kontekstu…</span> : contextImage ? <><img src={contextImage} alt={`Obraz inspirowany wierszem „${poem.title}”`} /><span className="image-caption"><ImageIcon size={13} /> Obraz z Wikimedia Commons</span></> : <span className="image-status">Nie znaleziono obrazu do tego wiersza.</span>}</div></section></div>
        <section className="poem-card" aria-live="polite">
          <div className="poem-meta"><span>{poem.page_id ? `Strona ${poem.page_id}` : 'Z archiwum poezji'}</span><span className="meta-line" /><span>{new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span></div>
          <div className="poem-content"><h2>{poem.title}</h2><p className="poem-text whitespace-pre-line">{poem.content}</p><div className="poem-author">Bolesław Leśmian <span>—</span> 1877–1937</div></div>
          <div className="card-actions"><button className="outline-button" onClick={chooseRandom}><Shuffle size={16} /> Losuj wiersz</button><button className={slowReading ? 'outline-button active-reading' : 'outline-button'} onClick={() => setSlowReading(!slowReading)} aria-pressed={slowReading}>{slowReading ? <X size={16} /> : <BookOpen size={16} />} {slowReading ? 'Zatrzymaj czytanie' : 'Czytaj powoli'}</button><button className="outline-button" onClick={copyPoem}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Skopiowano' : 'Kopiuj treść'}</button></div>
        </section>
        {envError && <p className="notice">Połącz Supabase, aby wyświetlać pełne archiwum. Pokazujemy wiersz przykładowy.</p>}
      </main>

      <footer><span>© 2024 / Codzienny Wiersz</span><span className="footer-note">Czytaj powoli.</span><span>Warszawa · Polska</span></footer>

      {archiveOpen && <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="archive-title"><div className="archive-panel"><div className="archive-head"><div><p className="eyebrow">Biblioteka słów</p><h2 id="archive-title">Archiwum wierszy</h2></div><button className="icon-button" aria-label="Zamknij archiwum" onClick={() => setArchiveOpen(false)}><X size={20} /></button></div><label className="search-box"><Search size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po tytule..." /></label><div className="archive-list">{filtered.map((item) => <button className="archive-item" key={item.id} onClick={() => { setPoem(item); setArchiveOpen(false) }}><span>{item.title}</span><ChevronRight size={17} /></button>)}{!filtered.length && <p className="empty">Nie znaleziono wierszy.</p>}</div></div></div>}
    </div>
  )
}
