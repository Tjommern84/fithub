const VALUE_PROPS = [
  {
    title: 'Finn aktiviteter',
    description:
      'Oppdag alt som skjer nær deg – fra trening og kurs til turer og friluftsliv.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
      </svg>
    ),
  },
  {
    title: 'Bli med andre',
    description:
      'Finn folk å være aktiv sammen med, eller opprett din egen aktivitet.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 20c0-3 2.5-5 5-5s5 2 5 5M14.5 20c0-2.2 1.4-4 3.5-4.5" />
      </svg>
    ),
  },
  {
    title: 'Følg det du liker',
    description:
      'Få varsler om nye timer, arrangementer og tilbud som passer for deg.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 22a2 2 0 0 0 4 0" />
      </svg>
    ),
  },
];

export default function HomeValueProps({ id }: { id?: string }) {
  return (
    <section id={id} className="bg-white pb-14 pt-28 sm:pb-16 sm:pt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-7 sm:grid-cols-3 sm:gap-10">
          {VALUE_PROPS.map((item) => (
            <div key={item.title} className="flex items-start gap-4 text-left sm:block">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-copper">
                {item.icon}
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-brand-forest sm:mt-4">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:mt-2">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
