import PoetryApp from '@/components/poetry-app'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Poem = { id: string | number; title: string; page_id?: string | number | null; content: string }

function normalizePoem(row: Partial<Poem>): Poem | null {
  const title = typeof row.title === 'string' ? row.title.replace(/\\s+/g, ' ').trim() : ''
  const content = typeof row.content === 'string'
    ? row.content.replace(/\\r\\n?/g, '\\n').split('\\n').map((line) => line.trimEnd()).join('\\n').replace(/\\n{3,}/g, '\\n\\n').trim()
    : ''
  if (!title || !content || row.id === undefined || row.id === null) return null
  return { id: row.id, title, content, page_id: row.page_id ?? null }
}

export default async function Page() {
  if (!supabase) return <PoetryApp poems={[]} envError />
  const { data, error } = await supabase.from('poems').select('id, title, page_id, content').order('id')
  const poems = (data ?? []).map((row) => normalizePoem(row as Partial<Poem>)).filter((row): row is Poem => row !== null)
  return <PoetryApp poems={poems} envError={Boolean(error)} />
}
