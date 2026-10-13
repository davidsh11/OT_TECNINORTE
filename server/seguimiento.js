// Ecuador continental uses UTC-5. Query ISO reception dates at local month boundaries.
function trackingMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  return { from: new Date(Date.UTC(year, month - 1, 1, 5)).toISOString(), to: new Date(Date.UTC(year, month, 1, 5)).toISOString() };
}
module.exports = { trackingMonthRange };
