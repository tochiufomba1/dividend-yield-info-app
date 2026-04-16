import type { SnapshotEntry } from "@/components/canvas/types";

export interface OptionType {
  value: string;
  label: string;
}

export interface ActiveSnapshotState {
    snapshotName: string;
    snapshotStocks: SnapshotEntry[];
}