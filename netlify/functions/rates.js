// Shopify Custom Carrier Service callback (Netlify Function)
export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { rate = {} } = JSON.parse(event.body || "{}");
    const dest = rate.destination || {};
    const items = Array.isArray(rate.items) ? rate.items : [];
    const isUS = dest.country === "US";
    const currency = rate.currency || "USD";

    // Eligible subtotal: exclude gift cards & non-physical items (cents → dollars)
    const eligibleCents = items
      .filter(i => i?.requires_shipping && !i?.gift_card)
      .reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.quantity || 0)), 0);

    const subtotal = Math.round(eligibleCents) / 100;

    // Config knobs via Netlify env vars (optional)
    const PCT = Number(process.env.TARIFF_PERCENT || "0.05"); // 5%
    const MIN = Number(process.env.TARIFF_MIN || "0");        // dollars (0 = off)
    const MAX = Number(process.env.TARIFF_MAX || "0");        // dollars (0 = off)
    const baseUS   = Number(process.env.BASE_US   || "6.00"); // your base US shipping
    const baseIntl = Number(process.env.BASE_INTL || "18.00");

    let fee = isUS ? +(subtotal * PCT).toFixed(2) : 0;
    if (MIN > 0 && fee < MIN) fee = MIN;
    if (MAX > 0 && fee > MAX) fee = MAX;

    const total = +((isUS ? baseUS : baseIntl) + fee).toFixed(2);

    return {
      statusCode: 200,
      body: JSON.stringify({
        rates: [{
          service_name: isUS ? `Standard (Shipping + Tariff ${Math.round(PCT*100)}%)`
                             : `Standard International`,
          service_code: isUS ? "US_TARIFF" : "INTL",
          description: isUS ? "Includes 5% tariff surcharge" : "Standard international shipping",
          currency,
          total_price: String(Math.round(total * 100)) // cents
        }]
      })
    };
  } catch {
    // 404 lets Shopify fall back to any backup rates you configured
    return { statusCode: 404, body: "Rate error" };
  }
}
