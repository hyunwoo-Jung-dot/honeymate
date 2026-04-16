// Commit-Reveal lottery system for fair item distribution
// Ensures even admins cannot manipulate results

interface LotteryInput {
  participants: string[]; // profile IDs (sorted)
  items: string[];        // item names
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

// Phase 1: Create commit (before lottery)
export async function createCommit(
  input: LotteryInput
): Promise<LotteryCommit> {
  const serverSecret = generateRandomHex(32);
  const seedTimestamp = new Date().toISOString();

  const payload = JSON.stringify({
    participants: input.participants,
    items: input.items,
    serverSecret,
    seedTimestamp,
  });

  const commitHash = await sha256(payload);

  return { serverSecret, seedTimestamp, commitHash };
}

// Phase 2: Reveal result (execute lottery)
export async function revealResult(
  input: LotteryInput,
  commit: LotteryCommit
): Promise<LotteryRevealResult> {
  const seedSource = commit.serverSecret + commit.seedTimestamp;
  const seedHash = await sha256(seedSource);

  // Convert hash to BigInt for deterministic shuffle
  const seed = BigInt("0x" + seedHash.slice(0, 16));

  // Deterministic Fisher-Yates shuffle
  const shuffled = [...input.participants];
  let current = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    // LCG (Linear Congruential Generator)
    current =
      (current * 6364136223846793005n + 1442695040888963407n) %
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

// Verification function (anyone can verify)
export async function verifyCommit(
  input: LotteryInput,
  serverSecret: string,
  seedTimestamp: string,
  commitHash: string
): Promise<boolean> {
  const payload = JSON.stringify({
    participants: input.participants,
    items: input.items,
    serverSecret,
    seedTimestamp,
  });
  const computed = await sha256(payload);
  return computed === commitHash;
}
