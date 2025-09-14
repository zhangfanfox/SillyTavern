/*
 Fetch a JanitorAI character card JSON using the same flow as the app:
 1) Extract UUID from character URL
 2) POST to https://api.jannyai.com/api/v1/download to get downloadUrl
 3) Download the card (PNG/JSON), parse PNG tEXt (ccv3/chara) when needed
 4) Print the full character JSON to stdout

 Usage:
   npm run fetch:card -- <character_url>
   # or
   tsx scripts/fetch-janny-card.ts <character_url>
*/
import { parseRoleFromURL } from '../src/services/role-importers';

async function main() {
  const url = process.argv[2] || 'https://janitorai.com/characters/b4399b0a-9973-4d73-9b42-92af3ab07706_character-shinichi-kudo-%F0%9F%8F%AB-ver';
  console.log('[fetch-janny-card] URL =', url);
  const role = await parseRoleFromURL(url, {
    onProgress: (s) => { try { console.log('[progress]', s); } catch {} },
  });
  console.log('\n=== ROLE FIELDS ===');
  console.log(JSON.stringify({
    name: role.name,
    avatar: role.avatar,
    description: role.description,
    system_prompt: role.system_prompt,
    first_message: role.first_message,
  }, null, 2));
  console.log('\n=== RAW CARD JSON ===');
  console.log(JSON.stringify(role.raw, null, 2));
}

main().catch((e) => {
  console.error('[fetch-janny-card] FAILED', e);
  process.exit(1);
});
