import { selectProvider } from "@goaloracle/data";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const provider = selectProvider(config.footballDataToken);
const app = buildApp(provider, config);

app.listen(config.port, () => {
  console.log(`[goaloracle] API listening on http://localhost:${config.port}`);
  console.log(`[goaloracle] data provider: ${provider.name}${provider.name === "mock" ? " (set FOOTBALL_DATA_TOKEN for live data)" : ""}`);
  console.log(`[goaloracle] x402 network: ${config.network} — premium routes require USDC payment`);
  if (config.facilitatorIsEphemeral && !config.facilitatorUrl) {
    console.log("[goaloracle] x402 facilitator: EPHEMERAL key (402 challenges work; set FACILITATOR_PRIVATE_KEY with INJ gas for on-chain settlement)");
  }
});
