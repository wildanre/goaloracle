import { FootballDataProvider } from "./football-data-provider.js";
import { MockProvider } from "./mock-provider.js";
import type { Provider } from "./types.js";

export * from "./types.js";
export * from "./mock-data.js";
export { MockProvider } from "./mock-provider.js";
export { FootballDataProvider } from "./football-data-provider.js";
export { computeStandings } from "./standings.js";

/** Real provider when a token is configured, bundled mock data otherwise. */
export function selectProvider(footballDataToken: string | undefined): Provider {
  return footballDataToken ? new FootballDataProvider(footballDataToken) : new MockProvider();
}
