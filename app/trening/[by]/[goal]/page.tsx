import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cityCoordinates, cityDisplayNames, normalizeCity } from '../../../../lib/matching';
import { searchServices } from '../../../../lib/matchingDb';
import type { Goal } from '../../../../lib/domain';
import type { RankedService } from '../../../../lib/matching';
import LocalHighlights from '../../../../components/LocalHighlights';
import { ButtonLink } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { Chip } from '../../../../components/ui/Chip';
import { container } from '../../../../lib/ui';

export const revalidate = 3600;


type GoalContent = {
  slug: string;
  label: string;
  metaDescription: string;
  intro: string;
  paragraphs: string[];
};

const goalContent: Record<Goal, GoalContent> = {
  weight_loss: {
    slug: 'vektnedgang',
    label: 'Vektnedgang',
    metaDescription: 'Finn trening for trygg og varig vektnedgang, tilpasset din hverdag i byen du bor.',
    intro:
      'Trygg vektnedgang handler om vaner, styrke og kondisjon over tid. Vi matcher deg med tilbydere som tar hensyn til nivå og livssituasjon.',
    paragraphs: [
      'Vektnedgang passer for deg som ønsker mer energi, bedre helse eller en ny start, uten ekstreme løsninger.',
      'Lokale tilbud gjør det enklere å holde kontinuitet. Vi prioriterer alternativer i nærheten av deg.',
    ],
  },
  strength: {
    slug: 'styrke',
    label: 'Styrke',
    metaDescription: 'Finn styrketrening som passer deg, med lokale tilbud og tydelig oppfølging.',
    intro:
      'Styrke gir bedre hverdagsform, skadeforebygging og mestring. Du får forslag som matcher erfaring og preferanser.',
    paragraphs: [
      'Styrketrening passer både nybegynnere og erfarne, så lenge opplegget er riktig tilpasset.',
      'Lokale tilbydere gjør det enklere å trene jevnlig og få oppfølging når du trenger det.',
    ],
  },
  mobility: {
    slug: 'mobilitet',
    label: 'Mobilitet',
    metaDescription: 'Finn trening for bedre mobilitet og bevegelighet, med lokale instruktører og trygge opplegg.',
    intro:
      'Mobilitet gir en kropp som føles lettere og mer bevegelig. Her finner du tilbud som bygger opp gradvis.',
    paragraphs: [
      'Mobilitet passer for deg som vil bevege deg bedre, redusere stivhet eller komme tilbake etter skade.',
      'Lokale alternativ gjør det enkelt å prioritere korte, jevnlige økter som gir effekt over tid.',
    ],
  },
  rehab: {
    slug: 'rehab',
    label: 'Rehabilitering',
    metaDescription: 'Finn rehabiliteringstilbud og trygge treningsopplegg som tar hensyn til din situasjon.',
    intro:
      'Rehabilitering handler om trygg progresjon. Vi matcher deg med tilbydere som har fokus på kontroll og tilpasning.',
    paragraphs: [
      'Dette passer for deg som trenger å bygge deg opp etter skade eller sykdom, i ditt tempo.',
      'Å trene lokalt gjør oppfølging enklere og gir trygghet i hverdagen.',
    ],
  },
  endurance: {
    slug: 'utholdenhet',
    label: 'Utholdenhet',
    metaDescription: 'Finn trening for bedre kondisjon og utholdenhet, med lokale tilbud som matcher målene dine.',
    intro:
      'Utholdenhet gir bedre energi og kapasitet. Du får forslag som passer både nivå og ønsket intensitet.',
    paragraphs: [
      'Utholdenhet passer for deg som vil orke mer, bli raskere eller få bedre kondisjon.',
      'Lokale tilbud gjør det lettere å få kontinuitet og oppfølging over tid.',
    ],
  },
  start: {
    slug: 'nybegynner',
    label: 'Komme i gang',
    metaDescription: 'Finn nybegynnervennlig trening som gjør det enkelt å komme i gang i ditt nærområde.',
    intro:
      'Komme i gang handler om trygge første steg. Vi matcher deg med rolige og forståelige opplegg.',
    paragraphs: [
      'Dette passer for deg som vil starte med trening uten press, i et tempo som føles riktig.',
      'Lokale alternativer gjør det enklere å møte opp og bygge rutine.',
    ],
  },
};

const goalSlugMap = Object.fromEntries(
  Object.entries(goalContent).map(([goalKey, data]) => [data.slug, goalKey])
) as Record<string, Goal>;

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ogImageUrl = `${appUrl}/og-default.svg`;

const getCityDisplayName = (cityKey: string) =>
  cityDisplayNames[cityKey] ?? cityKey.charAt(0).toUpperCase() + cityKey.slice(1);

const getGoalDataFromSlug = (slug: string) => {
  const goalKey = goalSlugMap[slug];
  if (!goalKey) return null;
  return { key: goalKey, data: goalContent[goalKey] };
};

const goalToMainCategory: Record<Goal, string | undefined> = {
  strength:    'trene-selv',
  endurance:   'aktivitet-sport',
  mobility:    'trene-sammen',
  rehab:       'helse',
  weight_loss: 'oppfolging',
  start:       undefined,
};

export function generateStaticParams() {
  const cities = Object.keys(cityCoordinates);
  const goalSlugs = Object.values(goalContent).map((g) => g.slug);
  return cities.flatMap((by) => goalSlugs.map((goal) => ({ by, goal })));
}

export async function generateMetadata({
  params,
}: {
  params: { by: string; goal: string };
}): Promise<Metadata> {
  const cityKey = normalizeCity(params.by);
  const goalData = getGoalDataFromSlug(params.goal);

  if (!cityKey || !(cityKey in cityCoordinates) || !goalData) {
    return {
      title: 'Siden finnes ikke - fithub.no',
      description: 'Siden finnes ikke.',
    };
  }

  const canonicalLabel = getCityDisplayName(cityKey);
  const pageTitle = `${goalData.data.label} i ${canonicalLabel} | fithub.no`;
  const pageUrl = `${appUrl}/trening/${cityKey}/${goalData.data.slug}`;

  return {
    title: pageTitle,
    description: goalData.data.metaDescription,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pageTitle,
      description: goalData.data.metaDescription,
      url: pageUrl,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    robots: { index: true, follow: true },
  };
}

export default async function TrainingLandingPage({
  params,
}: {
  params: { by: string; goal: string };
}) {
  const cityKey = normalizeCity(params.by);
  const goalData = getGoalDataFromSlug(params.goal);

  if (!cityKey || !(cityKey in cityCoordinates) || !goalData) {
    notFound();
  }

  const cityName = getCityDisplayName(cityKey);
  const coords = cityCoordinates[cityKey];
  const canonicalLat = coords.lat;
  const canonicalLon = coords.lon;
  const canonicalLabel = cityName;

  let topResults: RankedService[] = [];
  try {
    topResults = await searchServices({
      city: cityKey,
      lat: canonicalLat,
      lon: canonicalLon,
      mainCategory: goalToMainCategory[goalData.key],
      sort: 'best_match',
      limit: 5,
    });
  } catch { /* render page with empty results */ }
  const limitedResults = topResults.length < 2;

  const resultsQueryParams = new URLSearchParams({
    location: canonicalLabel,
    sort: 'best_match',
  });
  if (goalToMainCategory[goalData.key]) {
    resultsQueryParams.set('cat', goalToMainCategory[goalData.key]!);
  }
  if (typeof canonicalLat === 'number') {
    resultsQueryParams.set('lat', canonicalLat.toString());
  }
  if (typeof canonicalLon === 'number') {
    resultsQueryParams.set('lon', canonicalLon.toString());
  }
  const resultsQuery = resultsQueryParams.toString();

  const pageUrl = `${appUrl}/trening/${cityKey}/${goalData.data.slug}`;
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'FitHub', item: appUrl },
      { '@type': 'ListItem', position: 2, name: `Trening i ${cityName}`, item: `${appUrl}/resultater?location=${encodeURIComponent(cityName)}&lat=${canonicalLat}&lon=${canonicalLon}` },
      { '@type': 'ListItem', position: 3, name: goalData.data.label, item: pageUrl },
    ],
  };

  return (
    <main className={`${container} py-12`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <section className="grid gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lokal trening
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
            {goalData.data.label} i {cityName} – finn riktig trening for deg
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            {goalData.data.intro}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            <Chip variant="outline">Tilpasset nivå</Chip>
            <Chip variant="outline">Lokale tilbydere</Chip>
            <Chip variant="outline">Uforpliktende</Chip>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4">
        <Card>
          <p className="text-sm text-slate-700">{goalData.data.paragraphs[0]}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-700">{goalData.data.paragraphs[1]}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-700">
            Derfor gir lokal matching i {cityName} tryggere og mer realistiske valg for hverdagen din.
          </p>
        </Card>
        <LocalHighlights cityKey={cityKey} cityLabel={cityName} />
      </section>

      <section className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Utvalgte treff i {cityName}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Rangert etter hva som matcher deg best.
            </p>
          </div>
          <ButtonLink href={`/resultater?${resultsQuery}`} variant="secondary">
            Se alle treff
          </ButtonLink>
        </div>

        {limitedResults && (
          <Card className="mt-6 border-amber-200 bg-amber-50 text-sm text-amber-700">
            Vi bygger fortsatt tilbud her. Start en generell match for å få hjelp nå.
          </Card>
        )}

        {topResults.length > 0 && (
          <div className="mt-6 grid gap-4">
            {topResults.map((item) => (
              <Link
                key={item.service.id}
                href={`/tilbyder/${item.service.id}?${resultsQuery}`}
                className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                {item.service.cover_image_url && (
                  <div className="relative h-36 w-full">
                    <Image
                      src={item.service.cover_image_url}
                      alt={item.service.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 800px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      {item.service.logo_image_url && (
                        <Image
                          src={item.service.logo_image_url}
                          alt={`${item.service.name} logo`}
                          width={40}
                          height={40}
                          className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover"
                        />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {item.service.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.service.description}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">{item.matchReason}</div>
                  </div>
                  {item.reasons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      {item.reasons.map((reason) => (
                        <Chip key={reason} variant="outline">
                          {reason}
                        </Chip>
                      ))}
                    </div>
                  )}
                  <p className="mt-4 text-sm font-semibold text-slate-700">Se profil →</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Finn trening som passer deg
            </h2>
            <p className="mt-2 text-sm text-slate-600">Gratis og uforpliktende.</p>
          </div>
          <ButtonLink
            href={`/resultater?${resultsQuery}`}
            variant={limitedResults ? 'secondary' : 'primary'}
            className={limitedResults ? 'opacity-80' : undefined}
          >
            Start gratis
          </ButtonLink>
        </Card>
      </section>
    </main>
  );
}
