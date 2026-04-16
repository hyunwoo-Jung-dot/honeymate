// Database types for 꿀메이트 guild management

export type ContentType =
  | "guild_dungeon"
  | "guild_war"
  | "crusade"
  | "boss_raid"
  | "ice_dungeon"
  | "faction_war";

export type AttendanceStatus = "present" | "afk" | "absent";

export type DistributionMethod = "manual" | "ladder" | "random";

export type LotteryType = "ladder" | "random_pick";

export type LotteryStatus = "pending" | "committed" | "revealed";

export type EventStatus = "scheduled" | "in_progress" | "completed";

export type WeightMode = "equal" | "contribution" | "value_based";

export type AdminRole = "owner" | "officer";

export type CharacterClass =
  | "archer"
  | "healer"
  | "swordsman"
  | "lancer"
  | "gunner"
  | "rapier"
  | "sword"
  | "warrior"
  | "mage";

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  guild_id: string;
  created_at: string;
}

export interface Guild {
  id: string;
  name: string;
  alliance_id: string | null;
  max_members: number;
  created_at: string;
}

export interface Alliance {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  nickname: string;
  server_name: string | null;
  character_class: CharacterClass | null;
  growth_score: number;
  guild_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  guild_id: string;
  created_at: string;
}

export interface GuildEvent {
  id: string;
  guild_id: string;
  alliance_id: string | null;
  season_id: string | null;
  content_type: ContentType;
  title: string;
  difficulty: string | null;
  boss_name: string | null;
  scheduled_at: string;
  status: EventStatus;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  event_id: string;
  profile_id: string;
  status: AttendanceStatus;
  note: string | null;
  checked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Distribution {
  id: string;
  event_id: string | null;
  profile_id: string;
  item_name: string;
  item_grade: string | null;
  quantity: number;
  gold_value: number | null;
  method: DistributionMethod;
  lottery_id: string | null;
  distributed_by: string | null;
  created_at: string;
}

export interface Lottery {
  id: string;
  event_id: string | null;
  title: string;
  type: LotteryType;
  participants: string[];
  items: string[];
  seed_timestamp: string;
  server_secret: string;
  commit_hash: string;
  result: LotteryResult[] | null;
  revealed_at: string | null;
  status: LotteryStatus;
  weight_mode: WeightMode;
  weight_season_id: string | null;
  weight_content_type: string | null;
  healer_bonus_enabled: boolean;
  participant_weights: ParticipantWeight[] | null;
  item_values: LotteryItemValue[] | null;
  created_by: string;
  created_at: string;
}

export interface LotteryResult {
  participantId: string;
  item: string;
}

export interface ParticipantWeight {
  profileId: string;
  rawScore: number;
  bonusScore: number;
  totalScore: number;
  weight: number;
}

export interface LotteryItemValue {
  name: string;
  goldValue: number;
}

export interface ItemRegistry {
  id: string;
  name: string;
  grade: string | null;
  gold_value: number;
  guild_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuildSettings {
  id: string;
  guild_id: string;
  healer_bonus_rate: number;
  updated_at: string;
}

export interface ContributionScore {
  profile_id: string;
  nickname: string;
  character_class: string | null;
  content_type: ContentType;
  season_id: string | null;
  raw_score: number;
  total_events: number;
  present_count: number;
  afk_count: number;
  absent_count: number;
}

// View type
export interface AttendanceRate {
  profile_id: string;
  nickname: string;
  content_type: ContentType;
  total_events: number;
  present_count: number;
  afk_count: number;
  absent_count: number;
  attendance_rate: number;
}

// Joined types for UI
export interface AttendanceWithProfile extends Attendance {
  profile: Profile;
}

export interface EventWithAttendances extends GuildEvent {
  attendances: AttendanceWithProfile[];
}
