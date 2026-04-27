"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  Profile,
  DistributionAsset,
  GuildEvent,
  ContentType,
  Attendance,
  AttendanceStatus,
  LotterySelectionMode,
} from "@/types";
import { CONTENT_TYPE_LABELS } from "@/lib/constants";
import { createCommit } from "@/lib/lottery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, X, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import Link from "next/link";

const GUILD_ID = "00000000-0000-0000-0000-000000000001";

const SELECTION_MODE_LABELS: Record<LotterySelectionMode, string> = {
  all: "전원 균등 분배",
  random_pick: "N명 랜덤 추첨 → 균등",
  weighted_pick: "기여도 가중 추첨 → 균등",
  ranked: "기여도 순위 + 등수별 비율",
};

const CONTENT_TYPE_OPTIONS: ContentType[] = [
  "guild_dungeon", "guild_war", "crusade", "boss_raid", "ice_dungeon", "faction_war",
];

export default function NewAssetDistributionPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();

  // Basic
  const [title, setTitle] = useState("");
  const [assetId, setAssetId] = useState<string>("");
  const [assets, setAssets] = useState<DistributionAsset[]>([]);
  const [mode, setMode] = useState<LotterySelectionMode>("all");
  const [totalAmount, setTotalAmount] = useState("");
  const [recipientCount, setRecipientCount] = useState("");
  const [rankRatiosStr, setRankRatiosStr] = useState("50,30,20");

  // Participants
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  // Basis events (weighted_pick / ranked)
  const [recentEvents, setRecentEvents] = useState<GuildEvent[]>([]);
  const [usedEventIds, setUsedEventIds] = useState<Set<string>>(new Set());
  const [basisEventIds, setBasisEventIds] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);

  const needsScores = mode === "weighted_pick" || mode === "ranked";
  const needsRecipientCount = mode === "random_pick" || mode === "weighted_pick";
  const needsRankRatios = mode === "ranked";

  const fetchInit = useCallback(async () => {
    const [aRes, mRes, eRes, usedRes] = await Promise.all([
      supabase.from("distribution_assets").select("*")
        .eq("guild_id", GUILD_ID).eq("is_active", true).order("sort_order"),
      supabase.from("profiles").select("*")
        .eq("is_active", true).order("nickname"),
      supabase.from("events").select("*")
        .order("scheduled_at", { ascending: false }).limit(50),
      supabase.from("lottery_basis_events").select("event_id"),
    ]);
    setAssets(aRes.data ?? []);
    setMembers(mRes.data ?? []);
    setRecentEvents(eRes.data ?? []);
    setUsedEventIds(new Set((usedRes.data ?? []).map((r: { event_id: string }) => r.event_id)));
    if (aRes.data && aRes.data.length > 0 && !assetId) setAssetId(aRes.data[0].id);
  }, [supabase, assetId]);

  useEffect(() => { fetchInit(); }, [fetchInit]);

  const toggleParticipant = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleBasisEvent = (id: string) => {
    if (usedEventIds.has(id)) return;
    const next = new Set(basisEventIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBasisEventIds(next);
  };

  const handleSubmit = async () => {
    if (!isAdmin) return;
    if (!title.trim()) { toast.error("제목을 입력하세요"); return; }
    if (!assetId) { toast.error("자산을 선택하세요"); return; }
    const total = parseFloat(totalAmount);
    if (!total || total <= 0) { toast.error("총량을 입력하세요"); return; }
    if (selectedIds.size === 0) { toast.error("참가자를 선택하세요"); return; }

    let N = parseInt(recipientCount);
    if (needsRecipientCount) {
      if (!N || N <= 0) { toast.error("수령 인원수를 입력하세요"); return; }
      if (N > selectedIds.size) {
        toast.error("수령 인원수가 참가자 수보다 많습니다");
        return;
      }
    }

    let ratios: number[] | null = null;
    if (needsRankRatios) {
      ratios = rankRatiosStr.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n) && n > 0);
      if (ratios.length === 0) {
        toast.error("등수 비율을 콤마로 구분해 입력 (예: 50,30,20)");
        return;
      }
      if (ratios.length > selectedIds.size) {
        toast.error(`참가자(${selectedIds.size}명)보다 등수 수(${ratios.length})가 많습니다`);
        return;
      }
    }

    if (needsScores && basisEventIds.size === 0) {
      toast.error("기준 이벤트를 1개 이상 선택하세요");
      return;
    }

    setSaving(true);
    try {
      const participants = Array.from(selectedIds).sort();
      const items: string[] = [];

      // Generate commit hash (for consistency with existing lotteries)
      const commit = await createCommit({
        participants,
        items,
      });

      const { data: lot, error: lotErr } = await supabase
        .from("lotteries")
        .insert({
          title: title.trim(),
          type: "random_pick",
          participants,
          items,
          seed_timestamp: commit.seedTimestamp,
          server_secret: commit.serverSecret,
          commit_hash: commit.commitHash,
          status: "committed",
          weight_mode: "equal",
          target_kind: "asset",
          selection_mode: mode,
          asset_id: assetId,
          total_amount: total,
          recipient_count: needsRecipientCount ? N : null,
          rank_ratios: ratios,
        })
        .select()
        .single();

      if (lotErr || !lot) throw new Error(lotErr?.message ?? "생성 실패");

      // Save basis events
      if (basisEventIds.size > 0) {
        const rows = Array.from(basisEventIds).map((eid) => ({
          lottery_id: lot.id, event_id: eid,
        }));
        await supabase.from("lottery_basis_events").insert(rows);
      }

      toast.success("분배 생성됨. 결과 공개 페이지로 이동");
      router.push(`/lottery/${lot.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "오류";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="text-center py-10 text-muted-foreground">로딩 중...</div>;
  if (!isAdmin) return <div className="text-center py-10 text-muted-foreground">운영진 전용입니다.</div>;

  const selectedAsset = assets.find((a) => a.id === assetId);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/lottery" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" />
        분배 목록
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">자산 분배 생성</h1>
        <p className="text-muted-foreground">다이아 / 길드주화 등 자산을 다양한 방식으로 분배합니다</p>
      </div>

      {/* Basic */}
      <Card>
        <CardHeader><CardTitle className="text-base">기본 정보</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>제목 *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 4/27 길드주화 분배" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>자산 *</Label>
              <Select value={assetId} onValueChange={(v) => setAssetId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="자산 선택">
                    {selectedAsset ? `${selectedAsset.name} (${selectedAsset.unit ?? ""})` : ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.unit && `(${a.unit})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>총량 *</Label>
              <Input type="number" min={1} value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode */}
      <Card>
        <CardHeader><CardTitle className="text-base">분배 방식</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>방식 *</Label>
            <Select value={mode} onValueChange={(v) => v && setMode(v as LotterySelectionMode)}>
              <SelectTrigger><SelectValue>{SELECTION_MODE_LABELS[mode]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{SELECTION_MODE_LABELS.all}</SelectItem>
                <SelectItem value="random_pick">{SELECTION_MODE_LABELS.random_pick}</SelectItem>
                <SelectItem value="weighted_pick">{SELECTION_MODE_LABELS.weighted_pick}</SelectItem>
                <SelectItem value="ranked">{SELECTION_MODE_LABELS.ranked}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {needsRecipientCount && (
            <div className="space-y-2">
              <Label>수령 인원수 *</Label>
              <Input type="number" min={1} value={recipientCount}
                onChange={(e) => setRecipientCount(e.target.value)}
                placeholder="예: 5" />
            </div>
          )}

          {needsRankRatios && (
            <div className="space-y-2">
              <Label>등수별 비율 (콤마 구분, 단위: %) *</Label>
              <Input value={rankRatiosStr}
                onChange={(e) => setRankRatiosStr(e.target.value)}
                placeholder="50, 30, 20" />
              <p className="text-xs text-muted-foreground">
                등수 수만큼 비율 입력. 합계가 100이 아니면 비율로 정규화됩니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Basis events (weighted/ranked) */}
      {needsScores && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">기준 이벤트 *</CardTitle>
            <p className="text-xs text-muted-foreground">
              점수 합산 기준 이벤트들. 이미 다른 분배에 사용된 이벤트는 비활성됩니다.
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
              {recentEvents.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">최근 이벤트가 없습니다.</p>
              ) : recentEvents.map((ev) => {
                const used = usedEventIds.has(ev.id);
                const checked = basisEventIds.has(ev.id);
                return (
                  <label key={ev.id}
                    className={`flex items-center gap-2 px-3 py-1.5 ${used ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-accent/50"}`}>
                    <input type="checkbox"
                      disabled={used}
                      checked={checked}
                      onChange={() => toggleBasisEvent(ev.id)}
                      className="rounded" />
                    <Badge variant="outline" className="text-[10px]">
                      {CONTENT_TYPE_LABELS[ev.content_type]}
                    </Badge>
                    <span className="text-sm flex-1">{ev.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ev.scheduled_at), "MM.dd", { locale: ko })}
                    </span>
                    {used && <span className="text-xs text-muted-foreground">이미 분배됨</span>}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {basisEventIds.size}개 선택됨
            </p>
          </CardContent>
        </Card>
      )}

      {/* Participants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">참가자 ({selectedIds.size}명)</CardTitle>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setImportOpen(true)}
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                <CalendarCheck className="h-3 w-3" />
                참석에서 가져오기
              </button>
              <button type="button"
                onClick={() => setSelectedIds(new Set(selectedIds.size === members.length ? [] : members.map((m) => m.id)))}
                className="text-xs text-primary underline">
                {selectedIds.size === members.length ? "전체해제" : "전체선택"}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md max-h-60 overflow-y-auto divide-y">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent/50">
                <input type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onChange={() => toggleParticipant(m.id)}
                  className="rounded" />
                <span className="text-sm">{m.nickname}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <ImportAttendanceDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(ids) => {
          setSelectedIds(new Set(ids));
          setImportOpen(false);
        }}
      />

      <Separator />

      <div className="flex gap-2">
        <Link href="/lottery" className="flex-1">
          <Button variant="outline" className="w-full">취소</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1">
          {saving ? "생성 중..." : "분배 생성"}
        </Button>
      </div>
    </div>
  );
}

// ====================== Import Dialog (reuse pattern) ======================

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

function ImportAttendanceDialog({
  open, onOpenChange, onImport,
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
  const [preview, setPreview] = useState<{ events: GuildEvent[]; qualified: { id: string; nickname: string }[] } | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setPreview(null);
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    const { data: events } = await supabase
      .from("events").select("*")
      .eq("content_type", contentType)
      .gte("scheduled_at", start).lt("scheduled_at", end);
    const evs = (events ?? []) as GuildEvent[];
    if (evs.length === 0) { setPreview({ events: [], qualified: [] }); setLoading(false); return; }

    const eventIds = evs.map((e) => e.id);
    const [{ data: atts }, { data: profs }] = await Promise.all([
      supabase.from("attendances").select("*").in("event_id", eventIds),
      supabase.from("profiles").select("id, nickname").eq("is_active", true),
    ]);
    const allowed: AttendanceStatus[] = includeAfk ? ["present", "afk"] : ["present"];
    const profiles = (profs ?? []) as { id: string; nickname: string }[];
    const am = new Map<string, Map<string, string>>();
    eventIds.forEach((id) => am.set(id, new Map()));
    (atts ?? []).forEach((a: Attendance) => { am.get(a.event_id)?.set(a.profile_id, a.status); });
    const qualified = profiles.filter((p) =>
      eventIds.every((eid) => {
        const s = am.get(eid)?.get(p.id);
        return s && allowed.includes(s as AttendanceStatus);
      })
    );
    setPreview({ events: evs, qualified });
    setLoading(false);
  }, [supabase, contentType, date, includeAfk]);

  useEffect(() => { if (open) loadPreview(); }, [open, loadPreview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>참석에서 인원 가져오기</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>컨텐츠 종류</Label>
            <Select value={contentType} onValueChange={(v) => v && setContentType(v as ContentType)}>
              <SelectTrigger><SelectValue>{CONTENT_TYPE_LABELS[contentType]}</SelectValue></SelectTrigger>
              <SelectContent>
                {CONTENT_TYPE_OPTIONS.map((ct) => (
                  <SelectItem key={ct} value={ct}>{CONTENT_TYPE_LABELS[ct]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>날짜</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeAfk}
              onChange={(e) => setIncludeAfk(e.target.checked)} className="rounded" />
            잠수도 포함
          </label>
          <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
            {loading ? <p className="text-muted-foreground">불러오는 중...</p>
              : !preview ? null
              : preview.events.length === 0 ? (
                <p className="text-muted-foreground">해당 날짜의 {CONTENT_TYPE_LABELS[contentType]} 이벤트가 없습니다.</p>
              ) : (
                <>
                  <p>대상 이벤트: <strong>{preview.events.length}개</strong></p>
                  <p>완전 참석자: <strong>{preview.qualified.length}명</strong></p>
                  {preview.qualified.length > 0 && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {preview.qualified.map((q) => q.nickname).join(", ")}
                    </p>
                  )}
                </>
              )}
          </div>
          <Button type="button" className="w-full"
            disabled={loading || !preview || preview.qualified.length === 0}
            onClick={() => {
              if (!preview) return;
              onImport(preview.qualified.map((q) => q.id));
              toast.success(`${preview.qualified.length}명 선택됨`);
            }}>
            {preview?.qualified.length ?? 0}명 선택
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
