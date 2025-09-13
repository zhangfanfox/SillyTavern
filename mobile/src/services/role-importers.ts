export type ImportedRole = {
  name: string;
  avatar?: string;
  description?: string;
  system_prompt?: string;
  raw?: any;
};

// Helper: fetch text using global fetch (React Native provides fetch)
async function fetchText(url: string): Promise<string> {
  try {
    const res = await (globalThis.fetch as any)(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    throw e;
  }
}

// Generic JSON card (SillyTavern v2/v3/plain)
export function parseRoleFromJSON(text: string): ImportedRole {
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error('Invalid JSON'); }
  if ((json.spec && String(json.spec).toLowerCase().includes('chara_card_v3')) || json.data) {
    const d = json.data ?? json;
    const ext = d.extensions?.sillytavern ?? d.extensions?.sillytavern;
    return {
      name: d.name ?? 'Unknown',
      avatar: d.avatar ?? ext?.avatar ?? undefined,
      description: d.description ?? ext?.description ?? '',
      system_prompt: d.system_prompt ?? ext?.system_prompt ?? '',
      raw: json,
    };
  }
  return {
    name: json.name ?? 'Unknown',
    avatar: json.avatar,
    description: json.description ?? json.personality ?? json.scenario ?? '',
    system_prompt: json.system_prompt ?? '',
    raw: json,
  };
}

// Try to parse JanitorAI HTML
function parseJanitorAI(html: string): ImportedRole | null {
  try {
    // 0) Next.js __NEXT_DATA__ payload
    const nextData = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (nextData && nextData[1]) {
      try {
        const j = JSON.parse(nextData[1].trim());
        // Heuristic: find an object with keys resembling character profile
        const walk = (obj: any): ImportedRole | null => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.name && (obj.description || obj.persona || obj.about)) {
            return {
              name: String(obj.name),
              description: String(obj.description || obj.persona || obj.about || ''),
              avatar: typeof obj.image === 'string' ? obj.image : (obj.image?.url || obj.avatar || undefined),
              system_prompt: obj.system_prompt || obj.systemPrompt || undefined,
              raw: obj,
            };
          }
          for (const k of Object.keys(obj)) {
            const v = (obj as any)[k];
            const r = walk(v);
            if (r) return r;
          }
          return null;
        };
        const found = walk(j);
        if (found) return found;
      } catch {}
    }
    // 1) Attempt to find JSON-LD blocks with character data
    const ldjsonMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
    for (const m of ldjsonMatches) {
      try {
        const j = JSON.parse(m[1].trim());
        const cand = Array.isArray(j) ? j : [j];
        for (const item of cand) {
          if (item?.name && (item?.description || item?.about)) {
            return {
              name: String(item.name),
              description: String(item.description || item.about || ''),
              avatar: typeof item.image === 'string' ? item.image : (item.image?.url || undefined),
              system_prompt: undefined,
              raw: item,
            };
          }
        }
      } catch {}
    }
    // 2) Fallback: meta tags
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || html.match(/<title>([^<]+)/i);
    const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i);
    const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
    const name = titleMatch ? decodeHTMLEntities(titleMatch[1]) : undefined;
    const description = descMatch ? decodeHTMLEntities(descMatch[1]) : undefined;
    const avatar = imgMatch ? decodeHTMLEntities(imgMatch[1]) : undefined;
    if (name || description) {
      return { name: name || 'Unknown', description, avatar, system_prompt: undefined, raw: { source: 'janitorai-meta' } };
    }
  } catch {}
  return null;
}

function decodeHTMLEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export async function parseRoleFromURL(url: string): Promise<ImportedRole> {
  const host = (() => {
    try {
      const m = String(url).replace(/^[a-zA-Z]+:\/\//, '').split('/')[0] || '';
      return m.toLowerCase();
    } catch { return ''; }
  })();
  const html = await fetchText(url);
  // Platform-specific strategies
  if (host.includes('janitorai.com')) {
    const r = parseJanitorAI(html);
    if (r) return r;
  }
  // More platforms can be added similarly with their HTML/json embedded structures.
  // Generic fallback: try to find JSON-LD and og: tags
  const ldjsonMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const m of ldjsonMatches) {
    try {
      const j = JSON.parse(m[1].trim());
      const cand = Array.isArray(j) ? j : [j];
      for (const item of cand) {
        if (item?.name && (item?.description || item?.about)) {
          return {
            name: String(item.name),
            description: String(item.description || item.about || ''),
            avatar: typeof item.image === 'string' ? item.image : (item.image?.url || undefined),
            system_prompt: undefined,
            raw: item,
          };
        }
      }
    } catch {}
  }
  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || html.match(/<title>([^<]+)/i);
  const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i);
  const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
  const name = titleMatch ? decodeHTMLEntities(titleMatch[1]) : 'Unknown';
  const description = descMatch ? decodeHTMLEntities(descMatch[1]) : '';
  const avatar = imgMatch ? decodeHTMLEntities(imgMatch[1]) : undefined;
  return { name, description, avatar, system_prompt: undefined, raw: { source: 'generic-meta' } };
}
