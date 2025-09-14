/*
 Simple test runner for role importer using tsx.
 Mocks fetch for Janny API and PNG download. Verifies name parsed.
*/
import { Buffer } from 'buffer';
import { parseRoleFromURL } from '../src/services/role-importers';

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      const b = c & 1;
      c = (c >>> 1) >>> 0;
      if (b) c = (c ^ 0xedb88320) >>> 0;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): Uint8Array { return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]); }

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const te = new TextEncoder();
  const typeBytes = te.encode(type);
  const len = u32(data.length);
  const crc = u32(crc32(new Uint8Array([...typeBytes, ...data])));
  return new Uint8Array([...len, ...typeBytes, ...data, ...crc]);
}

function buildPngWithText(keyword: string, text: string): Uint8Array {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR 1x1 RGBA
  const ihdr = pngChunk('IHDR', new Uint8Array([...u32(1), ...u32(1), 8, 6, 0, 0, 0]));
  const te = new TextEncoder();
  const k = te.encode(keyword);
  const v = te.encode(text);
  const data = new Uint8Array([...k, 0x00, ...v]);
  const textChunk = pngChunk('tEXt', data);
  const iend = pngChunk('IEND', new Uint8Array());
  return new Uint8Array([...sig, ...ihdr, ...textChunk, ...iend]);
}

async function main() {
  const uuid = 'b4399b0a-9973-4d73-9b42-92af3ab07706';
  const url = `https://janitorai.com/characters/${uuid}_character-shinichi-kudo-%F0%9F%8F%AB-ver`;

  const cardJson = {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: 'Shinichi Kudo 🏫 ver',
      description: 'Detective high schooler',
      system_prompt: 'Be deductive',
      first_mes: 'Hello.',
    },
  };
  const cardText = JSON.stringify(cardJson);
  const b64 = Buffer.from(cardText, 'utf-8').toString('base64');
  const png = buildPngWithText('ccv3', b64);

  // Mock global fetch
  (globalThis as any).fetch = async (input: any, init?: any) => {
    const s = String(input);
    if (s.includes('api.jannyai.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', downloadUrl: 'https://files.example.com/fake-card.png' }),
        text: async () => JSON.stringify({ status: 'ok' }),
      } as any;
    }
    if (s.includes('files.example.com')) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
        headers: new Map([['content-type', 'image/png']]),
      } as any;
    }
    // Fallback: page fetch
    return {
      ok: true,
      status: 200,
      text: async () => '<html></html>',
    } as any;
  };

  const role = await parseRoleFromURL(url);
  console.log('TEST: role.name =', role.name);
  if (!role.name.includes('Shinichi')) {
    throw new Error('Role name did not match expected.');
  }
  console.log('OK');
}

main().catch((e) => {
  console.error('TEST FAILED', e);
  process.exit(1);
});
