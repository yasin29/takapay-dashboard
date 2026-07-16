// Record shapes and the quality report the pipeline produces.
// The dashboard never sees a record that hasn't passed every stage.

export type Sentiment = "positive" | "neutral" | "negative";

/** A record as it arrives from a source — nothing trusted yet. */
export type RawRecord = Record<string, unknown>;

/** A record that has passed validation, normalization, and auditing. */
export interface CleanRecord {
  id: number;
  platform: string;
  timestamp: string; // ISO-like "YYYY-MM-DD HH:mm:ss"
  author: string;
  text: string;
  language: string;
  brand_mention: boolean;
  sentiment: Sentiment;
  sentiment_score: number; // 0-100
  topic: string;
  reactions: number;
  comments: number;
  /** true when the sentiment audit corrected the incoming label */
  corrected: boolean;
}

export interface QualityReport {
  sources: { name: string; fetched: number }[];
  raw_records: number;
  counted_records: number;
  rejected_invalid: number;
  excluded_off_topic: number;
  removed_duplicates: number;
  relabeled_sentiment: number;
  rejects: { id: unknown; reason: string }[];
  off_topic: { id: number; text: string }[];
  duplicates: { id: number; duplicate_of: number; text: string }[];
  relabeled: { id: number; from: string; to: string; score: number; evidence: string[]; text: string }[];
}

export const emptyReport = (): QualityReport => ({
  sources: [],
  raw_records: 0,
  counted_records: 0,
  rejected_invalid: 0,
  excluded_off_topic: 0,
  removed_duplicates: 0,
  relabeled_sentiment: 0,
  rejects: [],
  off_topic: [],
  duplicates: [],
  relabeled: [],
});
