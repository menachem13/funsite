const config = require('../config');

// Lazy singleton, same shape as mailer.js's getTransporter() — null when
// STRIPE_SECRET_KEY isn't set, so a Stripe-less deployment still boots and
// runs everything except actually charging an owner. Callers check for null
// and respond with a 503 (see routes/payments.js) rather than pretending a
// payment succeeded.
let client;

function getStripeClient() {
  if (client !== undefined) return client;
  client = config.stripeSecretKey ? require('stripe')(config.stripeSecretKey) : null;
  return client;
}

module.exports = { getStripeClient };
