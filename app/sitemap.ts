import type { MetadataRoute } from 'next';
import { cityCoordinates } from '../lib/matching';
import { CATEGORIES } from '../lib/categoryConfig';
import { supabase } from '../lib/supabaseClient';

const BASE_URL = 'https://fithub.no';

const GOAL_SLUGS = ['styrke', 'vektnedgang', 'mobilitet', 'rehab', 'utholdenhet', 'nybegynner'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const cities = Object.keys(cityCoordinates);

  const categoryLandingPages: MetadataRoute.Sitemap = CATEGORIES.flatMap((cat) =>
    cities.map((city) => ({
      url: `${BASE_URL}/${cat.key}/${city}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  );

  const trainingPages: MetadataRoute.Sitemap = cities.flatMap((city) =>
    GOAL_SLUGS.map((goal) => ({
      url: `${BASE_URL}/trening/${city}/${goal}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  );

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                       lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/kontakt`,          lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/personvern`,       lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/vilkar`,           lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/cookies`,          lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/arrangementer/nytt`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  let providerPages: MetadataRoute.Sitemap = [];
  if (supabase) {
    try {
      const { data } = await supabase
        .from('services')
        .select('id')
        .eq('is_active', true)
        .order('rating_avg', { ascending: false })
        .limit(2000);

      if (data) {
        providerPages = (data as { id: string }[]).map((s) => ({
          url: `${BASE_URL}/tilbyder/${encodeURIComponent(s.id)}`,
          lastModified: now,
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        }));
      }
    } catch {
      // skip provider pages if fetch fails
    }
  }

  return [
    ...staticPages,
    ...categoryLandingPages,
    ...trainingPages,
    ...providerPages,
  ];
}
