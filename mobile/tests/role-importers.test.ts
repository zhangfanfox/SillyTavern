/*
 Basic unit test for role importer: verifies JanitorAI import URL is handled
 by hitting Janny API mock and parsing a PNG with tEXt ccv3 chunk containing JSON.
 Uses a minimal PNG builder with IHDR + tEXt + IEND. CRCs are not validated on read.
*/
import { parseRoleFromURL } from '../src/services/role-importers';

// Minimal CRC32 implementation for PNG chunk integrity (optional but we include)
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const len = u32(data.length);
  const crc = u32(crc32(new Uint8Array([...typeBytes, ...data])));
  return new Uint8Array([...len, ...typeBytes, ...data, ...crc]);
}

function buildPngWithText(keyword: string, text: string): Uint8Array {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR 1x1 RGBA
  const ihdr = pngChunk('IHDR', new Uint8Array([...u32(1), ...u32(1), 8, 6, 0, 0, 0]));
  // tEXt
  const k = new TextEncoder().encode(keyword);
  const v = new TextEncoder().encode(text);
  const data = new Uint8Array([...k, 0x00, ...v]);
  const textChunk = pngChunk('tEXt', data);
  // IDAT minimal (empty) optional omitted
  const iend = pngChunk('IEND', new Uint8Array());
  return new Uint8Array([...sig, ...ihdr, ...textChunk, ...iend]);
}

// Mock global fetch
declare const global: any;

describe('role-importers: JanitorAI URL', () => {
  const uuid = 'b4399b0a-9973-4d73-9b42-92af3ab07706';
  const url = `https://janitorai.com/characters/${uuid}_character-shinichi-kudo`;

  beforeAll(() => {
    const cardJson = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Shinichi Kudo 🏫',
        description: 'Detective high schooler',
        system_prompt: 'Be deductive',
        first_mes: 'Hello.'
      }
    };
    const cardText = JSON.stringify(cardJson);
    const b64 = Buffer.from(cardText, 'utf-8').toString('base64');
    const png = buildPngWithText('ccv3', b64);

    global.fetch = jest.fn(async (input: any, init?: any) => {
      // API call
      if (typeof input === 'string' && input.includes('api.jannyai.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', downloadUrl: 'https://files.example.com/fake-card.png' }),
          text: async () => JSON.stringify({ status: 'ok' }),
        } as any;
      }
      // Download URL
      if (typeof input === 'string' && input.includes('files.example.com')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
          headers: new Map([['content-type', 'image/png']]),
        } as any;
      }
      // Fallback page fetch (not used in happy path)
      return {
        ok: true,
        status: 200,
        text: async () => '<html></html>',
      } as any;
    });
  });

  it('imports character via Janny API and parses PNG', async () => {
    const role = await parseRoleFromURL(url);
    expect(role).toBeTruthy();
    expect(role.name).toContain('Shinichi');
    expect(role.description).toContain('Detective');
  });
});
