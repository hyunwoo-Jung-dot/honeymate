"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AttendanceRate,
  ContentType,
  ContributionScore,
} from "@/types";
import {
  CONTENT_TYPE_LABELS,
  CLASS_LABELS,
} from "@/lib/constants";
import { useSeason } from "@/hooks/useSeason";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Users, Trophy } from "lucide-react";
import type { CharacterClass } from "@/types";

export default function StatsPage() {
  const [supabase] = useState(() => createClient());
  const { seasons, activeSeason, setActiveSeason } = useSeason();

  // Tab: "attendance" or "contribution"
  const [mainTab, setMainTab] = useState("contribution");
  const [filter, setFilter] = useState<string>("all");
  const [cutline, setCutline] = useState([0]);
  const [loading, setLoading] = useState(true);

  // Attendance data
  const [rates, setRates] = useState<AttendanceRate[]>([]);

  // Contribution data
  const [contributions, setContributions] = useState<
    ContributionScore[]
  >([]);
  const [healerBonusRate, setHealerBonusRate] = useState(0.2);

  const fetchData = useCallback(async () => {
    const [ratesRes, contribRes, settingsRes] = await Promise.all(
      [
        supabase
          .from("attendance_rates")
          .select("*")
          .order("attendance_rate", { ascending: false }),
        supabase.from("contribution_scores").select("*"),
        supabase
          .from("guild_settings")
          .select("*")
          .limit(1)
          .single(),
      ]
    );
    setRates(ratesRes.data ?? []);
    setContributions(contribRes.data ?? []);
    if (settingsRes.data) {
      setHealerBonusRate(
        Number(settingsRes.data.healer_bonus_rate) || 0.2
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter contributions by season + content type
  const filteredContrib = contributions.filter((c) => {
    if (activeSeason && c.season_id !== activeSeason.id)
      return false;
    if (filter !== "all" && c.content_type !== filter) return false;
    return true;
  });

  // Aggregate contribution per profile
  const contribAgg = Array.from(
    filteredContrib
      .reduce(
        (map, c) => {
          const existing = map.get(c.profile_id);
          if (existing) {
            existing.raw_score += c.raw_score;
            existing.total_events += c.total_events;
            existing.present_count += c.present_count;
            existing.afk_count += c.afk_count;
            existing.absent_count += c.absent_count;
          } else {
            map.set(c.profile_id, { ...c });
          }
          return map;
        },
        new Map<string, ContributionScore>()
      )
      .values()
  )
    .map((c) => {
      const isHealer = c.character_class === "healer";
      const bonus = isHealer
        ? Math.round(c.raw_score * healerBonusRate * 10) / 10
        : 0;
      return { ...c, bonus, totalScore: c.raw_score + bonus };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  // Attendance aggregation (existing logic)
  const contentTypes = Array.from(
    new Set(rates.map((r) => r.content_type))
  );

  const filteredRates =
    filter === "all"
      ? rates
      : rates.filter((r) => r.content_type === filter);

  const aggregatedRates =
    filter === "all"
      ? Array.from(
          filteredRates
            .reduce(
              (map, r) => {
                const existing = map.get(r.profile_id);
                if (existing) {
                  existing.total_events += r.total_events;
                  existing.present_count += r.present_count;
                  existing.afk_count += r.afk_count;
                  existing.absent_count += r.absent_count;
                  existing.attendance_rate = Math.round(
                    (existing.present_count /
                      Math.max(existing.total_events, 1)) *
                      1000
                  ) / 10;
                } else {
                  map.set(r.profile_id, { ...r });
                }
                return map;
              },
              new Map<string, AttendanceRate>()
            )
            .values()
        ).sort(
          (a, b) => b.attendance_rate - a.attendance_rate
        )
      : filteredRates;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            통계
          </h1>
          <p className="text-muted-foreground">
            기여도 및 참석률 현황
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            시즌
          </span>
          <Input
            type="number"
            min={1}
            className="w-20 h-8 text-sm"
            value={
              activeSeason?.name?.replace(/[^0-9]/g, "") ?? "1"
            }
            onChange={(e) => {
              const name = `시즌 ${e.target.value}`;
              const s = seasons.find((s) => s.name === name);
              if (s) setActiveSeason(s);
            }}
          />
        </div>
      </div>

      {/* Main tabs: 기여도 / 참석률 */}
      <Tabs
        value={mainTab}
        onValueChange={(v) => setMainTab(String(v ?? "contribution"))}
      >
        <TabsList>
          <TabsTrigger value="contribution">
            <Trophy className="h-4 w-4 mr-1" />
            기여도 순위
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <BarChart3 className="h-4 w-4 mr-1" />
            참석률
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content type filter */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(String(v ?? "all"))}
      >
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">전체</TabsTrigger>
          {(mainTab === "contribution"
            ? Array.from(
                new Set(
                  contributions.map((c) => c.content_type)
                )
              )
            : contentTypes
          ).map((ct) => (
            <TabsTrigger key={ct} value={ct}>
              {CONTENT_TYPE_LABELS[ct as ContentType] ?? ct}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Cutline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            컷라인 시뮬레이터
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>
              {mainTab === "contribution"
                ? "최소 기여도 점수"
                : "최소 참석률"}
            </span>
            <span className="font-bold text-primary">
              {cutline[0]}
              {mainTab === "attendance" ? "%" : "점"}
            </span>
          </div>
          <Slider
            value={cutline}
            onValueChange={(v) =>
              setCutline(Array.isArray(v) ? [...v] : [v])
            }
            min={0}
            max={mainTab === "contribution" ? 100 : 100}
            step={mainTab === "contribution" ? 1 : 5}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Content */}
      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            로딩 중...
          </CardContent>
        </Card>
      ) : mainTab === "contribution" ? (
        /* Contribution Tab */
        contribAgg.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Trophy className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p>기여도 데이터가 없습니다.</p>
              <p className="text-sm mt-1">
                참석 체크를 먼저 진행하세요.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>닉네임</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    직업
                  </TableHead>
                  <TableHead className="text-center">
                    참석
                  </TableHead>
                  <TableHead className="text-center hidden sm:table-cell">
                    잠수
                  </TableHead>
                  <TableHead className="text-center">
                    기여도
                  </TableHead>
                  {contribAgg.some((c) => c.bonus > 0) && (
                    <TableHead className="text-center hidden sm:table-cell">
                      보너스
                    </TableHead>
                  )}
                  <TableHead className="text-center">
                    총점
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contribAgg.map((c, i) => {
                  const isAbove =
                    c.totalScore >= cutline[0];
                  return (
                    <TableRow
                      key={c.profile_id}
                      className={
                        cutline[0] > 0 && !isAbove
                          ? "opacity-40"
                          : ""
                      }
                    >
                      <TableCell className="font-bold text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.nickname}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {c.character_class ? (
                          <Badge variant="outline" className="text-xs">
                            {CLASS_LABELS[
                              c.character_class as CharacterClass
                            ] ?? c.character_class}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-center text-green-500">
                        {c.present_count}
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell text-yellow-500">
                        {c.afk_count}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.raw_score}
                      </TableCell>
                      {contribAgg.some(
                        (cc) => cc.bonus > 0
                      ) && (
                        <TableCell className="text-center hidden sm:table-cell text-blue-400">
                          {c.bonus > 0
                            ? `+${c.bonus}`
                            : "-"}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            i < 3
                              ? "default"
                              : "secondary"
                          }
                        >
                          {c.totalScore}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )
      ) : /* Attendance Tab */
      aggregatedRates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <BarChart3 className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>참석 데이터가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>닉네임</TableHead>
                <TableHead className="text-center">
                  참석률
                </TableHead>
                <TableHead className="text-center hidden sm:table-cell">
                  참석
                </TableHead>
                <TableHead className="text-center hidden sm:table-cell">
                  잠수
                </TableHead>
                <TableHead className="text-center hidden sm:table-cell">
                  불참
                </TableHead>
                <TableHead className="text-center">
                  총 이벤트
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregatedRates.map((r) => {
                const isAbove =
                  r.attendance_rate >= cutline[0];
                return (
                  <TableRow
                    key={`${r.profile_id}-${r.content_type}`}
                    className={
                      cutline[0] > 0 && !isAbove
                        ? "opacity-40"
                        : ""
                    }
                  >
                    <TableCell className="font-medium">
                      {r.nickname}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          r.attendance_rate >= 80
                            ? "default"
                            : r.attendance_rate >= 50
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {r.attendance_rate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell text-green-500">
                      {r.present_count}
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell text-yellow-500">
                      {r.afk_count}
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell text-red-500">
                      {r.absent_count}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.total_events}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
