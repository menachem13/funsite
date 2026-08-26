const app = require('./app');
const config = require('./config');
const { startCronJobs } = require('./jobs/cron');

app.listen(config.port, () => {
  console.log(`Spotly API listening on port ${config.port} (${config.nodeEnv})`);
  startCronJobs();
});
