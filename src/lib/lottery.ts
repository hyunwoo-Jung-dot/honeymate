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
