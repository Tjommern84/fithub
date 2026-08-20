# Fremtidige moduler

Påtenkte funksjoner som ikke er implementert ennå. Skal ikke vises i UI eller nav før de er bygget.

---

## Tilbydere (`/tilbydere`)

Oversiktsside for treningssentre og tilbydere som har krevd sin profil på FitHub.
Krever: tilstrekkelig antall aktive tilbydere og en enkel listeside.
Status: fjernet fra nav inntil videre.

---

## Magasin (`/magasin`)

Redaksjonelt innhold — treningsguider, intervjuer, kosthold m.m.
Krever: CMS (f.eks. Sanity eller Contentful) og redaksjonell kapasitet.
Status: ingen plan eller tidslinje. Fjernet fra nav.

---

## Tidspunkt / «Når»-filter

Søkefilter for dato og tidspunkt — «når som helst», «i dag», «denne uken» osv.
Plassering: søkefeltet på forsiden og resultatsiden.
Krever: `group_sessions`-tabellen med reelle data og timeplan-logikk.
Status: dekorativ feltboks fjernet fra hero-søk. Ikke implementert.

---

## Gruppeøkter og timeplan (`/timer`)

Visning av kommende gruppetimer per tilbyder med direktepåmelding.
Krever: `group_sessions`-tabellen populert og bookingflyt.
Status: tabellen finnes i DB men har ~0 reelle rader i produksjon.

---

## Betalingsflyt og B2B-abonnement

Tilbydere betaler for å vises fremhevet eller for å låse opp statistikk.
Krever: Stripe-integrasjon og admin-panel.
Status: ikke påbegynt.

---

## Admin-panel

Intern visning for å godkjenne rapporterte tjenester, redigere data og se statistikk.
Krever: autentisering med admin-rolle og egne admin-sider.
Status: ikke påbegynt. `service_reports`-tabellen finnes.
