// Devuelve los indicadores del reloj usando la API gratuita de FRED.
// Variable de entorno requerida: FRED_API_KEY
// Opcional: GLOBAL_DEBT_GDP (deuda global / PIB en %)
module.exports = async (req, res) => {
  const key = process.env.FRED_API_KEY;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=1800");
  if (!key) {
    res.status(500).send(JSON.stringify({ error: "Falta FRED_API_KEY" }));
    return;
  }

  const get = async (id, limit) => {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${id}: ${r.status}`);
    const j = await r.json();
    return j.observations
      .filter((o) => o.value !== ".")
      .map((o) => ({ date: o.date, v: parseFloat(o.value) }));
  };

  try {
    const [dgs, vix, cpi, gepu] = await Promise.all([
      get("DGS10", 10),
      get("VIXCLS", 10),
      get("CPIAUCNS", 14),
      get("GEPUCURRENT", 3),
    ]);
    const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
    const inflation = (cpi[0].v / cpi[12].v - 1) * 100;
    const geo = clamp(((gepu[0].v - 100) / 300) * 100, 0, 100);
    const debt = parseFloat(process.env.GLOBAL_DEBT_GDP || "310");

    res.status(200).send(
      JSON.stringify({
        values: {
          debt,
          vix: vix[0].v,
          bonds: dgs[0].v,
          geo: Math.round(geo),
          inf: Math.round(inflation * 10) / 10,
        },
        dates: {
          vix: vix[0].date,
          bonds: dgs[0].date,
          inf: cpi[0].date,
          geo: gepu[0].date,
        },
        fetchedAt: new Date().toISOString(),
      })
    );
  } catch (e) {
    res.status(502).send(JSON.stringify({ error: String(e.message || e) }));
  }
};
