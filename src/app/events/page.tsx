"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSeason } from "@/hooks/useSeason";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { GuildEvent, ContentType, BossRegistry } from "@/types";
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import Link from "next/link";

const GUILD_ID = "00000000-0000-0000-0000-000000000001";

const contentTypes: ContentType[] = [
  "guild_dungeon",
  "guild_war",
  "crusade",
  "boss_raid",
  "ice_dungeon",
  "faction_war",
];

export default function EventsPage() {
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();
  const { seasons, activeSeason, setActiveSeason } = useSeason();
  const [events, setEvents] = useState<GuildEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());

  const handleDeleteEvent = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${title}" 이벤트를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) toast.error("삭제 실패");
    else { toast.success("삭제됨"); fetchEvents(); }
  };

  const fetchEvents = useCallback(async () => {
    let query = supabase
      .from("events")
      .select("*")
      .order("scheduled_at", { ascending: false })
      .limit(50);

    if (activeSeason) {
      query = query.eq("season_id", activeSeason.id);
    }
    if (filter !== "all") {
      query = query.eq("content_type", filter);
    }
    // Year/month filter
    const y = parseInt(year);
    const m = parseInt(month);
    if (y && m) {
      const start = new Date(y, m - 1, 1).toISOString();
      const end = new Date(y, m, 1).toISOString();
      query = query.gte("scheduled_at", start).lt("scheduled_at", end);
    }

    const { data } = await query;
    setEvents(data ?? []);
    setLoading(false);
  }, [supabase, filter, activeSeason, year, month]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            참석 관리
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="text-sm text-muted-foreground">시즌</span>
            <Input
              type="number"
              min={1}
              className="w-16 h-8 text-sm"
              value={activeSeason?.name?.replace(/[^0-9]/g, "") ?? "1"}
              onChange={(e) => {
                const name = `시즌 ${e.target.value}`;
                const s = seasons.find((s) => s.name === name);
                if (s) setActiveSeason(s);
              }}
            />
            <Input
              type="number"
              min={2024}
              max={2099}
              className="w-20 h-8 text-sm"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="년"
            />
            <span className="text-sm text-muted-foreground">년</span>
            <Input
              type="number"
              min={1}
              max={12}
              className="w-14 h-8 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="월"
            />
            <span className="text-sm text-muted-foreground">월</span>
          </div>
        </div>
        <AdminGuard>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                생성
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>참석 관리 생성</DialogTitle>
              </DialogHeader>
              <EventForm
                seasonId={activeSeason?.id}
                seasonName={activeSeason?.name}
                seasons={seasons}
                onSeasonChange={(id) => {
                  const s = seasons.find((s) => s.id === id);
                  if (s) setActiveSeason(s);
                }}
                onSaved={() => {
                  setDialogOpen(false);
                  fetchEvents();
                }}
              />
            </DialogContent>
          </Dialog>
        </AdminGuard>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(String(v ?? "all"))}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">전체</TabsTrigger>
          {contentTypes.map((ct) => (
            <TabsTrigger key={ct} value={ct}>
              {CONTENT_TYPE_LABELS[ct]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            로딩 중...
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Calendar className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>등록된 이벤트가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        (() => {
          // Group events by date
          const groups = new Map<string, GuildEvent[]>();
          events.forEach((event) => {
            const dateKey = format(
              new Date(event.scheduled_at),
              "yyyy-MM-dd"
            );
            if (!groups.has(dateKey)) groups.set(dateKey, []);
            groups.get(dateKey)!.push(event);
          });

          return (
            <div className="space-y-4">
              {Array.from(groups.entries()).map(([date, dayEvents]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2 pb-1 border-b">
                    <h3 className="text-sm font-bold">
                      {format(new Date(date), "MM월 dd일 (EEE)", { locale: ko })}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {dayEvents.length}건
                    </span>
                  </div>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {dayEvents.map((event) => (
                      <Link key={event.id} href={`/events/${event.id}`}>
                        <Card className="relative transition-colors hover:bg-accent/50 cursor-pointer h-full">
                          <div className="p-3 space-y-1.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              <Badge
                                className={`${CONTENT_TYPE_COLORS[event.content_type]} text-white text-[10px] px-1.5 py-0`}
                              >
                                {CONTENT_TYPE_LABELS[event.content_type]}
                              </Badge>
                              {event.difficulty && event.difficulty !== "없음" && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {event.difficulty}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  event.status === "completed"
                                    ? "secondary"
                                    : event.status === "in_progress"
                                      ? "default"
                                      : "outline"
                                }
                                className="text-[10px] px-1.5 py-0"
                              >
                                {event.status === "completed"
                                  ? "완료"
                                  : event.status === "in_progress"
                                    ? "진행중"
                                    : "예정"}
                              </Badge>
                            </div>
                            <div className="text-sm font-medium truncate">
                              {event.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(event.scheduled_at), "HH:mm")}
                              {event.boss_name && ` · ${event.boss_name}`}
                            </div>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 text-destructive"
                                onClick={(e) =>
                                  handleDeleteEvent(e, event.id, event.title)
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}

// ---- Event Form ----
function EventForm({ seasonId, seasonName, seasons, onSeasonChange, onSaved }: {
  seasonId?: string;
  seasonName?: string;
  seasons: { id: string; name: string }[];
  onSeasonChange: (id: string) => void;
  onSaved: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const currentSeasonNum = seasons.find((s) => s.id === seasonId)?.name?.replace(/[^0-9]/g, "") ?? "1";
  const [seasonNum, setSeasonNum] = useState(currentSeasonNum);
  const [contentType, setContentType] =
    useState<ContentType>("guild_dungeon");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [bossName, setBossName] = useState("");
  const [bossList, setBossList] = useState<BossRegistry[]>([]);

  useEffect(() => {
    supabase
      .from("boss_registry")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setBossList(data ?? []));
  }, [supabase]);
  const [scheduledAt, setScheduledAt] = useState(
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("제목을 입력하세요");
      return;
    }
    setSaving(true);

    // Find or create season
    const seasonName = `시즌 ${seasonNum}`;
    let resolvedSeasonId: string | null = null;
    const existing = seasons.find((s) => s.name === seasonName);
    if (existing) {
      resolvedSeasonId = existing.id;
    } else if (seasonNum) {
      const { data: newSeason } = await supabase
        .from("seasons")
        .insert({ name: seasonName, start_date: new Date().toISOString().slice(0, 10), is_active: true, guild_id: GUILD_ID })
        .select()
        .single();
      if (newSeason) resolvedSeasonId = newSeason.id;
    }

    const { error } = await supabase.from("events").insert({
      guild_id: GUILD_ID,
      season_id: resolvedSeasonId,
      content_type: contentType,
      title: title.trim(),
      difficulty: difficulty || null,
      boss_name: bossName || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: "scheduled",
    });

    if (error) {
      toast.error("생성 실패: " + error.message);
    } else {
      toast.success("생성됨");
      onSaved();
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>시즌 *</Label>
        <Input
          type="number"
          min={1}
          value={seasonNum}
          onChange={(e) => setSeasonNum(e.target.value)}
          placeholder="1"
        />
      </div>
      <div className="space-y-2">
        <Label>컨텐츠 타입 *</Label>
        <Select
          value={contentType}
          onValueChange={(v) => v && setContentType(v as ContentType)}
        >
          <SelectTrigger>
            <SelectValue>
              {CONTENT_TYPE_LABELS[contentType]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {contentTypes.map((ct) => (
              <SelectItem key={ct} value={ct}>
                {CONTENT_TYPE_LABELS[ct]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>제목 *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 4/16 길드던전 상급"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>난이도</Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="없음">없음</SelectItem>
              <SelectItem value="초급">초급</SelectItem>
              <SelectItem value="중급">중급</SelectItem>
              <SelectItem value="상급">상급</SelectItem>
              <SelectItem value="특급">특급</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>보스명</Label>
          <Select value={bossName} onValueChange={(v) => setBossName(v ?? "")}>
            <SelectTrigger>
              <SelectValue>{bossName || "선택"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {bossList
                .filter(
                  (b) =>
                    !b.content_type ||
                    b.content_type === contentType
                )
                .map((b) => (
                  <SelectItem key={b.id} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>일시 *</Label>
        <Input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "생성 중..." : "이벤트 생성"}
      </Button>
    </form>
  );
}
