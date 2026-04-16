"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AttendanceRate, ContentType } from "@/types";
import { CONTENT_TYPE_LABELS } from "@/lib/constants";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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
import { BarChart3, Users } from "lucide-react";

export default function StatsPage() {
  const [supabase] = useState(() => createClient());
  const [rates, setRates] = useState<AttendanceRate[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [cutline, setCutline] = useState([0]);
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    const { data } = await supabase
      .from("attendance_rates")
      .select("*")
      .order("attendance_rate", { ascending: false });
    setRates(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const contentTypes = Array.from(
    new Set(rates.map((r) => r.content_type))
  );

  const filtered =
    filter === "all"
      ? rates
      : rates.filter((r) => r.content_type === filter);

  // Aggregate per profile when "all"
  const aggregated =
    filter === "all"
      ? Array.from(
          filtered
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
        ).sort((a, b) => b.attendance_rate - a.attendance_rate)
      : filtered;

  const aboveCutline = aggregated.filter(
    (r) => r.attendance_rate >= cutline[0]
  );
  const belowCutline = aggregated.filter(
    (r) => r.attendance_rate < cutline[0]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          참석률 통계
        </h1>
        <p className="text-muted-foreground">
          컨텐츠별 참석률 현황 및 컷라인 시뮬레이터
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(String(v ?? "all"))}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">전체 통합</TabsTrigger>
          {contentTypes.map((ct) => (
            <TabsTrigger key={ct} value={ct}>
              {CONTENT_TYPE_LABELS[ct as ContentType] ?? ct}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Cutline Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            컷라인 시뮬레이터
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>최소 참석률</span>
            <span className="font-bold text-primary">
              {cutline[0]}%
            </span>
          </div>
          <Slider
            value={cutline}
            onValueChange={(v) => setCutline(Array.isArray(v) ? [...v] : [v])}
            min={0}
            max={100}
            step={5}
          />
          <div className="flex gap-4 text-sm">
            <span className="text-green-500">
              자격: {aboveCutline.length}명
            </span>
            <span className="text-red-500">
              미달: {belowCutline.length}명
            </span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Attendance Table */}
      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            로딩 중...
          </CardContent>
        </Card>
      ) : aggregated.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <BarChart3 className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>참석 데이터가 없습니다.</p>
            <p className="text-sm mt-1">
              이벤트에서 참석 체크를 먼저 진행하세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>닉네임</TableHead>
                {filter !== "all" && (
                  <TableHead className="hidden sm:table-cell">
                    컨텐츠
                  </TableHead>
                )}
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
              {aggregated.map((r) => {
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
                    {filter !== "all" && (
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {CONTENT_TYPE_LABELS[r.content_type]}
                        </Badge>
                      </TableCell>
                    )}
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
