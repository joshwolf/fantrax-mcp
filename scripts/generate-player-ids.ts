import { writeFileSync } from "fs";
import { join } from "path";

const BASE_URL = "https://www.fantrax.com/fxea/general";
const OUTPUT_PATH = join(import.meta.dirname, "../src/player-ids.json");

async function fetchPlayerIds(): Promise<unknown> {
  const url = new URL(`${BASE_URL}/getPlayerIds`);
  url.searchParams.set("sport", "MLB");

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fantrax API error ${response.status}: ${text}`);
  }
  return response.json();
}

async function main(): Promise<void> {
  console.log("Fetching Fantrax player IDs...");
  const data = await fetchPlayerIds();
  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`Written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
