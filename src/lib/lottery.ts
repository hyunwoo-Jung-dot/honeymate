// Commit-Reveal lottery system for fair item distribution
// Supports equal, weighted (contribution), and value-based modes

interface LotteryInput {
  participants: string[]; // profile IDs (sorted)
  items: string[];        // item names
  weights?: { participantId: string; weight: number }[];
}

interface LotteryCommit {
  serverSecret: string;
  seedTimestamp: string;
  commitHash: string;
}

interface LotteryRevealResult {
  assignments: { participantId: string; item: string }[];
  serverSecret: string;
}

function generateRandomHex(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Deterministic PRNG (LCG)
function nextRandom(current: bigint): [bigint, number] {
  const next =
    (current * 6364136223846793005n + 1442695040888963407n) %
    (2n ** 64n);
  // Return float between 0 and 1
  const float = Number(next % 1000000n) / 1000000;
  return [next, float];
}

// Phase 1: Create commit
export async function createCommit(
  input: LotteryInput
): Promise<LotteryCommit> {
  const serverSecret = generateRandomHex(32);
  const seedTimestamp = new Date().toISOString();

  const payload = JSON.stringify({
    participants: input.participants,
    items: input.items,
    weights: input.weights ?? [],
    serverSecret,
    seedTimestamp,
  });

  const commitHash = await sha256(payload);
  return { serverSecret, seedTimestamp, commitHash };
}

// Phase 2: Reveal result
export async function revealResult(
  input: LotteryInput,
  commit: LotteryCommit
): Promise<LotteryRevealResult> {
  const seedSource = commit.serverSecret + commit.seedTimestamp;
  const seedHash = await sha256(seedSource);
  let current = BigInt("0x" + seedHash.slice(0, 16));

  const hasWeights =
    input.weights && input.weights.length > 0;

  if (!hasWeights) {
    // Equal mode: Fisher-Yates shuffle (existing logic)
    const shuffled = [...input.participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      current =
        (current * 6364136223846793005n +
          1442695040888963407n) %
        (2n ** 64n);
      const j = Number(current % BigInt(i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const assignments = input.items.map((item, idx) => ({
      participantId: shuffled[idx % shuffled.length],
      item,
    }));
    return { assignments, serverSecret: commit.serverSecret };
  }

  // Weighted mode: CDF-based selection without replacement
  const weightMap = new Map(
    input.weights!.map((w) => [w.participantId, w.weight])
  );
  const pool = input.participants.map((id) => ({
    id,
    weight: weightMap.get(id) ?? 0,
  }));

  const assignments: { participantId: string; item: string }[] =
    [];

  for (const item of input.items) {
    if (pool.length === 0) break;

    const totalWeight = pool.reduce(
      (s, p) => s + p.weight,
      0
    );
    let [nextCurrent, rand] = nextRandom(current);
    current = nextCurrent;

    const target = rand * totalWeight;
    let cumulative = 0;
    let selectedIdx = 0;

    for (let i = 0; i < pool.length; i++) {
      cumulative += pool[i].weight;
      if (cumulative >= target) {
        selectedIdx = i;
        break;
      }
    }

    assignments.push({
      participantId: pool[selectedIdx].id,
      item,
    });
    pool.splice(selectedIdx, 1); // remove selected
  }

  return { assignments, serverSecret: commit.serverSecret };
}

// Verification function
export async function verifyCommit(
  input: LotteryInput,
  serverSecret: string,
  seedTimestamp: string,
  commitHash: string
): Promise<boolean> {
  const payload = JSON.stringify({
    participants: input.participants,
    items: input.items,
    weights: input.weights ?? [],
    serverSecret,
    seedTimestamp,
  });
  const computed = await sha256(payload);
  return computed === commitHash;
}

// ====================================================================
// Phase B: Unified distribution allocator
// ====================================================================

import type {
  LotteryTargetKind,
  LotterySelectionMode,
} from "@/types";

export interface AllocationInput {
  targetKind: LotteryTargetKind;
  selectionMode: LotterySelectionMode;
  participants: string[]; // profile IDs
  scores?: Record<string, number>; // profileId -> score (weighted/ranked)
  items?: string[]; // for items target
  totalAmount?: number; // for asset target
  recipientCount?: number; // random_pick / weighted_pick
  rankRatios?: number[]; // asset + ranked: e.g. [50, 30, 20]
  serverSecret: string;
  seedTimestamp: string;
}

export interface Allocation {
  profileId: string;
  rank?: number;
  score?: number;
  amount?: number;
  item?: string;
}

async function makeSeededRng(serverSecret: string, seedTimestamp: string) {
  const seedHash = await sha256(serverSecret + seedTimestamp);
  let state = BigInt("0x" + seedHash.slice(0, 16));
  return () => {
    state =
      (state * 6364136223846793005n + 1442695040888963407n) %
      (2n ** 64n);
    return Number(state % 1000000n) / 1000000;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function weightedSampleWithoutReplacement(
  pool: { id: string; weight: number }[],
  count: number,
  rng: () => number
): string[] {
  const work = pool.map((p) => ({ ...p }));
  const picked: string[] = [];
  const n = Math.min(count, work.length);
  for (let k = 0; k < n; k++) {
    const total = work.reduce(
      (s, p) => s + Math.max(0, p.weight),
      0
    );
    if (total <= 0) {
      // All zero/negative weights → fall back to uniform
      const idx = Math.floor(rng() * work.length);
      picked.push(work[idx].id);
      work.splice(idx, 1);
      continue;
    }
    const target = rng() * total;
    let cum = 0;
    let selectedIdx = work.length - 1;
    for (let i = 0; i < work.length; i++) {
      cum += Math.max(0, work[i].weight);
      if (cum >= target) {
        selectedIdx = i;
        break;
      }
    }
    picked.push(work[selectedIdx].id);
    work.splice(selectedIdx, 1);
  }
  return picked;
}

export async function allocate(input: AllocationInput): Promise<Allocation[]> {
  const rng = await makeSeededRng(
    input.serverSecret,
    input.seedTimestamp
  );

  // Sort participants for determinism (regardless of input order)
  const participants = [...input.participants].sort();
  const scoreOf = (id: string) => input.scores?.[id] ?? 0;

  if (input.targetKind === "asset") {
    const total = input.totalAmount ?? 0;

    if (input.selectionMode === "all") {
      const n = participants.length;
      if (n === 0) return [];
      const each = Math.floor(total / n);
      return participants.map((id) => ({ profileId: id, amount: each }));
    }

    if (input.selectionMode === "random_pick") {
      const N = Math.min(input.recipientCount ?? 0, participants.length);
      if (N === 0) return [];
      const picked = shuffle(participants, rng).slice(0, N);
      const each = Math.floor(total / N);
      return picked.map((id) => ({ profileId: id, amount: each }));
    }

    if (input.selectionMode === "weighted_pick") {
      const N = Math.min(input.recipientCount ?? 0, participants.length);
      if (N === 0) return [];
      const pool = participants.map((id) => ({ id, weight: scoreOf(id) }));
      const picked = weightedSampleWithoutReplacement(pool, N, rng);
      const each = Math.floor(total / N);
      return picked.map((id) => ({
        profileId: id,
        amount: each,
        score: scoreOf(id),
      }));
    }

    if (input.selectionMode === "ranked") {
      const ratios = input.rankRatios ?? [];
      const ranked = [...participants].sort(
        (a, b) => scoreOf(b) - scoreOf(a)
      );
      const N = Math.min(ratios.length, ranked.length);
      const ratioSum = ratios.slice(0, N).reduce((s, r) => s + r, 0);
      const out: Allocation[] = [];
      for (let i = 0; i < N; i++) {
        const id = ranked[i];
        const amount = Math.floor((total * ratios[i]) / (ratioSum || 100));
        out.push({
          profileId: id,
          rank: i + 1,
          score: scoreOf(id),
          amount,
        });
      }
      return out;
    }
  }

  if (input.targetKind === "items") {
    const items = input.items ?? [];
    const K = items.length;
    if (K === 0) return [];

    if (input.selectionMode === "random_pick") {
      const shuffled = shuffle(participants, rng);
      const n = Math.min(K, shuffled.length);
      return Array.from({ length: n }, (_, i) => ({
        profileId: shuffled[i],
        item: items[i],
        rank: i + 1,
      }));
    }

    if (input.selectionMode === "weighted_pick") {
      const pool = participants.map((id) => ({ id, weight: scoreOf(id) }));
      const picked = weightedSampleWithoutReplacement(pool, K, rng);
      return picked.map((id, i) => ({
        profileId: id,
        item: items[i],
        rank: i + 1,
        score: scoreOf(id),
      }));
    }

    if (input.selectionMode === "ranked") {
      const ranked = [...participants].sort(
        (a, b) => scoreOf(b) - scoreOf(a)
      );
      const n = Math.min(K, ranked.length);
      return Array.from({ length: n }, (_, i) => ({
        profileId: ranked[i],
        item: items[i],
        rank: i + 1,
        score: scoreOf(ranked[i]),
      }));
    }
  }

  return [];
}
