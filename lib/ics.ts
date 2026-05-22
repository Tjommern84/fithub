export function generateIcsContent(
  title: string,
  startAt: Date | string,
  durationMin: number,
  location?: string,
  description?: string
): string {
  const start = typeof startAt === 'string' ? new Date(startAt) : startAt;
  const end = new Date(start.getTime() + durationMin * 60 * 1000);

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@fithub.no`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FitHub//FitHub//NO',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    ...(location ? [`LOCATION:${location.replace(/\n/g, '\\n')}`] : []),
    ...(description ? [`DESCRIPTION:${description.replace(/\n/g, '\\n')}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}
