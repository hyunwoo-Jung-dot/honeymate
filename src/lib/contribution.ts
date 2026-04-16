import type {
  ContributionScore,
  ParticipantWeight,
  LotteryItemValue,
} from "@/types";

interface CalculateOptions {
  participantIds: string[];
  scores: ContributionScore[];
  healerBonusRate: number;
  healerBonusEnabled: boolean;
}

// Calculate contribution weights for lottery participants
export function calculateContributions(
  opts: CalculateOptions
): ParticipantWeight[] {
  const { participantIds, scores, healerBonusRate, healerBonusEnabled } = opts;

  // Aggregate scores per profile (sum across content types)
  const scoreMap = new Map<string, {
    rawScore: number;
    isHealer: boolean;
    nickname: string;
  }>();

  for (const s of scores) {
    if (!participantIds.includes(s.profile_id)) continue;
    const existing = scoreMap.get(s.profile_id);
    if (existing) {
      existing.rawScore += s.raw_score;
    } else {
      scoreMap.set(s.profile_id, {
        rawScore: s.raw_score,
        isHealer: s.character_class === "healer",
        nickname: s.nickname,
      });
    }
  }

  // Build weights
  const weights: ParticipantWeight[] = participantIds.map((id) => {
    const data = scoreMap.get(id);
    const rawScore = data?.rawScore ?? 0;
    const isHealer = data?.isHealer ?? false;
    const bonusScore =
      healerBonusEnabled && isHealer
        ? Math.round(rawScore * healerBonusRate * 10) / 10
        : 0;
    const totalScore = rawScore + bonusScore;
    return {
      profileId: id,
      rawScore,
      bonusScore,
      totalScore,
      weight: 0, // normalized later
    };
  });

  return normalizeWeights(weights);
}

// Normalize weights so they sum to 1
export function normalizeWeights(
  weights: ParticipantWeight[]
): ParticipantWeight[] {
  const totalSum = weights.reduce((s, w) => s + w.totalScore, 0);
  if (totalSum === 0) {
    // Everyone has 0 score - equal weights
    const equal = 1 / weights.length;
    return weights.map((w) => ({ ...w, weight: equal }));
  }
  return weights.map((w) => ({
    ...w,
    weight: w.totalScore / totalSum,
  }));
}

// Value-based distribution: rank by score, assign items by value
export function distributeByValue(
  weights: ParticipantWeight[],
  items: LotteryItemValue[]
): { participantId: string; item: string; goldValue: number }[] {
  // Sort participants by totalScore descending
  const sorted = [...weights].sort(
    (a, b) => b.totalScore - a.totalScore
  );

  // Sort items by goldValue descending
  const sortedItems = [...items].sort(
    (a, b) => b.goldValue - a.goldValue
  );

  return sortedItems.map((item, idx) => ({
    participantId: sorted[idx % sorted.length].profileId,
    item: item.name,
    goldValue: item.goldValue,
  }));
}
