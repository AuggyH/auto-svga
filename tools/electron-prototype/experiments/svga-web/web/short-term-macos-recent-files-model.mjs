export const LAUNCH_RECENT_LIMIT = 5;

export function visibleLaunchRecentRecords(result, limit = LAUNCH_RECENT_LIMIT) {
  const records = Array.isArray(result?.records) ? result.records : [];
  return records.slice(0, limit);
}
