export const settings = {
  slice: { minimum: 3, softMaximum: 5, guaranteedDays: 14, currentDays: 90 },
  timeZone: "America/Denver",
  eventsMonthsAhead: 6,
} as const;

export type SliceSettings = typeof settings.slice;
