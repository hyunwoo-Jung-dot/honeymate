import type { ContentType, CharacterClass } from "@/types";

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  guild_dungeon: "길드 던전",
  guild_war: "길드 전장",
  crusade: "크루세이드",
  boss_raid: "보스 토벌",
  ice_dungeon: "특수던전 (얼동)",
  faction_war: "세력전",
};

export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  guild_dungeon: "bg-blue-500",
  guild_war: "bg-red-500",
  crusade: "bg-purple-500",
  boss_raid: "bg-orange-500",
  ice_dungeon: "bg-cyan-500",
  faction_war: "bg-green-500",
};

export const ATTENDANCE_STATUS_LABELS = {
  present: "참석",
  afk: "잠수",
  absent: "불참",
} as const;

export const ATTENDANCE_STATUS_COLORS = {
  present: "bg-green-500",
  afk: "bg-yellow-500",
  absent: "bg-red-500",
} as const;

export const CLASS_LABELS: Record<CharacterClass, string> = {
  warrior: "전사",
  swordsman: "쌍검",
  mage: "마법사",
  archer: "궁수",
};

export const ITEM_GRADES = [
  "일반",
  "고급",
  "희귀",
  "영웅",
  "전설",
] as const;

export const DIFFICULTY_LEVELS = [
  "초급",
  "중급",
  "상급",
] as const;

// Attendance weight for cutline calculation
export const ATTENDANCE_WEIGHTS = {
  present: 1.0,
  afk: 0.5,
  absent: 0,
} as const;

// Contents that use attendance-based distribution
export const ATTENDANCE_BASED_CONTENTS: ContentType[] = [
  "guild_dungeon",
  "guild_war",
  "crusade",
];

// Contents that use instant distribution
export const INSTANT_DISTRIBUTION_CONTENTS: ContentType[] = [
  "boss_raid",
  "ice_dungeon",
];
