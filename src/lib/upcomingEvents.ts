/** Date locale du téléphone au format AAAA-MM-JJ. */
export function todayIso(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/**
 * Événements à proposer : ceux du jour ou à venir. Un événement sans date exploitable est conservé
 * (on ne cache pas ce que l'admin a saisi) ; l'ordre d'origine est respecté.
 */
export function upcomingEvents<T extends { event_date?: unknown }>(events: readonly T[], today: string): T[] {
  return events.filter((e) => {
    const d = typeof e.event_date === 'string' ? e.event_date.slice(0, 10) : '';
    return !/^\d{4}-\d{2}-\d{2}$/.test(d) || d >= today;
  });
}
