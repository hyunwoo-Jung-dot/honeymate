"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { Lottery, Profile, DiamondDistribution, GuildEvent, ContentType, Attendance, AttendanceStatus, DistributionAsset } from "@/types";
import { CONTENT_TYPE_LABELS } from "@/lib/constants";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Ticket, Plus, Trash2, Diamond, CalendarCheck, Coins } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import Link from "next/link";

const GUILD_ID = "00000000-0000-0000-0000-000000000001";

export default function LotteryListPage() {
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [diamonds, setDiamonds] = useState<DiamondDistribution[]>([]);
  const [assets, setAssets] = useState<DistributionAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [diamondLoading, setDiamondLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchLotteries = useCallback(async () => {
    try {
      const [lRes, aRes] = await Promise.all([
        supabase.from("lotteries").select("*")
          .order("created_at", { ascending: false }).limit(50),
        supabase.from("distribution_assets").select("*"),
      ]);
      setLotteries(lRes.data ?? []);
      setAssets(aRes.data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [supabase]);

  const fetchDiamonds = useCallback(async () => {
    const { data } = await supabase
      .from("diamond_distributions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setDiamonds(data ?? []);
    setDiamondLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchLotteries();
    fetchDiamonds();
  }, [fetchLotteries, fetchDiamonds]);

  const handleDeleteLottery = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${title}" 분배를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("lotteries").delete().eq("id", id);
    if (error) toast.error("삭제 실패");
    else { toast.success("삭제됨"); fetchLotteries(); }
  };

  const handleDeleteDiamond = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${title}" 다이아 분배를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("diamond_distributions").delete().eq("id", id);
    if (error) toast.error("삭제 실패");
    else { toast.success("삭제됨"); fetchDiamonds(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">분배</h1>
        <p className="text-muted-foreground">아이템 분배 및 다이아 분배 기록</p>
      </div>

      <Tabs defaultValue="item">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="item">아이템 분배</TabsTrigger>
          <TabsTrigger value="asset">자산 분배</TabsTrigger>
          <TabsTrigger value="diamond">다이아 분배 (기존)</TabsTrigger>
        </TabsList>

        {/* 아이템 분배 탭 */}
        <TabsContent value="item" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <AdminGuard>
              <Link href="/lottery/new">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  새 분배
                </Button>
              </Link>
            </AdminGuard>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">로딩 중...</CardContent>
            </Card>
          ) : lotteries.filter((l) => l.target_kind !== "asset").length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Ticket className="mx-auto h-10 w-10 mb-2 opacity-50" />
                <p>아직 아이템 분배 기록이 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {lotteries.filter((l) => l.target_kind !== "asset").map((lottery) => (
                <Link key={lottery.id} href={`/lottery/${lottery.id}`}>
                  <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            lottery.status === "revealed" ? "default"
                              : lottery.status === "committed" ? "secondary"
                              : "outline"
                          }
                        >
                          {lottery.status === "revealed" ? "완료"
                            : lottery.status === "committed" ? "대기"
                            : "준비"}
                        </Badge>
                        <Badge variant="outline">
                          {lottery.type === "ladder" ? "사다리" : "랜덤"}
                        </Badge>
                      </div>
                      <CardTitle className="text-base">{lottery.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>
                        참가자 {Array.isArray(lottery.participants) ? lottery.participants.length : 0}명 |
                        아이템 {Array.isArray(lottery.items) ? lottery.items.length : 0}개 |{" "}
                        {format(new Date(lottery.created_at), "yyyy.MM.dd HH:mm", { locale: ko })}
                      </CardDescription>
                    </CardContent>
                    {isAdmin && (
                      <div className="px-4 pb-3 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-destructive h-7"
                          onClick={(e) => handleDeleteLottery(e, lottery.id, lottery.title)}>
                          <Trash2 className="h-3 w-3 mr-1" />삭제
                        </Button>
                      </div>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 자산 분배 탭 */}
        <TabsContent value="asset" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <AdminGuard>
              <Link href="/lottery/asset/new">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  새 자산 분배
                </Button>
              </Link>
            </AdminGuard>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">로딩 중...</CardContent>
            </Card>
          ) : lotteries.filter((l) => l.target_kind === "asset").length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Coins className="mx-auto h-10 w-10 mb-2 opacity-50" />
                <p>아직 자산 분배 기록이 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {lotteries.filter((l) => l.target_kind === "asset").map((lottery) => {
                const asset = assets.find((a) => a.id === lottery.asset_id);
                return (
                  <Link key={lottery.id} href={`/lottery/${lottery.id}`}>
                    <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={
                              lottery.status === "revealed" ? "default"
                                : lottery.status === "committed" ? "secondary"
                                : "outline"
                            }
                          >
                            {lottery.status === "revealed" ? "완료"
                              : lottery.status === "committed" ? "대기"
                              : "준비"}
                          </Badge>
                          <Badge variant="outline" className="bg-purple-500/10">
                            {asset?.name ?? "자산"}
                          </Badge>
                          <Badge variant="outline">
                            {lottery.selection_mode === "all" ? "전원 균등"
                              : lottery.selection_mode === "random_pick" ? "랜덤 추첨"
                              : lottery.selection_mode === "weighted_pick" ? "가중 추첨"
                              : lottery.selection_mode === "ranked" ? "순위 분배"
                              : ""}
                          </Badge>
                        </div>
                        <CardTitle className="text-base">{lottery.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>
                          참가자 {Array.isArray(lottery.participants) ? lottery.participants.length : 0}명 |
                          총량 {lottery.total_amount?.toLocaleString() ?? "-"}
                          {asset?.unit && ` ${asset.unit}`} |{" "}
                          {format(new Date(lottery.created_at), "yyyy.MM.dd HH:mm", { locale: ko })}
                        </CardDescription>
                      </CardContent>
                      {isAdmin && (
                        <div className="px-4 pb-3 flex justify-end">
                          <Button variant="ghost" size="sm" className="text-destructive h-7"
                            onClick={(e) => handleDeleteLottery(e, lottery.id, lottery.title)}>
                            <Trash2 className="h-3 w-3 mr-1" />삭제
                          </Button>
                        </div>
                      )}
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 다이아 분배 탭 */}
        <TabsContent value="diamond" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <AdminGuard>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    새 분배
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>다이아 분배 등록</DialogTitle>
                  </DialogHeader>
                  <DiamondForm
                    onSaved={() => { setDialogOpen(false); fetchDiamonds(); }}
                  />
                </DialogContent>
              </Dialog>
            </AdminGuard>
          </div>

          {diamondLoading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">로딩 중...</CardContent>
            </Card>
          ) : diamonds.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Diamond className="mx-auto h-10 w-10 mb-2 opacity-50" />
                <p>아직 다이아 분배 기록이 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {diamonds.map((d) => (
                <Link key={d.id} href={`/lottery/diamond/${d.id}`}>
                  <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={d.is_distributed ? "default" : "outline"}>
                          {d.is_distributed ? "분배완료" : "미분배"}
                        </Badge>
                        <CardTitle className="text-base">{d.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>
                        총 {d.total_amount.toLocaleString()} 다이아 |
                        1인당 {d.per_person.toLocaleString()} |
                        {d.recipient_count}명 |{" "}
                        {format(new Date(d.created_at), "yyyy.MM.dd", { locale: ko })}
                      </CardDescription>
                    </CardContent>
                    {isAdmin && (
                      <div className="px-4 pb-3 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-destructive h-7"
                          onClick={(e) => handleDeleteDiamond(e, d.id, d.title)}>
                          <Trash2 className="h-3 w-3 mr-1" />삭제
                        </Button>
                      </div>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DiamondForm({ onSaved }: { onSaved: () => void }) {
  const [supabase] = useState(() => createClient());
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [note, setNote] = useState("");
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, nickname, character_class, growth_score, is_active, guild_id, is_awakened, server_name, created_at, updated_at")
      .eq("is_active", true)
      .order("nickname")
      .then(({ data }) => {
        const profiles = data ?? [];
        setMembers(profiles);
        setSelectedIds(new Set(profiles.map((p: Profile) => p.id)));
      });
  }, [supabase]);

  const count = selectedIds.size;
  const total = parseInt(totalAmount) || 0;
  const perPerson = count > 0 ? Math.floor(total / count) : 0;

  const toggleAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !totalAmount || count === 0) {
      toast.error("제목, 다이아 수량, 수령자를 입력하세요");
      return;
    }
    setSaving(true);

    const { data: dist, error } = await supabase
      .from("diamond_distributions")
      .insert({
        guild_id: GUILD_ID,
        title: title.trim(),
        total_amount: total,
        per_person: perPerson,
        recipient_count: count,
        note: note.trim() || null,
      })
      .select()
      .single();

    if (error || !dist) {
      toast.error("생성 실패: " + (error?.message ?? "unknown"));
      setSaving(false);
      return;
    }

    const memberRows = Array.from(selectedIds).map((pid) => ({
      distribution_id: dist.id,
      profile_id: pid,
    }));

    const { error: memberErr } = await supabase
      .from("diamond_distribution_members")
      .insert(memberRows);

    if (memberErr) toast.error("수령자 저장 실패");
    else { toast.success("분배 등록됨"); onSaved(); }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>제목 *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 4/17 다이아 분배" required />
      </div>
      <div className="space-y-2">
        <Label>총 다이아 *</Label>
        <Input type="number" min={1} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0" required />
      </div>
      <div className="space-y-2">
        <Label>메모</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="선택사항" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label>수령자 ({count}명 선택)</Label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
            >
              <CalendarCheck className="h-3 w-3" />
              참석에서 가져오기
            </button>
            <button type="button" onClick={toggleAll} className="text-xs text-primary underline">
              {selectedIds.size === members.length ? "전체해제" : "전체선택"}
            </button>
          </div>
        </div>
        <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent/50">
              <input
                type="checkbox"
                checked={selectedIds.has(m.id)}
                onChange={() => toggle(m.id)}
                className="rounded"
              />
              <span className="text-sm">{m.nickname}</span>
            </label>
          ))}
        </div>
      </div>

      <ImportAttendanceDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(ids) => {
          setSelectedIds(new Set(ids));
          setImportOpen(false);
        }}
      />

      {count > 0 && total > 0 && (
        <div className="rounded-md bg-muted px-4 py-2 text-sm">
          1인당 <strong>{perPerson.toLocaleString()}</strong> 다이아
          {total % count > 0 && <span className="text-muted-foreground ml-1">(나머지 {total % count} 미분배)</span>}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "저장 중..." : "분배 등록"}
      </Button>
    </form>
  );
}

// ==================== Import Attendance Dialog ====================
const CONTENT_TYPE_OPTIONS: ContentType[] = [
  "guild_dungeon",
  "guild_war",
  "crusade",
  "boss_raid",
  "ice_dungeon",
  "faction_war",
];

function ImportAttendanceDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (profileIds: string[]) => void;
}) {
  const [supabase] = useState(() => createClient());
  const [contentType, setContentType] = useState<ContentType>("guild_dungeon");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [includeAfk, setIncludeAfk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    events: GuildEvent[];
    qualified: { id: string; nickname: string }[];
  } | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setPreview(null);

    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;

    const { data: events } = await supabase
      .from("events")
      .select("*")
      .eq("content_type", contentType)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end);

    const evs = (events ?? []) as GuildEvent[];
    if (evs.length === 0) {
      setPreview({ events: [], qualified: [] });
      setLoading(false);
      return;
    }

    const eventIds = evs.map((e) => e.id);
    const [{ data: atts }, { data: profs }] = await Promise.all([
      supabase.from("attendances").select("*").in("event_id", eventIds),
      supabase.from("profiles").select("id, nickname").eq("is_active", true),
    ]);

    const allowed: AttendanceStatus[] = includeAfk
      ? ["present", "afk"]
      : ["present"];

    // For each profile: must be in `allowed` for ALL events of that day
    const profiles = (profs ?? []) as { id: string; nickname: string }[];
    const attendanceMap = new Map<string, Map<string, string>>();
    eventIds.forEach((id) => attendanceMap.set(id, new Map()));
    (atts ?? []).forEach((a: Attendance) => {
      attendanceMap.get(a.event_id)?.set(a.profile_id, a.status);
    });

    const qualified = profiles.filter((p) =>
      eventIds.every((eid) => {
        const status = attendanceMap.get(eid)?.get(p.id);
        return status && allowed.includes(status as AttendanceStatus);
      })
    );

    setPreview({ events: evs, qualified });
    setLoading(false);
  }, [supabase, contentType, date, includeAfk]);

  // Auto-load when filters change while dialog is open
  useEffect(() => {
    if (open) loadPreview();
  }, [open, loadPreview]);

  const handleImport = () => {
    if (!preview || preview.qualified.length === 0) {
      toast.error("가져올 인원이 없습니다.");
      return;
    }
    onImport(preview.qualified.map((q) => q.id));
    toast.success(`${preview.qualified.length}명 선택됨`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>참석에서 인원 가져오기</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>컨텐츠 종류</Label>
            <Select
              value={contentType}
              onValueChange={(v) => v && setContentType(v as ContentType)}
            >
              <SelectTrigger>
                <SelectValue>{CONTENT_TYPE_LABELS[contentType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPE_OPTIONS.map((ct) => (
                  <SelectItem key={ct} value={ct}>
                    {CONTENT_TYPE_LABELS[ct]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>날짜</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeAfk}
              onChange={(e) => setIncludeAfk(e.target.checked)}
              className="rounded"
            />
            잠수도 포함
          </label>

          <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
            {loading ? (
              <p className="text-muted-foreground">불러오는 중...</p>
            ) : !preview ? null : preview.events.length === 0 ? (
              <p className="text-muted-foreground">
                해당 날짜의 {CONTENT_TYPE_LABELS[contentType]} 이벤트가 없습니다.
              </p>
            ) : (
              <>
                <p>
                  대상 이벤트: <strong>{preview.events.length}개</strong>
                  {contentType === "guild_dungeon" && preview.events.length > 1 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (모두 참석한 멤버만)
                    </span>
                  )}
                </p>
                <p>
                  완전 참석자: <strong>{preview.qualified.length}명</strong>
                </p>
                {preview.qualified.length > 0 && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {preview.qualified.map((q) => q.nickname).join(", ")}
                  </p>
                )}
              </>
            )}
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={loading || !preview || preview.qualified.length === 0}
            onClick={handleImport}
          >
            {preview?.qualified.length ?? 0}명 선택
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
