const FALLBACK_TIME_ZONE = "UTC";

/** The browser's IANA time zone, used as the default for new schedules. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

/** "GMT+2", "GMT-3:30", "GMT" for the zone's current offset; empty if the engine can't tell. */
export function timeZoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(at);
    return normalizeOffset(parts.find((part) => part.type === "timeZoneName")?.value ?? "");
  } catch {
    return "";
  }
}

/** ICU versions disagree on a zero offset ("GMT" vs "GMT+0"); render it the same everywhere. */
export function normalizeOffset(label: string): string {
  return /^GMT[+-]0(:00)?$/.test(label) ? "GMT" : label;
}

let cachedZones: string[] | null = null;

/** All IANA zones the browser knows, plus UTC (V8 omits it from supportedValuesOf). */
export function supportedTimeZones(): string[] {
  if (cachedZones) return cachedZones;
  let zones: string[] = [];
  try {
    if (typeof Intl.supportedValuesOf === "function") zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  const set = new Set(zones);
  set.add(FALLBACK_TIME_ZONE);
  set.add(browserTimeZone());
  cachedZones = [...set].sort((a, b) => a.localeCompare(b));
  return cachedZones;
}

export interface TimeZoneOption {
  value: string;
  label: string;
}

/** Select options, guaranteed to include `extra` (e.g. a zone stored on an existing scheduling). */
export function timeZoneOptions(extra?: string | null, at: Date = new Date()): TimeZoneOption[] {
  const zones = supportedTimeZones();
  const all = extra && !zones.includes(extra) ? [extra, ...zones] : zones;
  return all.map((zone) => {
    const offset = timeZoneOffsetLabel(zone, at);
    return { value: zone, label: offset ? `${zone.replace(/_/g, " ")} (${offset})` : zone.replace(/_/g, " ") };
  });
}
