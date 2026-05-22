#!/usr/bin/env tsx
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const EVO_LOCATIONS = [
  { name: 'Fagerholt',           address: 'Magnus Barfots vei 9a, Kristiansand' },
  { name: 'Kristiansand Sentrum',address: 'Tordenskjolds gate 2, Kristiansand' },
  { name: 'Asker',               address: 'Fusdal Terrasse 3, Asker' },
  { name: 'Asker Sentrum',       address: 'Bankveien 10, Asker' },
  { name: 'Drøbak',              address: 'Holterveien 2a, Drøbak' },
  { name: 'Jessheim',            address: 'Nordre Dølibekken 12, Jessheim' },
  { name: 'Lillestrøm',          address: 'Sørumsgata 14, Lillestrøm' },
  { name: 'Nannestad',           address: 'Teiealleen 5, Nannestad' },
  { name: 'Østerås',             address: 'Grini Næringspark 1, Østerås' },
  { name: 'Sandvika',            address: 'Leif Tronstads plass 7, Sandvika' },
  { name: 'SNØ Lørenskog',       address: 'Snøfonna 1, Lørenskog' },
  { name: 'Stabekk',             address: 'Gamle Drammensvei 46a, Stabekk' },
  { name: 'CC Drammen',          address: 'Tomtegata 36, Drammen' },
  { name: 'Drammen',             address: 'Nedre Torggate 17, Drammen' },
  { name: 'Hønefoss',            address: 'Kong Rings gate 1, Hønefoss' },
  { name: 'Kongsberg',           address: 'Herman Foss gate 12, Kongsberg' },
  { name: 'Konnerud',            address: 'Pettersvollen 3, Drammen' },
  { name: 'Strømsø',             address: 'Bjørnstjerne Bjørnsons gate 60, Drammen' },
  { name: 'Kirkenes-Hesseng',    address: 'E. K. Andersons vei 44, Hesseng' },
  { name: 'Gjøvik',              address: 'Tordenskjolds gate 3, Gjøvik' },
  { name: 'Gran',                address: 'Storgata 10, Gran' },
  { name: 'Hamar',               address: 'Skogvegen 16a, Hamar' },
  { name: 'Lillehammer',         address: 'Gudbrandsdalsvegen 188, Lillehammer' },
  { name: 'Narvik',              address: 'Bolagsgata 20, Narvik' },
  { name: 'Adamstuen',           address: 'Ullevålsveien, Oslo' },
  { name: 'Årvoll',              address: 'Årvollveien 23, Oslo' },
  { name: 'Bøler',               address: 'Utmarkveien 1, Oslo' },
  { name: 'Bryn',                address: 'Østensjøveien 79, Oslo' },
  { name: 'Frysja',              address: 'Frysjaveien 42, Oslo' },
  { name: 'Grorud',              address: 'Rosenbergveien 15, Oslo' },
  { name: 'Grünerløkka',         address: 'Thorvald Meyers gate 72, Oslo' },
  { name: 'Holmlia',             address: 'Holmlia Senter vei 18, Oslo' },
  { name: 'Ila',                 address: 'Vøyensvingen 7, Oslo' },
  { name: 'Lambertseter',        address: 'Cecilie Thoresens vei 17, Oslo' },
  { name: 'Løren',               address: 'Lørenveien 37, Oslo' },
  { name: 'Majorstua',           address: 'Sørkedalsveien 9, Oslo' },
  { name: 'Nordberg',            address: 'Langmyrgrenda 1, Oslo' },
  { name: 'Nordstrand',          address: 'Ekebergveien 233, Oslo' },
  { name: 'Nydalen',             address: 'Nydalsveien 36, Oslo' },
  { name: 'Oscarsgate',          address: 'Oscars gate 20, Oslo' },
  { name: 'Røa',                 address: 'Vækerøveien 207, Oslo' },
  { name: 'Ryen',                address: 'Ryensvingen 3, Oslo' },
  { name: 'Sjølyst',             address: 'Karenslyst Allé 12-14, Oslo' },
  { name: 'Teisen',              address: 'Ole Deviks vei 6, Oslo' },
  { name: 'Vålerenga',           address: 'Østerdalsgata 7, Oslo' },
  { name: 'Vika',                address: 'Munkedamsveien 20, Oslo' },
  { name: 'Vollebekk',           address: 'Brobekkveien 53, Oslo' },
  { name: 'Fredrikstad',         address: 'Storgata 32, Fredrikstad' },
  { name: 'Greåker',             address: 'Tamburveien 9, Greåker' },
  { name: 'Gressvik',            address: 'Storveien 81, Gressvik' },
  { name: 'Moss',                address: 'Dronningens gate 1, Moss' },
  { name: 'Østfoldhallen',       address: 'Dikeveien 28, Rolvsøy' },
  { name: 'Ålgård',              address: 'Ålgårdsheia 6, Ålgård' },
  { name: 'Bjergsted',           address: 'Kaptein Mejlænders gate 23, Stavanger' },
  { name: 'Bryne',               address: 'Arne Garborgs veg 17, Bryne' },
  { name: 'Bryne Torg',          address: 'Meierigata 3, Bryne' },
  { name: 'Egersund',            address: 'Elganeveien 1, Egersund' },
  { name: 'Forus',               address: 'Lagerveien 1, Stavanger' },
  { name: 'Haugesund',           address: 'Karmsundgata 72, Haugesund' },
  { name: 'Kannik',              address: 'Engelsminnegata 16, Stavanger' },
  { name: 'Paradis',             address: 'Lagårdsveien 78, Stavanger' },
  { name: 'Sandnes',             address: 'Erling Skjalgssons gate 2a, Sandnes' },
  { name: 'Sola',                address: 'Vingvegen 3, Sola' },
  { name: 'Storhaug',            address: 'Støperigata 38, Stavanger' },
  { name: 'Tollnes',             address: 'Porsgrunnsvegen 261, Skien' },
  { name: 'Tromsø Nord',         address: 'Stakkevollvegen 63, Tromsø' },
  { name: 'Tromsø sentrum',      address: 'Skippergata 16, Tromsø' },
  { name: 'Tromsø Sør',          address: 'Strandvegen 140, Tromsø' },
  { name: 'Heimdal',             address: 'Industriveien 13, Heimdal' },
  { name: 'Levanger',            address: 'Jernbanegata 11, Levanger' },
  { name: 'Sorgenfri',           address: 'Sorgenfriveien 28, Sorgenfri' },
  { name: 'Tiller',              address: 'Ivar Lykkes veg 9, Tiller' },
  { name: 'Horten',              address: 'Strandparken 3-5, Horten' },
  { name: 'Larvik',              address: 'Frankendalsveien 97, Larvik' },
  { name: 'Nøtterøy',            address: 'Kjernåsveien 13A, Vestskogen' },
  { name: 'Sandefjord Øst',      address: 'Uranienborgveien 4, Sandefjord' },
  { name: 'Sandefjord Vest',     address: 'Skiringssalveien 20, Sandefjord' },
  { name: 'Tønsberg',            address: 'Heimdalsvingen 1, Tønsberg' },
  { name: 'Damsgårdsundet',      address: 'Damsgårdsveien 82, Bergen' },
  { name: 'Fyllingsdalen',       address: 'Hjalmar Brantings vei 2a, Fyllingsdalen' },
  { name: 'Godvik',              address: 'Godviksvingene 127, Godvik' },
  { name: 'Nesttun',             address: 'Østre Nesttunvegen 10, Nesttun' },
  { name: 'Nordås',              address: 'Sørådshøgda 9, Rådalsvegen' },
  { name: 'Nordnes',             address: 'C. Sundts gate 53, Bergen' },
  { name: 'Os',                  address: 'Industrivegen 2, Os' },
  { name: 'Sandsli',             address: 'Sandsliåsen 40, Sandsli' },
  { name: 'Toppe',               address: 'Toppemyr 7, Mjølkeråen' },
];

async function main() {
  console.log(`\nSjekker ${EVO_LOCATIONS.length} EVO-lokasjoner mot databasen...\n`);

  // Fetch all EVO services from DB
  const { data, error } = await supabase
    .from('services')
    .select('id, name, address, base_location')
    .ilike('name', '%evo%')
    .order('name');

  if (error) { console.error('DB-feil:', error); process.exit(1); }

  const dbServices = data ?? [];
  console.log(`Fant ${dbServices.length} EVO-tjenester i databasen:\n`);
  for (const s of dbServices) {
    const hasCoords = !!s.base_location;
    console.log(`  ${hasCoords ? '📍' : '  '} ${s.id}  ${s.name}  |  ${s.address ?? '(ingen adresse)'}`);
  }

  // Cross-check: which official EVO locations are missing?
  console.log('\n─────────────────────────────────────────');
  console.log('Sjekker hvilke offisielle lokasjoner som mangler:\n');

  const missing: typeof EVO_LOCATIONS = [];
  for (const loc of EVO_LOCATIONS) {
    const addrLower = loc.address.toLowerCase();
    const streetMatch = addrLower.split(',')[0].trim();
    const found = dbServices.some((s) => {
      const dbAddr = (s.address ?? '').toLowerCase();
      const dbName = (s.name ?? '').toLowerCase();
      return dbAddr.includes(streetMatch) || dbName.includes(loc.name.toLowerCase());
    });
    if (!found) missing.push(loc);
  }

  if (missing.length === 0) {
    console.log('✅ Alle EVO-lokasjoner er i databasen!');
  } else {
    console.log(`❌ ${missing.length} lokasjoner mangler:\n`);
    for (const loc of missing) {
      console.log(`  - EVO ${loc.name.padEnd(22)} ${loc.address}`);
    }
  }

  // Summary
  console.log('\n─────────────────────────────────────────');
  const withCoords = dbServices.filter((s) => s.base_location).length;
  console.log(`\nOppsummering:`);
  console.log(`  Offisielle EVO-lokasjoner:  ${EVO_LOCATIONS.length}`);
  console.log(`  I databasen:                ${dbServices.length}`);
  console.log(`  Med koordinater:            ${withCoords}`);
  console.log(`  Uten koordinater:           ${dbServices.length - withCoords}`);
  console.log(`  Mangler totalt:             ${missing.length}\n`);
}

main().catch(console.error);
