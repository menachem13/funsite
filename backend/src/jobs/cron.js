const cron = require('node-cron');
const { runFeaturedRotation } = require('../services/featuredRotation');
const { expireLapsedSubscriptions } = require('../services/subscriptionExpiry');

/** Nightly sweep: expire lapsed subscriptions, then pick today's featured listing. */
async function runNightlySweep() {
  const expiredIds = await expireLapsedSubscriptions();
  if (expiredIds.length > 0) {
    console.log(`Expired ${expiredIds.length} listing(s): ${expiredIds.join(', ')}`);
  }

  const featuredId = await runFeaturedRotation();
  console.log(featuredId ? `Featured listing for today: ${featuredId}` : 'No active listings to feature today.');
}

function startCronJobs() {
  // Every day at 02:00 server time.
  cron.schedule('0 2 * * *', () => {
    runNightlySweep().catch((err) => console.error('Nightly sweep failed:', err));
  });
}

module.exports = { startCronJobs, runNightlySweep };
