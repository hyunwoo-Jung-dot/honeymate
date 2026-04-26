"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type {
  GuildEvent,
  Profile,
  Attendance,
  AttendanceStatus,
  ContentType,
  BossRegistry,
} from "@/types";
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  Pencil,
  Crown,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import Link from "next/link";

const CONTENT_TYPES: ContentType[] = [
  "guild_dungeon",
  "guild_war",
  "crusade",
  "boss_raid",
  "ice_dungeon",
  "faction_war",
];

const statusIcons = {
  present: CheckCircle2,
  afk: Clock,
  absent: XCircle,
};

const nextStatus: Record<AttendanceStatus, AttendanceStatus> = {
  absent: "present",
  present: "afk",
  afk: "absent",
};

// Boss display order for guild_dungeon (matches seeding order)
const GUILD_DUNGEON_BOSS_ORDER = ["코드쉬", "티아라카", "안티메네"];

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();

  const [event, setEvent] = useState<GuildEvent | null>(null);
  const [dayEvents, setDayEvents] = useState<GuildEvent[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  // attendances: eventId -> (profileId -> Attendance)
  const [attendances, setAttendances] = useState<
    Map<string, Map<string, Attendance>>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const [eventRes, membersRes] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).single(),
      supabase.from("profiles").select("*").eq("is_active", true).order("nickname"),
    ]);

    const ev = eventRes.data as GuildEvent | null;
    setEvent(ev);
    setMembers(membersRes.data ?? []);

    if (!ev) {
      setLoading(false);
      return;
    }

    // Find same-day same-content-type sibling events (only for guild_dungeon)
    let siblings: GuildEvent[] = [ev];
    if (ev.content_type === "guild_dungeon") {
      const dateStr = ev.scheduled_at.slice(0, 10);
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("content_type", "guild_dungeon")
        .eq("guild_id", ev.guild_id)
        .gte("scheduled_at", `${dateStr}T00:00:00`)
        .lt("scheduled_at", `${dateStr}T23:59:59`);
      siblings = (data ?? []) as GuildEvent[];
      // Sort by boss order
      siblings.sort((a, b) => {
        const ai = GUILD_DUNGEON_BOSS_ORDER.indexOf(a.boss_name ?? "");
        const bi = GUILD_DUNGEON_BOSS_ORDER.indexOf(b.boss_name ?? "");
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    }
    setDayEvents(siblings);

    // Fetch attendances for all sibling events
    const eventIds = siblings.map((e) => e.id);
    const { data: attData } = await supabase
      .from("attendances")
      .select("*")
      .in("event_id", eventIds);

    const map = new Map<string, Map<string, Attendance>>();
    eventIds.forEach((id) => map.set(id, new Map()));
    (attData ?? []).forEach((a: Attendance) => {
      map.get(a.event_id)?.set(a.profile_id, a);
    });
    setAttendances(map);

    setLoading(false);
  }, [supabase, eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatus = (
    evId: string,
    profileId: string
  ): AttendanceStatus => {
    return attendances.get(evId)?.get(profileId)?.status ?? "absent";
  };

  const handleStatusToggle = async (
    evId: string,
    profileId: string
  ) => {
    if (!isAdmin) return;
    const current = getStatus(evId, profileId);
    const newStatus = nextStatus[current];
    const existing = attendances.get(evId)?.get(profileId);

    // Optimistic update
    const updated = new Map(attendances);
    const eventMap = new Map(updated.get(evId) ?? new Map());
    if (existing) {
      eventMap.set(profileId, { ...existing, status: newStatus });
    } else {
      eventMap.set(profileId, {
        id: "temp",
        event_id: evId,
        profile_id: profileId,
        status: newStatus,
        note: null,
        checked_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    updated.set(evId, eventMap);
    setAttendances(updated);

    if (existing && existing.id !== "temp") {
      const { error } = await supabase
        .from("attendances")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) toast.error("업데이트 실패");
    } else {
      const { data, error } = await supabase
        .from("attendances")
        .insert({ event_id: evId, profile_id: profileId, status: newStatus })
        .select()
        .single();
      if (error) {
        toast.error("저장 실패");
      } else if (data) {
        const refreshed = new Map(attendances);
        const m = new Map(refreshed.get(evId) ?? new Map());
        m.set(profileId, data);
        refreshed.set(evId, m);
        setAttendances(refreshed);
      }
    }
  };

  const handleBulkSet = async (
    evId: string,
    status: AttendanceStatus
  ) => {
    if (!isAdmin) return;
    setBulkSaving(true);

    const upserts = members.map((m) => ({
      event_id: evId,
      profile_id: m.id,
      status,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("attendances")
      .upsert(upserts, { onConflict: "event_id,profile_id" });

    if (error) {
      toast.error("일괄 설정 실패");
    } else {
      const target = dayEvents.find((e) => e.id === evId);
      const label = target?.boss_name ?? target?.title ?? "";
      toast.success(`${label} 전원 ${ATTENDANCE_STATUS_LABELS[status]} 처리됨`);
      fetchData();
    }
    setBulkSaving(false);
  };

  const handleEventStatus = async (status: string | null) => {
    if (!status) return;
    await supabase.from("events").update({ status }).eq("id", eventId);
    fetchData();
    toast.success("상태 변경됨");
  };

  // Compute "complete attendance" for guild_dungeon: present in all dayEvents
  const isCompleteAttendance = (profileId: string) => {
    if (event?.content_type !== "guild_dungeon" || dayEvents.length < 2) {
      return null;
    }
    return dayEvents.every(
      (de) => getStatus(de.id, profileId) === "present"
    );
  };

  const counts = useMemo(() => {
    if (event?.content_type === "guild_dungeon" && dayEvents.length >= 2) {
      // Multi-boss: count complete / partial / absent
      let complete = 0;
      let partial = 0;
      let none = 0;
      members.forEach((m) => {
        const presents = dayEvents.filter(
          (de) => getStatus(de.id, m.id) === "present"
        ).length;
        if (presents === dayEvents.length) complete++;
        else if (presents > 0) partial++;
        else none++;
      });
      return { complete, partial, none };
    }
    // Single event: present / afk / absent
    const present = members.filter(
      (m) => getStatus(eventId, m.id) === "present"
    ).length;
    const afk = members.filter((m) => getStatus(eventId, m.id) === "afk").length;
    const absent = members.length - present - afk;
    return { present, afk, absent };
  }, [event, dayEvents, members, attendances, eventId]);

  if (loading) {
    return <div className="text-center py-10 text-muted-foreground">로딩 중...</div>;
  }

  if (!event) {
    return <div className="text-center py-10 text-muted-foreground">이벤트를 찾을 수 없습니다.</div>;
  }

  const isMultiBoss = event.content_type === "guild_dungeon" && dayEvents.length >= 2;

  return (
    <div className="space-y-6">
      <Link
        href="/events"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        참석관리 목록
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${CONTENT_TYPE_COLORS[event.content_type]} text-white`}>
              {CONTENT_TYPE_LABELS[event.content_type]}
            </Badge>
            {event.difficulty && event.difficulty !== "없음" && (
              <Badge variant="outline">{event.difficulty}</Badge>
            )}
            <AdminGuard>
              <Select value={event.status} onValueChange={handleEventStatus}>
                <SelectTrigger className="w-28 h-7 text-xs">
                  <SelectValue>
                    {event.status === "completed" ? "완료" : event.status === "in_progress" ? "진행중" : "예정"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">예정</SelectItem>
                  <SelectItem value="in_progress">진행중</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>
            </AdminGuard>
            {isAdmin && event.status === "scheduled" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                수정
              </Button>
            )}
          </div>
          <CardTitle>
            {isMultiBoss
              ? `${format(new Date(event.scheduled_at), "yyyy.MM.dd", { locale: ko })} 길드던전`
              : event.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {format(new Date(event.scheduled_at), "yyyy년 MM월 dd일 (EEE) HH:mm", { locale: ko })}
            {!isMultiBoss && event.boss_name && ` | 보스: ${event.boss_name}`}
          </p>
          {isMultiBoss && (
            <p className="text-xs text-amber-600">
              보스 {dayEvents.length}개 — 모두 참석한 멤버만 &quot;완전참석&quot;으로 인정됩니다
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이벤트 수정</DialogTitle>
          </DialogHeader>
          <EventEditForm
            event={event}
            onSaved={() => {
              setEditOpen(false);
              fetchData();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {isMultiBoss ? (
          <>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-green-500">
                  {(counts as { complete: number }).complete}
                </div>
                <div className="text-xs text-muted-foreground">완전참석</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {(counts as { partial: number }).partial}
                </div>
                <div className="text-xs text-muted-foreground">일부참석</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-red-500">
                  {(counts as { none: number }).none}
                </div>
                <div className="text-xs text-muted-foreground">전체불참</div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-green-500">
                  {(counts as { present: number }).present}
                </div>
                <div className="text-xs text-muted-foreground">참석</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {(counts as { afk: number }).afk}
                </div>
                <div className="text-xs text-muted-foreground">잠수</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-red-500">
                  {(counts as { absent: number }).absent}
                </div>
                <div className="text-xs text-muted-foreground">불참</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Bulk Actions */}
      <AdminGuard>
        {isMultiBoss ? (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">전원 일괄 처리:</div>
            {dayEvents.map((de) => (
              <div key={de.id} className="flex gap-2 flex-wrap items-center">
                <Badge variant="outline" className="min-w-[80px] justify-center">
                  {de.boss_name ?? de.title}
                </Badge>
                <Button variant="outline" size="sm" disabled={bulkSaving}
                  onClick={() => handleBulkSet(de.id, "present")}>
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />참석
                </Button>
                <Button variant="outline" size="sm" disabled={bulkSaving}
                  onClick={() => handleBulkSet(de.id, "afk")}>
                  <Clock className="h-3 w-3 mr-1 text-yellow-500" />잠수
                </Button>
                <Button variant="outline" size="sm" disabled={bulkSaving}
                  onClick={() => handleBulkSet(de.id, "absent")}>
                  <XCircle className="h-3 w-3 mr-1 text-red-500" />불참
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground self-center">전원 일괄:</span>
            <Button variant="outline" size="sm" disabled={bulkSaving}
              onClick={() => handleBulkSet(eventId, "present")}>
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />참석
            </Button>
            <Button variant="outline" size="sm" disabled={bulkSaving}
              onClick={() => handleBulkSet(eventId, "afk")}>
              <Clock className="h-3 w-3 mr-1 text-yellow-500" />잠수
            </Button>
            <Button variant="outline" size="sm" disabled={bulkSaving}
              onClick={() => handleBulkSet(eventId, "absent")}>
              <XCircle className="h-3 w-3 mr-1 text-red-500" />불참
            </Button>
          </div>
        )}
      </AdminGuard>

      <Separator />

      {/* Attendance Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">참석 체크</CardTitle>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">읽기 전용 모드입니다.</p>
          )}
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>닉네임</TableHead>
              {isMultiBoss ? (
                <>
                  {dayEvents.map((de) => (
                    <TableHead key={de.id} className="w-24 text-center">
                      {de.boss_name ?? de.title}
                    </TableHead>
                  ))}
                  <TableHead className="w-24 text-center">완전참석</TableHead>
                </>
              ) : (
                <TableHead className="w-28 text-center">상태</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const complete = isCompleteAttendance(m.id);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nickname}</TableCell>
                  {isMultiBoss ? (
                    <>
                      {dayEvents.map((de) => {
                        const status = getStatus(de.id, m.id);
                        const StatusIcon = statusIcons[status];
                        return (
                          <TableCell key={de.id} className="text-center">
                            <button
                              onClick={() => handleStatusToggle(de.id, m.id)}
                              disabled={!isAdmin}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                isAdmin ? "cursor-pointer hover:opacity-80" : "cursor-default"
                              } ${ATTENDANCE_STATUS_COLORS[status]} text-white`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {ATTENDANCE_STATUS_LABELS[status]}
                            </button>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        {complete ? (
                          <Badge className="bg-amber-500 text-white">
                            <Crown className="h-3 w-3 mr-1" />
                            완전
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell className="text-center">
                      <button
                        onClick={() => handleStatusToggle(eventId, m.id)}
                        disabled={!isAdmin}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          isAdmin ? "cursor-pointer hover:opacity-80" : "cursor-default"
                        } ${ATTENDANCE_STATUS_COLORS[getStatus(eventId, m.id)]} text-white`}
                      >
                        {(() => {
                          const Icon = statusIcons[getStatus(eventId, m.id)];
                          return <Icon className="h-3 w-3" />;
                        })()}
                        {ATTENDANCE_STATUS_LABELS[getStatus(eventId, m.id)]}
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function EventEditForm({
  event,
  onSaved,
}: {
  event: GuildEvent;
  onSaved: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [title, setTitle] = useState(event.title);
  const [contentType, setContentType] = useState<ContentType>(event.content_type);
  const [difficulty, setDifficulty] = useState(event.difficulty ?? "");
  const [bossName, setBossName] = useState(event.boss_name ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    format(new Date(event.scheduled_at), "yyyy-MM-dd'T'HH:mm")
  );
  const [bossList, setBossList] = useState<BossRegistry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("boss_registry")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setBossList(data ?? []));
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("제목을 입력하세요"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({
        title: title.trim(),
        content_type: contentType,
        difficulty: difficulty || null,
        boss_name: bossName || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
      })
      .eq("id", event.id);
    if (error) toast.error("수정 실패: " + error.message);
    else { toast.success("수정됨"); onSaved(); }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>컨텐츠 타입</Label>
        <Select value={contentType} onValueChange={(v) => v && setContentType(v as ContentType)}>
          <SelectTrigger><SelectValue>{CONTENT_TYPE_LABELS[contentType]}</SelectValue></SelectTrigger>
          <SelectContent>
            {CONTENT_TYPES.map((ct) => (
              <SelectItem key={ct} value={ct}>{CONTENT_TYPE_LABELS[ct]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>제목 *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>난이도</Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
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
            <SelectTrigger><SelectValue>{bossName || "선택"}</SelectValue></SelectTrigger>
            <SelectContent>
              {bossList
                .filter((b) => !b.content_type || b.content_type === contentType)
                .map((b) => (
                  <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
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
        {saving ? "저장 중..." : "수정"}
      </Button>
    </form>
  );
}
