#!/usr/bin/env tsx
/**
 * Sjekker SATS-lokasjoner mot databasen, legger til manglende,
 * og setter website='https://www.sats.no' på alle SATS-entries.
 *
 * Usage:
 *   npx tsx scripts/push-sats.ts --dry-run
 *   npx tsx scripts/push-sats.ts
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const DRY_RUN = process.argv.includes('--dry-run');
const WEBSITE = 'https://www.sats.no';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SATS_LOCATIONS: { name: string; address: string; city: string }[] = [
  { name: 'SATS Akersgata',          address: 'Akersgata 51, 0180 Oslo',                    city: 'oslo' },
  { name: 'SATS Aquarama',           address: 'Tangen 8, 4608 Kristiansand',                city: 'kristiansand' },
  { name: 'SATS Asker',              address: 'Erteløkka 1, 1384 Asker',                    city: 'asker' },
  { name: 'SATS Bekkestua',          address: 'Gamle Ringeriksvei 34c, 1357 Bekkestua',     city: 'bærum' },
  { name: 'SATS Bekkestua stasjon',  address: 'Bærumsveien 206, 1357 Bekkestua',            city: 'bærum' },
  { name: 'SATS Bergen LHG',         address: 'Lars Hillesgate 29, 5008 Bergen',             city: 'bergen' },
  { name: 'SATS Billingstad',        address: 'Billingstadsletta 11, 1396 Billingstad',      city: 'asker' },
  { name: 'SATS Bislett',            address: 'Bislettgata 6, 0170 Oslo',                   city: 'oslo' },
  { name: 'SATS Bjørvika',           address: 'Dronning Eufemias Gate 18, 0191 Oslo',       city: 'oslo' },
  { name: 'SATS Bryne',              address: 'Trallfaveien 1, 4340 Bryne',                 city: 'bryne' },
  { name: 'SATS Carl Berner',        address: 'Trondheimsveien 135, 0570 Oslo',             city: 'oslo' },
  { name: 'SATS CC Vest',            address: 'Lilleakerveien 14, 0283 Oslo',               city: 'oslo' },
  { name: 'SATS Colosseum',          address: 'Middelthunsgate 19, 0368 Oslo',              city: 'oslo' },
  { name: 'SATS Damsgård',           address: 'Damsgårdsveien 135, 5160 Laksevåg',          city: 'bergen' },
  { name: 'SATS Danmarksplass',      address: 'Solheimsgaten 58, 5054 Bergen',              city: 'bergen' },
  { name: 'SATS Drammen',            address: 'Brandtenborggate 1, 3002 Drammen',           city: 'drammen' },
  { name: 'SATS Fagerborg',          address: 'Pilestredet 75C, 0354 Oslo',                 city: 'oslo' },
  { name: 'SATS Fornebu',            address: 'Forneburingen 209, 1364 Fornebu',            city: 'bærum' },
  { name: 'SATS Forus',              address: 'Svanholmen 2, 4033 Stavanger',               city: 'stavanger' },
  { name: 'SATS Fredrikstad',        address: 'Kråkerøyveien 4, 1671 Kråkerøy',            city: 'fredrikstad' },
  { name: 'SATS Hasle',              address: 'Grenseveien 50, 0579 Oslo',                  city: 'oslo' },
  { name: 'SATS Hellerud',           address: 'Tvetenveien 168, 0671 Oslo',                 city: 'oslo' },
  { name: 'SATS Herbarium',          address: 'Lars Hertervigs Gate 6, 4005 Stavanger',     city: 'stavanger' },
  { name: 'SATS Hillevåg',           address: 'Hillevågsveien 25, 4016 Stavanger',          city: 'stavanger' },
  { name: 'SATS Hoff',               address: 'Hoffsveien 10, 0278 Oslo',                   city: 'oslo' },
  { name: 'SATS Ila',                address: 'Waldemar Thranes Gate 86, 0175 Oslo',        city: 'oslo' },
  { name: 'SATS Jessheim',           address: 'Industrivegen 21, 2069 Jessheim',            city: 'jessheim' },
  { name: 'SATS Kalbakken',          address: 'Kalbakkveien 6, 0953 Oslo',                  city: 'oslo' },
  { name: 'SATS Kampen',             address: 'Østerdalsgata 1, 0658 Oslo',                 city: 'oslo' },
  { name: 'SATS Karlsrud',           address: 'Cecilie Thoresensvei 3, 1153 Oslo',          city: 'oslo' },
  { name: 'SATS Klosterøya',         address: 'Unionsgata 5, 3732 Skien',                   city: 'skien' },
  { name: 'SATS Kokstad',            address: 'Kokstadvegen 25B, 5257 Kokstad',             city: 'bergen' },
  { name: 'SATS Kolbotn',            address: 'Kolbotnveien 12, 1410 Kolbotn',              city: 'oppegård' },
  { name: 'SATS Lagunen',            address: 'Laguneveien 1, 5239 Rådal',                  city: 'bergen' },
  { name: 'SATS Lambertseter',       address: 'Langbølgen 5, 1153 Oslo',                    city: 'oslo' },
  { name: 'SATS Langnes',            address: 'Huldervegen 8, 9016 Tromsø',                 city: 'tromsø' },
  { name: 'SATS Lillestrøm',         address: 'Dampsagveien 12, 2000 Lillestrøm',           city: 'lillestrøm' },
  { name: 'SATS Linderud',           address: 'Erich Mogensøns Vei 38, 0517 Oslo',          city: 'oslo' },
  { name: 'SATS Madla',              address: 'Madlakrossen 9, 4042 Hafrsfjord',            city: 'stavanger' },
  { name: 'SATS Metro',              address: 'Kulturhusgata 2, 1473 Lørenskog',            city: 'lørenskog' },
  { name: 'SATS Nationalteateret',   address: 'Ruseløkkveien 6, 0251 Oslo',                 city: 'oslo' },
  { name: 'SATS Nesttun',            address: 'Apeltunvegen 2, 5223 Nesttun',               city: 'bergen' },
  { name: 'SATS Njård',              address: 'Sørkedalsveien 106, 0378 Oslo',              city: 'oslo' },
  { name: 'SATS Nydalen',            address: 'Sandakerveien 109, 0484 Oslo',               city: 'oslo' },
  { name: 'SATS Oasen',              address: 'Folke Bernadottes Vei 52, 5881 Bergen',      city: 'bergen' },
  { name: 'SATS Porselensfabrikken', address: 'Porselensvegen 8, 3920 Porsgrunn',           city: 'porsgrunn' },
  { name: 'SATS Porsgrunn',          address: 'Jernbanegata 3, 3916 Porsgrunn',             city: 'porsgrunn' },
  { name: 'SATS Ringnes Park',       address: 'Sannergata 6b, 0557 Oslo',                   city: 'oslo' },
  { name: 'SATS Ryen',               address: 'Ryensvingen 5, 0680 Oslo',                   city: 'oslo' },
  { name: 'SATS Røa',                address: 'Tore Hals Mejdells Vei 18, 0751 Oslo',       city: 'oslo' },
  { name: 'SATS Sagene',             address: 'Pontoppidans Gate 7, 0462 Oslo',             city: 'oslo' },
  { name: 'SATS Sandnes',            address: 'Vågsgata 16, 4306 Sandnes',                  city: 'sandnes' },
  { name: 'SATS Sandvika Panorama',  address: 'Sandviksveien 176, 1338 Sandvika',           city: 'bærum' },
  { name: 'SATS Sandviken',          address: 'Måseskjæret 3, 5035 Bergen',                 city: 'bergen' },
  { name: 'SATS Sarpsborg',          address: 'Roald Amundsens Gate 36, 1723 Sarpsborg',    city: 'sarpsborg' },
  { name: 'SATS Schous plass',       address: 'Trondheimsveien 2D, 0560 Oslo',              city: 'oslo' },
  { name: 'SATS Sjølyst',            address: 'Karenslyst Allé 7, 0278 Oslo',               city: 'oslo' },
  { name: 'SATS Skedsmokorset',      address: 'Furuholtet 1, 2020 Skedsmokorset',           city: 'lillestrøm' },
  { name: 'SATS Slemmestad',         address: 'Kirkeallen 1, 3470 Slemmestad',              city: 'røyken' },
  { name: 'SATS Solli',              address: 'Henrik Ibsensgate 100, 0254 Oslo',           city: 'oslo' },
  { name: 'SATS Stadionparken',      address: 'Jåttåvågveien 7, 4020 Stavanger',            city: 'stavanger' },
  { name: 'SATS Storhaug',           address: 'Kvitsøygata 19b, 4014 Stavanger',            city: 'stavanger' },
  { name: 'SATS Storo',              address: 'Vitaminveien 7, 0485 Oslo',                  city: 'oslo' },
  { name: 'SATS Strømsø',            address: 'CO Lunds Gate 25, 3043 Drammen',             city: 'drammen' },
  { name: 'SATS Tasta',              address: 'Tastatunet 1, 4027 Stavanger',               city: 'stavanger' },
  { name: 'SATS Triaden',            address: 'Gamleveien 88, 1461 Lørenskog',              city: 'lørenskog' },
  { name: 'SATS Trim Towers',        address: 'Larsamyråen 18, 4313 Sandnes',               city: 'sandnes' },
  { name: 'SATS Tromsø',             address: 'Fredrik Langesgate 12, 9008 Tromsø',         city: 'tromsø' },
  { name: 'SATS Tunejordet',         address: 'Vingulmorkveien 27, 1710 Sarpsborg',         city: 'sarpsborg' },
  { name: 'SATS Ullevaal',           address: 'Sognsveien 75, 0855 Oslo',                   city: 'oslo' },
  { name: 'SATS Vestkanten',         address: 'Loddefjordveien 2, 5881 Bergen',             city: 'bergen' },
  { name: 'SATS Vinderen',           address: 'Slemdalsveien 70, 0373 Oslo',                city: 'oslo' },
  { name: 'SATS Vågsbygd',           address: 'Fiskåveien 4, 4621 Kristiansand',            city: 'kristiansand' },
  { name: 'SATS Wergeland',          address: 'Storetveitvegen 6, 5067 Bergen',             city: 'bergen' },
  { name: 'SATS Yoga Aker Brygge',   address: 'Bryggetorget 5, 0250 Oslo',                  city: 'oslo' },
  { name: 'SATS Yoga Majorstuen',    address: "Schultz' Gate 1, 0368 Oslo",                 city: 'oslo' },
  { name: 'SATS Åsane',              address: 'Myrdalsvegen 2, 5132 Nyborg',                city: 'bergen' },
  { name: 'SATS Åssiden',            address: 'Ingvald Ludvigsens Gate 21, 3027 Drammen',   city: 'drammen' },
];

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  await new Promise((r) => setTimeout(r, 1100));
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address + ', Norge')}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'fithub/1.0 (fithub.no)' } });
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { return null; }
}

function makeId(name: string, address: string): string {
  return 'sats_' + (name + '_' + address.split(',')[0])
    .toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

async function main() {
  console.log(`\npush-sats  (${SATS_LOCATIONS.length} lokasjoner)${DRY_RUN ? '  DRY RUN' : ''}\n`);

  // Fetch all SATS entries from DB
  const { data: existing } = await supabase
    .from('services')
    .select('id, name, address, website')
    .ilike('name', '%sats%');

  const dbSats = existing ?? [];
  console.log(`Fant ${dbSats.length} SATS-entries i databasen.\n`);

  // --- Step 1: Update website on all existing SATS entries ---
  const missingWebsite = dbSats.filter((s) => s.website !== WEBSITE);
  if (missingWebsite.length > 0 && !DRY_RUN) {
    const ids = missingWebsite.map((s) => s.id);
    const { error } = await supabase
      .from('services')
      .update({ website: WEBSITE })
      .in('id', ids);
    if (error) console.log(`⚠️  website-oppdatering feilet: ${error.message}`);
    else console.log(`✅ Website satt på ${ids.length} eksisterende SATS-entries.\n`);
  } else if (missingWebsite.length > 0) {
    console.log(`[dry] Ville oppdatert website på ${missingWebsite.length} eksisterende entries.\n`);
  } else {
    console.log(`✅ Alle eksisterende SATS-entries har allerede website.\n`);
  }

  // --- Step 2: Find missing locations ---
  const missing = SATS_LOCATIONS.filter((loc) => {
    const street = loc.address.split(',')[0].trim().toLowerCase();
    return !dbSats.some((s) => {
      const dbAddr = (s.address ?? '').toLowerCase();
      const dbName = (s.name ?? '').toLowerCase();
      const locShort = loc.name.replace('SATS ', '').toLowerCase();
      return dbAddr.includes(street) || dbName.includes(locShort);
    });
  });

  if (missing.length === 0) {
    console.log('✅ Alle SATS-lokasjoner er allerede i databasen!');
    return;
  }

  console.log(`Mangler ${missing.length} lokasjoner — legger til:\n`);

  let inserted = 0, failed = 0;

  for (const loc of missing) {
    process.stdout.write(`  ${loc.name.padEnd(28)} `);

    const coords = await geocode(loc.address);
    if (!coords) {
      console.log('❌ geocode feilet');
      failed++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry] ${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`);
      continue;
    }

    const id = makeId(loc.name, loc.address);
    const pointWkt = `SRID=4326;POINT(${coords.lon} ${coords.lat})`;

    const { error: svcErr } = await supabase.from('services').upsert({
      id,
      name: loc.name,
      address: loc.address,
      type: 'styrke',
      main_category: 'trene-selv',
      description: 'SATS – treningssenter med gruppetimer og styrke',
      price_level: 'medium',
      venues: ['gym'],
      goals: ['strength', 'weight_loss', 'kondisjon'],
      tags: ['treningssenter', 'styrketrening', 'kondisjon', 'gruppetimer', 'sats'],
      is_active: true,
      website: WEBSITE,
      base_location: pointWkt,
    }, { onConflict: 'id' });

    if (svcErr) { console.log(`❌ ${svcErr.message}`); failed++; continue; }

    // Coverage
    const { data: existingCov } = await supabase
      .from('service_coverage')
      .select('id')
      .eq('service_id', id).eq('type', 'city').eq('city', loc.city)
      .maybeSingle();

    if (!existingCov) {
      await supabase.from('service_coverage').insert({ service_id: id, type: 'city', city: loc.city });
    }

    // service_types
    await supabase.from('service_types').upsert(
      ['styrke', 'kondisjon', 'gruppe'].map((t) => ({ service_id: id, type: t })),
      { onConflict: 'service_id,type' }
    );

    console.log(`✅ ${id}`);
    inserted++;
  }

  console.log(`\nFerdig.  Lagt til: ${inserted}  Feilet: ${failed}\n`);
}

main().catch(console.error);
