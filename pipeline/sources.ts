// Source adapters. Every source implements the same interface, so plugging in
// a live platform API later (Facebook, X, YouTube, news scrapers…) means
// writing one adapter — the rest of the pipeline does not change.

import type { RawRecord } from "./types";
import raw from "@/data/raw.json";

export interface Source {
  name: string;
  fetch(): Promise<RawRecord[]>;
}

/** The provided take-home dataset, exposed through the same interface a live API would use. */
export const providedDataset: Source = {
  name: "takapay_sample_data.json (provided)",
  fetch: async () => raw as RawRecord[],
};

/**
 * Example of what a live adapter would look like — not enabled for the
 * take-home, but the seam is here:
 *
 * export const facebookPages = (token: string): Source => ({
 *   name: "facebook-pages",
 *   fetch: async () => normalizeGraphResponse(await callGraphApi(token)),
 * });
 */

export const defaultSources: Source[] = [providedDataset];
