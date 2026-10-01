/* Versioned planner price config. Browser copy of planner-prices.json.
   No fetch. A null price stays unknown. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PlannerPrices = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
    schema: "netie.planner-prices/1",
    version: "1",
    asOf: "2026-10-01",
    profileNote: "Request coefficients are the estimator profile, not measured usage. Token sizes stay null until a sourced profile exists. A null provider price is unknown and is never filled in.",
    profile: {
      lowRequests: 1,
      requestsPerStep: { low: 1, medium: 1, high: 2, max: 3 },
      tokensPerStep: null,
    },
    caps: {
      paidCallUsd: 0.02,
      runUsd: { low: 5, medium: 5, high: 5, max: 30 },
      source: "Planner stop rules: 0.02 per paid call; 5 per run for low, medium, and high; 30 hard cap for max.",
    },
    laneProviders: {
      Cortex: "cortex",
      "DMS SQL": "dms-sql",
      "OpenVault FreeRoute model hop": "openvault-freeroute",
      KB: "kb",
      governed: "cortex",
      "outsourced-coding": "cursor-cloud-agents",
    },
    providers: [
      {
        id: "cortex",
        inputUsdPerMillion: null,
        outputUsdPerMillion: null,
        sourceUrl: null,
        asOf: "2026-10-01",
        note: "No public Cortex token price is recorded here.",
      },
      {
        id: "dms-sql",
        inputUsdPerMillion: null,
        outputUsdPerMillion: null,
        sourceUrl: null,
        asOf: "2026-10-01",
        note: "No public DMS SQL price is recorded here.",
      },
      {
        id: "openvault-freeroute",
        inputUsdPerMillion: null,
        outputUsdPerMillion: null,
        sourceUrl: null,
        asOf: "2026-10-01",
        note: "No public OpenVault FreeRoute price is recorded here.",
      },
      {
        id: "kb",
        inputUsdPerMillion: null,
        outputUsdPerMillion: null,
        sourceUrl: null,
        asOf: "2026-10-01",
        note: "No public KB price is recorded here.",
      },
      {
        id: "cursor-cloud-agents",
        inputUsdPerMillion: null,
        outputUsdPerMillion: null,
        sourceUrl: "https://cursor.com/docs/cloud-agent",
        asOf: "2026-10-01",
        note: "Docs say Cloud Agents are charged at API pricing for the selected model. This config does not copy a model price onto the lane.",
      },
      {
        id: "openai-gpt-4.1",
        inputUsdPerMillion: null,
        outputUsdPerMillion: null,
        sourceUrl: "https://developers.openai.com/api/docs/models/gpt-4.1",
        asOf: "2026-10-01",
        note: "Fetched 2026-10-01. The pricing block is labeled Batch API price, so no standard per-token price was copied.",
      },
    ],
  };
});
