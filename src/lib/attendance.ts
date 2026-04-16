import type {
  Attendance,
  AttendanceStatus,
  ContentType,
  Profile,
} from "@/types";
import { ATTENDANCE_WEIGHTS } from "./constants";

interface CutlineConfig {
  contentType?: ContentType;
  minRate: number;          // 0-100
  periodDays?: number;      // filter by recent N days
  includeAfkAsHalf: boolean;
}

export function calculateAttendanceRate(
  attendances: Attendance[],
  includeAfkAsHalf: boolean
): number {
  if (attendances.length === 0) return 0;

  const total = attendances.length;
  const score = attendances.reduce((sum, a) => {
    if (includeAfkAsHalf) {
      return sum + ATTENDANCE_WEIGHTS[a.status];
    }
    return sum + (a.status === "present" ? 1 : 0);
  }, 0);

  return Math.round((score / total) * 1000) / 10;
}

export function getStatusCounts(
  attendances: Attendance[]
): Record<AttendanceStatus, number> {
  return {
    present: attendances.filter((a) => a.status === "present")
      .length,
    afk: attendances.filter((a) => a.status === "afk").length,
    absent: attendances.filter((a) => a.status === "absent")
      .length,
  };
}

export function filterEligibleMembers(
  profiles: Profile[],
  attendanceMap: Map<string, Attendance[]>,
  config: CutlineConfig
): Profile[] {
  return profiles.filter((p) => {
    const attendances = attendanceMap.get(p.id) || [];
    const rate = calculateAttendanceRate(
      attendances,
      config.includeAfkAsHalf
    );
    return rate >= config.minRate;
  });
}
