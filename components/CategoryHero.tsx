import Image from 'next/image';
import type { CategoryConfig } from '../lib/categoryConfig';
import { container } from '../lib/ui';
import ScrollAwareTopNav from './ScrollAwareTopNav';

type Props = {
  catConfig: CategoryConfig | null;
  locationLabel: string | null;
  resultCount: number;
};

const FALLBACK_IMAGE = '/bilder/tur/pexels-imagevain-2346018.webp';

export default function CategoryHero({ catConfig, locationLabel, resultCount }: Props) {
  const image = catConfig?.images[0] ?? FALLBACK_IMAGE;
  const city = locationLabel ? locationLabel.split(',')[0].trim() : null;
  const title = catConfig
    ? `${catConfig.label}${city ? ` nær ${city}` : ''}`
    : city
    ? `Aktivitetstilbud nær ${city}`
    : 'Finn treningstilbud';
  const description = catConfig?.description ?? 'Søk blant tusenvis av tilbydere over hele Norge.';

  return (
    <section className="relative isolate overflow-hidden" style={{ minHeight: 340 }}>
      <ScrollAwareTopNav />

      {/* Bakgrunnsbilde */}
      <div className="absolute inset-0 z-0">
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Mørk overlay */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-brand-forest/80 via-brand-forest/45 to-brand-forest/10" />

      {/* Innhold */}
      <div
        className={`${container} relative z-10 flex flex-col justify-end pb-16 pt-32 sm:pb-20 sm:pt-36`}
        style={{ minHeight: 340 }}
      >
        <div className="max-w-[560px]">
          <h1 className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-2 text-base text-white/80">{description}</p>
          {resultCount > 0 && (
            <p className="mt-1 text-sm text-white/55">
              {resultCount} treff
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
