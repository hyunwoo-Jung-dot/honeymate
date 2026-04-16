"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { GuildEvent, ContentType } from "@/types";
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
import { Plus, Calendar } from "lucide-react";
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
  const supabase = createClient();
  useAuth();
  const [events, setEvents] = useState<GuildEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    let query = supabase
      .from("events")
      .select("*")
      .order("scheduled_at", { ascending: false })
      .limit(50);

    if (filter !== "all") {
      query = query.eq("content_type", filter);
    }

    const { data } = await query;
    setEvents(data ?? []);
    setLoading(false);
  }, [supabase, filter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            이벤트 관리
          </h1>
          <p className="text-muted-foreground">
            길드 컨텐츠 이벤트 및 참석 체크
          </p>
        </div>
        <AdminGuard>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                이벤트 생성
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>이벤트 생성</DialogTitle>
              </DialogHeader>
              <EventForm
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
        <div className="grid gap-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
            >
              <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${CONTENT_TYPE_COLORS[event.content_type]} text-white text-xs`}
                    >
                      {CONTENT_TYPE_LABELS[event.content_type]}
                    </Badge>
                    <Badge
                      variant={
                        event.status === "completed"
                          ? "secondary"
                          : event.status === "in_progress"
                            ? "default"
                            : "outline"
                      }
                    >
                      {event.status === "completed"
                        ? "완료"
                        : event.status === "in_progress"
                          ? "진행중"
                          : "예정"}
                    </Badge>
                    {event.difficulty && (
                      <Badge variant="outline">
                        {event.difficulty}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base">
                    {event.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    {format(
                      new Date(event.scheduled_at),
                      "yyyy.MM.dd (EEE) HH:mm",
                      { locale: ko }
                    )}
                    {event.boss_name && ` | ${event.boss_name}`}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Event Form ----
function EventForm({ onSaved }: { onSaved: () => void }) {
  const supabase = createClient();
  const [contentType, setContentType] =
    useState<ContentType>("guild_dungeon");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [bossName, setBossName] = useState("");
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

    const { error } = await supabase.from("events").insert({
      guild_id: GUILD_ID,
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
      toast.success("이벤트 생성됨");
      onSaved();
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
              <SelectItem value="초급">초급</SelectItem>
              <SelectItem value="중급">중급</SelectItem>
              <SelectItem value="상급">상급</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>보스명</Label>
          <Input
            value={bossName}
            onChange={(e) => setBossName(e.target.value)}
            placeholder="오그론, 코드쉬 등"
          />
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
