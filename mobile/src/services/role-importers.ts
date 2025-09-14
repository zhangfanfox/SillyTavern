import { Buffer } from 'buffer';
export type ImportedRole = {
  name: string;
  avatar?: string;
  description?: string;
  system_prompt?: string;
  first_message?: string;
  creator_notes?: string;
  summary?: string;
  scenario?: string;
  depth?: number;
  speak_frequency?: number;
  tags?: string[];
  extra?: Record<string, any>;
  raw?: any;
  // When source is a PNG card, we expose the avatar binary (the PNG itself)
  avatarBinary?: ArrayBuffer;
  avatarMime?: string;
};

// Helper: fetch text using global fetch (React Native provides fetch)
async function fetchText(url: string, init?: any): Promise<string> {
  try {
    const res = await (globalThis.fetch as any)(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    throw e;
  }
}


async function safeReadText(res: any): Promise<string | null> {
  try { return await res.text(); } catch { return null; }
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
      first_message: d.first_mes ?? ext?.first_message ?? '',
      creator_notes: d.creator_notes ?? ext?.creator_notes ?? '',
      summary: d.summary ?? ext?.summary ?? '',
      scenario: d.scenario ?? ext?.scenario ?? '',
      depth: typeof (ext?.depth ?? d.depth) === 'number' ? (ext?.depth ?? d.depth) : undefined,
      speak_frequency: typeof (ext?.speak_frequency ?? d.speak_frequency) === 'number' ? (ext?.speak_frequency ?? d.speak_frequency) : undefined,
      tags: Array.isArray(ext?.tags ?? d.tags) ? (ext?.tags ?? d.tags) : undefined,
      extra: ext?.extra ?? undefined,
      raw: json,
    };
  }
  return {
    name: json.name ?? 'Unknown',
    avatar: json.avatar,
    description: json.description ?? json.personality ?? json.scenario ?? '',
    system_prompt: json.system_prompt ?? '',
    first_message: json.first_message ?? json.first_mes ?? '',
    creator_notes: json.creator_notes ?? '',
    summary: json.summary ?? '',
    scenario: json.scenario ?? '',
    depth: typeof json.depth === 'number' ? json.depth : undefined,
    speak_frequency: typeof json.speak_frequency === 'number' ? json.speak_frequency : undefined,
    tags: Array.isArray(json.tags) ? json.tags : undefined,
    extra: json.extra ?? undefined,
    raw: json,
  };
}

// Parse character card JSON from a PNG or JSON buffer
function parseCharacterCardFromBuffer(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng = u8.length >= 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47 && u8[4] === 0x0d && u8[5] === 0x0a && u8[6] === 0x1a && u8[7] === 0x0a;
  if (!isPng) {
    // Try text decode as JSON
    try {
      const text = Buffer.from(u8).toString('utf-8');
      JSON.parse(text); // validate
      return text;
    } catch (e) {
      console.error('[role-importers] Not PNG and not JSON text');
      throw new Error('Unsupported content format');
    }
  }
  // Iterate PNG chunks
  let offset = 8; // after signature
  type TextChunk = { keyword: string; text: string };
  const textChunks: TextChunk[] = [];
  while (offset + 8 <= u8.length) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const length = dv.getUint32(offset, false /* big-endian */); offset += 4;
    if (offset + 4 > u8.length) break;
    const type = String.fromCharCode(u8[offset], u8[offset + 1], u8[offset + 2], u8[offset + 3]);
    offset += 4;
    if (offset + length + 4 > u8.length) break; // data + CRC
    if (type === 'tEXt') {
      const data = u8.subarray(offset, offset + length);
      const nullIdx = data.indexOf(0x00);
      let keyword = '';
      let text = '';
      if (nullIdx >= 0) {
        keyword = asciiDecode(data.subarray(0, nullIdx));
        text = asciiDecode(data.subarray(nullIdx + 1));
      } else {
        // No separator; treat all as text
        text = asciiDecode(data);
      }
      textChunks.push({ keyword: keyword.toLowerCase(), text });
    }
    offset += length; // skip data
    offset += 4; // skip CRC
    if (type === 'IEND') break;
  }
  const ccv3 = textChunks.find((c) => c.keyword === 'ccv3');
  const chara = textChunks.find((c) => c.keyword === 'chara');
  const encoded = (ccv3?.text || chara?.text);
  if (!encoded) {
    console.error('[role-importers] PNG has no ccv3/chara tEXt chunks');
    throw new Error('No character data in PNG');
  }
  try {
    const jsonText = base64ToUtf8(encoded);
    JSON.parse(jsonText); // validate
    return jsonText;
  } catch (e) {
    console.error('[role-importers] Failed to decode base64 JSON from PNG tEXt', e);
    throw new Error('Bad character data in PNG');
  }
}

function asciiDecode(arr: Uint8Array): string {
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return s;
}

function base64ToUtf8(b64: string): string {
  // Prefer Buffer which is available via react-native 'buffer' polyfill
  return Buffer.from(b64, 'base64').toString('utf-8');
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

export type ImportProgress = (stage: string) => void;
export async function parseRoleFromURL(url: string, opts?: { signal?: AbortSignal; onProgress?: ImportProgress }): Promise<ImportedRole> {
  console.info('[role-importers] parseRoleFromURL start', url);
  const host = (() => {
    try {
      const m = String(url).replace(/^[a-zA-Z]+:\/\//, '').split('/')[0] || '';
      return m.toLowerCase();
    } catch { return ''; }
  })();
  // JanitorAI: prefer API path (like web)
  if (host.includes('janitorai')) {
    const uuid = getUuidFromUrl(url);
    console.info('[role-importers] JanitorAI detected, uuid:', uuid);
    if (!uuid) {
      console.warn('[role-importers] No UUID in URL, attempting HTML scrape fallback');
      const html = await fetchText(url, { signal: opts?.signal });
      const scraped = parseJanitorAI(html);
      if (scraped) return scraped;
      throw new Error('无法从链接解析出角色 UUID');
    }
    try {
      // 1) Ask Janny API for download URL
      const apiUrl = 'https://api.jannyai.com/api/v1/download';
      console.info('[role-importers] POST', apiUrl);
      const apiRes = await (globalThis.fetch as any)(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: uuid }),
        signal: opts?.signal,
      });
      if (!apiRes.ok) {
        const t = await safeReadText(apiRes);
        console.error('[role-importers] Janny API failed', apiRes.status, t);
        throw new Error(`Janny API 错误: ${apiRes.status}`);
      }
      const apiJson = await apiRes.json();
      const downloadUrl = apiJson?.downloadUrl;
      if (!downloadUrl) {
        console.error('[role-importers] Janny API no downloadUrl', apiJson);
        throw new Error('Janny API 未返回下载地址');
      }
      opts?.onProgress?.('下载卡片');
      console.info('[role-importers] Downloading card', downloadUrl);
      const res = await (globalThis.fetch as any)(downloadUrl, { signal: opts?.signal });
      if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
      const contentType = (typeof res.headers?.get === 'function') ? (res.headers.get('content-type') || '') : '';
      const buf = await res.arrayBuffer();
      console.info('[role-importers] Downloaded bytes', (buf as any).byteLength || 0);
      opts?.onProgress?.('解析卡片');
      const jsonText = parseCharacterCardFromBuffer(buf);
      const role = parseRoleFromJSON(jsonText);
      // Attach avatar binary if PNG
      if ((contentType || '').includes('image/png')) {
        (role as ImportedRole).avatarBinary = buf;
        (role as ImportedRole).avatarMime = 'image/png';
      }
      console.info('[role-importers] Parsed role name:', role.name);
      return role;
    } catch (e: any) {
      console.error('[role-importers] JanitorAI import failed', e);
      throw e;
    }
  }
  // Fallback: fetch page and scrape generic metadata or JSON-LD
  const html = await fetchText(url, { signal: opts?.signal });
  // HTML-based strategies
  const r = parseJanitorAI(html);
  if (r) return r;
  // Generic JSON-LD
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
  // Meta tags fallback
  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || html.match(/<title>([^<]+)/i);
  const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i);
  const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
  const name = titleMatch ? decodeHTMLEntities(titleMatch[1]) : 'Unknown';
  const description = descMatch ? decodeHTMLEntities(descMatch[1]) : '';
  const avatar = imgMatch ? decodeHTMLEntities(imgMatch[1]) : undefined;
  return { name, description, avatar, system_prompt: undefined, raw: { source: 'generic-meta' } };
}

function getUuidFromUrl(u: string): string | null {
  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  const m = u.match(uuidRegex);
  return m ? m[0] : null;
}
