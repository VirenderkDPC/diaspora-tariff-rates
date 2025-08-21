// Netlify Function: Shopify Custom Carrier Service callback
// URL: https://diaspora-tariff-rates.netlify.app/.netlify/functions/rates

export async function handler(event) {
  try {
    // Handy GET for browser sanity checks
    if (event.httpMethod === "GET") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          note: "This endpoint expects POST from Shopify CCS.",
          example_curl: "curl -X POST https://diaspora-tariff-rates.netlify.app/.netlify/functions/rates -H 'Content-Type: application/json' -d '{\"rate\":{\"destination\":{\"country\":\"US\"},\"currency\":\"USD\",\"items\":[{\"requires_shipping\":true,\"gift_card\":false,\"price\":1200,\"quantity\":2}]}}'"
        })
      };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { rate = {} } = JSON.parse(event.body || "{}");
    const dest = rate.destination || {};
    const items = Array.isArray(rate.items) ? rate.items : [];
    const isUS = dest.country === "US";
    const currency = rate.currency || "USD";

    // Eligible subtotal in cents -> dollars (exclude non-physical/gift cards)
    const eligibleCents = items
      .filter(i => i?.requires_shipping && !i?.gift_card)
      .reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.quantity || 0)), 0);

    const subtotal = Math.round(eligibleCents) / 100; // dollars, post-discount

    // Config knobs (override in Netlify → Environment variables)
    const PCT = Number(process.env.TARIFF_PERCENT || "0.05"); // 5%
    const MIN = Number(process.env.TARIFF_MIN || "0");        // $0 = no min
    const MAX = Number(process.env.TARIFF_MAX || "0");        // $0 = no cap
    const baseUS   = Number(process.env.BASE_US   || "6.00");
    const baseIntl = Number(process.env.BASE_INTL || "18.00");

    let fee = isUS ? +(subtotal * PCT).toFixed(2) : 0;
    if (MIN > 0 && fee < MIN) fee = MIN;
    if (MAX > 0 && fee > MAX) fee = MAX;

    const total = +((isUS ? baseUS : baseIntl) + fee).toFixed(2);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rates: [{
          service_name: isUS
            ? `Standard (Shipping + Tariff ${Math.round(PCT*100)}%)`
            : `Standard International`,
          service_code: isUS ? "US_TARIFF" : "INTL",
          description: isUS
            ? "Includes tariff surcharge based on 5% of merchandise subtotal"
            : "Standard international shipping",
          currency,
          total_price: String(Math.round(total * 100)) // cents
        }]
      })
    };
  } catch (err) {
    // Returning 404 lets Shopify fall back to any backup flat rates you configured
    return { statusCode: 404, body: "Rate error" };
  }
}
