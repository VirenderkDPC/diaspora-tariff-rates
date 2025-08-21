import express from "express";
const app = express();
app.use(express.json());

app.post("/shopify/rates", (req, res) => {
  const { rate } = req.body;
  const dest = rate?.destination || {};
  const items = rate?.items || [];
  const isUS = dest.country === "US";
  const currency = rate?.currency || "USD";

  // subtotal in dollars
  const subtotal = items
    .filter(i => i.requires_shipping && !i.gift_card)
    .reduce((sum, i) => sum + i.price * i.quantity, 0) / 100;

  const base = isUS ? 6.00 : 18.00;
  const fee  = isUS ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
  const total = base + fee;

  res.json({
    rates: [{
      service_name: isUS
        ? `Standard (Shipping + Tariff 5%)`
        : `Standard International`,
      service_code: isUS ? "US_TARIFF" : "INTL",
      description: isUS
        ? "Includes 5% tariff surcharge"
        : "Standard intl shipping",
      currency,
      total_price: String(Math.round(total * 100)) // cents
    }]
  });
});

app.listen(3000, () => console.log("Tariff CCS listening on port 3000"));
