import type { Metadata } from 'next';
import HomeHero from '../components/home/HomeHero';
import HomeValueProps from '../components/home/HomeValueProps';
import HomeNearbyActivities from '../components/home/HomeNearbyActivities';
import HomeDestinations from '../components/home/HomeDestinations';
import CategoryGrid from '../components/CategoryGrid';

export const metadata: Metadata = {
  title: 'FitHub – Finn trening som passer deg',
  description: 'Finn treningssenter, personlig trener, yoga, gruppetrening og mer – lokalt over hele Norge. Gratis og uforpliktende matching.',
  openGraph: {
    title: 'FitHub – Finn trening som passer deg',
    description: 'Finn treningssenter, personlig trener, yoga, gruppetrening og mer – lokalt over hele Norge. Gratis og uforpliktende matching.',
    url: 'https://fithub.no',
    type: 'website',
  },
};

const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'FitHub',
  url: 'https://fithub.no',
  description: 'Finn trening som passer deg – lokale tilbydere over hele Norge',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://fithub.no/resultater?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function HomePage() {
  return (
    <main className="bg-brand-beige">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <HomeHero />
      <HomeValueProps id="hvordan-funker-det" />
      <HomeNearbyActivities />
      <HomeDestinations />
      <CategoryGrid />
    </main>
  );
}
