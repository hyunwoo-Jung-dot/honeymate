"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSeason } from "@/hooks/useSeason";
import type {
  Profile,
  LotteryType,
  ContentType,
  WeightMode,
  ContributionScore,
  ParticipantWeight,
  CharacterClass,
  ItemRegistry,
  ItemCategory,
  GuildEvent,
  Attendance,
} from "@/types";
import {
  CLASS_LABELS,
} from "@/lib/constants";
import { createCommit, revealResult } from "@/lib/lottery";
import {
  calculateContributions,
  distributeByValue,
} from "@/lib/contribution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ItemForm } from "@/app/items/page";
import {
  ArrowLeft,
  Plus,
  X,
  Users,
  Ticket,
  Trophy,
  CalendarCheck,
  PenLine,
  List,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { CONTENT_TYPE_LABELS as CTL, CONTENT_TYPE_COLORS } from "@/lib/constants";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const WEIGHT_MODE_LABELS: Record<WeightMode, string> = {
  equal: "균등 확률",
  contribution: "기여도 가중치",
  value_based: "순위 분배",
};

export default function NewLotteryPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { seasons, activeSeason } = useSeason();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<LotteryType>("random_pick");
  const [weightMode, setWeightMode] =
    useState<WeightMode>("equal");
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set()
  );
  const [items, setItems] = useState<
    { registryId: string; name: string; goldValue: number; qty: string }[]
  >([{ registryId: "", name: "", goldValue: 0, qty: "1" }]);
  const [registryItems, setRegistryItems] = useState<ItemRegistry[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [itemCatFilter, setItemCatFilter] = useState("all");
  const [itemInputModes, setItemInputModes] = useState<("select" | "text")[]>(["select"]);
  const [quickRegister, setQuickRegister] = useState<{ open: boolean; idx: number; name: string }>({ open: false, idx: 0, name: "" });
  const [importEventOpen, setImportEventOpen] = useState(false);
  const [recentEvents, setRecentEvents] = useState<GuildEvent[]>([]);

  // Contribution settings
  const [contribSeasonNum, setContribSeasonNum] = useState(
    activeSeason?.name?.replace(/[^0-9]/g, "") ?? "1"
  );
  const [contribContentType, setContribContentType] =
    useState<string>("all");
  const [healerBonusEnabled, setHealerBonusEnabled] =
    useState(true);
  const [healerBonusRate, setHealerBonusRate] = useState(0.2);
  const [contribScores, setContribScores] = useState<
    ContributionScore[]
  >([]);
  const [participantWeights, setParticipantWeights] = useState<
    ParticipantWeight[]
  >([]);

  const [saving, setSaving] = useState(false);

  const fetchRegistry = useCallback(async () => {
    const [regRes, catRes] = await Promise.all([
      supabase.from("item_registry").select("*").eq("is_active", true).order("gold_value", { ascending: false }),
      supabase.from("item_categories").select("*").eq("guild_id", "00000000-0000-0000-0000-000000000001").order("sort_order"),
    ]);
    setRegistryItems(regRes.data ?? []);
    setCategories(catRes.data ?? []);
  }, [supabase]);

  const fetchRecentEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("scheduled_at", { ascending: false })
      .limit(20);
    setRecentEvents(data ?? []);
  }, [supabase]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("nickname");
    setMembers(data ?? []);
  }, [supabase]);

  const contribSeason = seasons.find(
    (s) => s.name === `시즌 ${contribSeasonNum}`
  );

  const fetchContribScores = useCallback(async () => {
    let query = supabase
      .from("contribution_scores")
      .select("*");
    if (contribSeason) {
      query = query.eq("season_id", contribSeason.id);
    }
    const { data } = await query;
    setContribScores(data ?? []);
  }, [supabase, contribSeason]);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from("guild_settings")
      .select("*")
      .limit(1)
      .single();
    if (data) {
      setHealerBonusRate(Number(data.healer_bonus_rate) || 0.2);
    }
  }, [supabase]);

  useEffect(() => {
    fetchMembers();
    fetchRegistry();
    fetchContribScores();
    fetchSettings();
    fetchRecentEvents();
  }, [fetchMembers, fetchContribScores, fetchSettings, fetchRecentEvents]);

  // Recalculate weights when selection changes
  useEffect(() => {
    if (
      weightMode === "equal" ||
      selectedIds.size === 0
    )
      return;

    const filtered =
      contribContentType === "all"
        ? contribScores
        : contribScores.filter(
            (c) => c.content_type === contribContentType
          );

    const weights = calculateContributions({
      participantIds: Array.from(selectedIds),
      scores: filtered,
      healerBonusRate,
      healerBonusEnabled,
    });
    setParticipantWeights(weights);
  }, [
    selectedIds,
    contribScores,
    contribContentType,
    healerBonusEnabled,
    healerBonusRate,
    weightMode,
  ]);

  const toggleMember = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () =>
    setSelectedIds(new Set(members.map((m) => m.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const addItem = () => {
    setItems([...items, { registryId: "", name: "", goldValue: 0, qty: "1" }]);
    setItemInputModes([...itemInputModes, "select"]);
  };
  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
    setItemInputModes(itemInputModes.filter((_, i) => i !== idx));
  };

  const setInputMode = (idx: number, mode: "select" | "text") => {
    const next = [...itemInputModes];
    next[idx] = mode;
    setItemInputModes(next);
    if (mode === "select") {
      const nextItems = [...items];
      nextItems[idx] = { registryId: "", name: "", goldValue: 0, qty: nextItems[idx].qty };
      setItems(nextItems);
    }
  };

  const setTextItem = (idx: number, name: string) => {
    const next = [...items];
    const reg = registryItems.find((r) => r.name.toLowerCase() === name.toLowerCase());
    next[idx] = reg
      ? { registryId: reg.id, name: reg.name, goldValue: reg.gold_value, qty: next[idx].qty }
      : { registryId: "", name, goldValue: 0, qty: next[idx].qty };
    setItems(next);
  };

  const importFromEvent = async (eventId: string, statusFilter: ("present" | "afk" | "absent")[]) => {
    const { data } = await supabase
      .from("attendances")
      .select("profile_id, status")
      .eq("event_id", eventId)
      .in("status", statusFilter);
    if (data && data.length > 0) {
      setSelectedIds(new Set((data as Attendance[]).map((a) => a.profile_id)));
      setImportEventOpen(false);
      toast.success(`${data.length}명 가져옴`);
    } else {
      toast("해당 조건의 참석자가 없습니다");
    }
  };
  const selectRegistryItem = (idx: number, registryId: string) => {
    const reg = registryItems.find((r) => r.id === registryId);
    if (!reg) return;
    const next = [...items];
    next[idx] = {
      registryId: reg.id,
      name: reg.name,
      goldValue: reg.gold_value,
      qty: next[idx].qty || "1",
    };
    setItems(next);
  };
  const updateQty = (idx: number, qty: string) => {
    const next = [...items];
    next[idx] = { ...next[idx], qty };
    setItems(next);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("제목을 입력하세요");
      return;
    }
    if (selectedIds.size < 2) {
      toast.error("참가자를 2명 이상 선택하세요");
      return;
    }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      toast.error("아이템을 1개 이상 선택하세요");
      return;
    }
    if (validItems.some((i) => !i.registryId)) {
      toast.error("등록되지 않은 아이템이 있습니다. 아이템 관리에서 먼저 등록하세요.");
      return;
    }

    setSaving(true);

    const participants = Array.from(selectedIds).sort();
    // Expand items by quantity (e.g., qty=3 → 3 entries)
    const expandedItems: { name: string; goldValue: number }[] = [];
    for (const item of validItems) {
      const qty = parseInt(item.qty) || 1;
      for (let i = 0; i < qty; i++) {
        expandedItems.push({
          name: item.name,
          goldValue: item.goldValue,
        });
      }
    }
    const itemNames = expandedItems.map((i) => i.name);
    const itemValues = expandedItems;

    // Build weights for lottery
    const weights =
      weightMode !== "equal"
        ? participantWeights.map((w) => ({
            participantId: w.profileId,
            weight: w.weight,
          }))
        : undefined;

    if (weightMode === "value_based") {
      // Value-based: deterministic rank distribution
      const result = distributeByValue(
        participantWeights,
        itemValues
      );
      const commit = await createCommit({
        participants,
        items: itemNames,
        weights,
      });

      const assignments = result.map((r) => ({
        participantId: r.participantId,
        item: r.item,
      }));

      const { data, error } = await supabase
        .from("lotteries")
        .insert({
          title: title.trim(),
          type,
          participants,
          items: itemNames,
          seed_timestamp: commit.seedTimestamp,
          server_secret: commit.serverSecret,
          commit_hash: commit.commitHash,
          result: assignments,
          revealed_at: new Date().toISOString(),
          status: "revealed",
          weight_mode: weightMode,
          weight_season_id: contribSeason?.id ?? null,
          weight_content_type:
            contribContentType === "all"
              ? null
              : contribContentType,
          healer_bonus_enabled: healerBonusEnabled,
          participant_weights: participantWeights,
          item_values: itemValues,
        })
        .select()
        .single();

      if (error) {
        toast.error("생성 실패: " + error.message);
        setSaving(false);
        return;
      }
      toast.success("순위 분배 완료!");
      router.push(`/lottery/${data.id}`);
    } else {
      // Equal or contribution weighted
      const commit = await createCommit({
        participants,
        items: itemNames,
        weights,
      });
      const result = await revealResult(
        { participants, items: itemNames, weights },
        commit
      );

      const { data, error } = await supabase
        .from("lotteries")
        .insert({
          title: title.trim(),
          type,
          participants,
          items: itemNames,
          seed_timestamp: commit.seedTimestamp,
          server_secret: commit.serverSecret,
          commit_hash: commit.commitHash,
          result: result.assignments,
          revealed_at: new Date().toISOString(),
          status: "revealed",
          weight_mode: weightMode,
          weight_season_id: contribSeason?.id ?? null,
          weight_content_type:
            contribContentType === "all"
              ? null
              : contribContentType,
          healer_bonus_enabled: healerBonusEnabled,
          participant_weights:
            weightMode === "contribution"
              ? participantWeights
              : null,
          item_values: null,
        })
        .select()
        .single();

      if (error) {
        toast.error("생성 실패: " + error.message);
        setSaving(false);
        return;
      }
      toast.success("분배 완료!");
      router.push(`/lottery/${data.id}`);
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        운영진만 분배를 생성할 수 있습니다.
      </div>
    );
  }

  const getWeight = (id: string) =>
    participantWeights.find((w) => w.profileId === id);

  return (
    <div className="space-y-6">
      <Link
        href="/lottery"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        분배 목록
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">
        새 분배 생성
      </h1>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>제목 *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 얼동 보스템 사다리"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>방식</Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  v && setType(v as LotteryType)
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {type === "random_pick"
                      ? "랜덤 뽑기"
                      : "사다리타기"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random_pick">
                    랜덤 뽑기
                  </SelectItem>
                  <SelectItem value="ladder">
                    사다리타기
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>분배 모드</Label>
              <Select
                value={weightMode}
                onValueChange={(v) =>
                  v && setWeightMode(v as WeightMode)
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {WEIGHT_MODE_LABELS[weightMode]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">
                    균등 확률
                  </SelectItem>
                  <SelectItem value="contribution">
                    기여도 가중치
                  </SelectItem>
                  <SelectItem value="value_based">
                    순위 분배
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contribution Settings (only for weighted modes) */}
      {weightMode !== "equal" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Trophy className="inline h-4 w-4 mr-1" />
              기여도 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>시즌</Label>
              <Input
                type="number"
                min={1}
                className="w-full"
                value={contribSeasonNum}
                onChange={(e) => setContribSeasonNum(e.target.value)}
                placeholder="시즌 번호"
              />
            </div>
            <div className="space-y-2">
              <Label>컨텐츠 기준</Label>
              <Select
                value={contribContentType}
                onValueChange={(v) =>
                  setContribContentType(v ?? "all")
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {contribContentType === "all"
                      ? "전체 통합"
                      : CTL[
                          contribContentType as ContentType
                        ]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    전체 통합
                  </SelectItem>
                  <SelectItem value="guild_dungeon">
                    길드 던전
                  </SelectItem>
                  <SelectItem value="guild_war">
                    길드 전장
                  </SelectItem>
                  <SelectItem value="crusade">
                    크루세이드
                  </SelectItem>
                  <SelectItem value="boss_raid">
                    보스 토벌
                  </SelectItem>
                  <SelectItem value="ice_dungeon">
                    특수던전
                  </SelectItem>
                  <SelectItem value="faction_war">
                    세력전
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={healerBonusEnabled}
                onCheckedChange={(v) =>
                  setHealerBonusEnabled(v === true)
                }
              />
              <Label>
                힐러 보너스 (+{Math.round(healerBonusRate * 100)}
                %)
              </Label>
            </div>
            {activeSeason && (
              <p className="text-xs text-muted-foreground">
                {activeSeason.name} 기준으로 기여도를 계산합니다
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Participant Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">
              <Users className="inline h-4 w-4 mr-1" />
              참가자 선택 ({selectedIds.size}명)
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => { fetchRecentEvents(); setImportEventOpen(true); }}>
                <CalendarCheck className="h-3 w-3 mr-1" />
                이벤트에서 가져오기
              </Button>
              <Button variant="outline" size="sm" onClick={selectAll}>전체선택</Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>해제</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
            {members.map((m) => {
              const w = getWeight(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    selectedIds.has(m.id)
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:bg-accent"
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(m.id)}
                    onCheckedChange={() => toggleMember(m.id)}
                  />
                  <span className="text-sm truncate">
                    {m.nickname}
                  </span>
                  {weightMode !== "equal" && w && (
                    <Badge
                      variant="outline"
                      className="ml-auto text-xs"
                    >
                      {w.totalScore}점
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Contribution Preview (when weighted) */}
      {weightMode !== "equal" &&
        selectedIds.size > 0 &&
        participantWeights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                기여도 미리보기
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>닉네임</TableHead>
                  <TableHead className="text-center">
                    기여도
                  </TableHead>
                  {healerBonusEnabled && (
                    <TableHead className="text-center">
                      보너스
                    </TableHead>
                  )}
                  <TableHead className="text-center">
                    총점
                  </TableHead>
                  {weightMode === "contribution" && (
                    <TableHead className="text-center">
                      확률
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...participantWeights]
                  .sort(
                    (a, b) => b.totalScore - a.totalScore
                  )
                  .map((w, i) => {
                    const member = members.find(
                      (m) => m.id === w.profileId
                    );
                    return (
                      <TableRow key={w.profileId}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          {member?.nickname ??
                            w.profileId.slice(0, 8)}
                          {member?.character_class ===
                            "healer" && (
                            <Badge
                              variant="outline"
                              className="ml-1 text-xs text-blue-400"
                            >
                              힐러
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {w.rawScore}
                        </TableCell>
                        {healerBonusEnabled && (
                          <TableCell className="text-center text-blue-400">
                            {w.bonusScore > 0
                              ? `+${w.bonusScore}`
                              : "-"}
                          </TableCell>
                        )}
                        <TableCell className="text-center font-bold">
                          {w.totalScore}
                        </TableCell>
                        {weightMode === "contribution" && (
                          <TableCell className="text-center">
                            {Math.round(w.weight * 1000) /
                              10}
                            %
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Card>
        )}

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">
              <Ticket className="inline h-4 w-4 mr-1" />
              아이템 ({items.filter((i) => i.name.trim()).length}개)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={itemCatFilter} onValueChange={(v) => setItemCatFilter(v ?? "all")}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue>{itemCatFilter === "all" ? "전체 카테고리" : categories.find(c => c.id === itemCatFilter)?.name ?? "전체"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" />추가
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item, idx) => {
            const mode = itemInputModes[idx] ?? "select";
            const isUnregistered = mode === "text" && item.name.trim() && !item.registryId;
            const filteredRegistry = itemCatFilter === "all"
              ? registryItems
              : registryItems.filter((r) => r.category_id === itemCatFilter);
            return (
              <div key={idx} className="space-y-1">
                <div className="flex gap-2 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title={mode === "select" ? "직접입력으로 전환" : "선택으로 전환"}
                    onClick={() => setInputMode(idx, mode === "select" ? "text" : "select")}
                  >
                    {mode === "select" ? <PenLine className="h-3 w-3" /> : <List className="h-3 w-3" />}
                  </Button>
                  {mode === "select" ? (
                    <Select value={item.registryId} onValueChange={(v) => v && selectRegistryItem(idx, v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue>{item.name || "아이템 선택"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {filteredRegistry.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} {r.grade ? `[${r.grade}]` : ""} {r.gold_value > 0 ? `(${r.gold_value.toLocaleString()})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="flex-1"
                      placeholder="아이템명 직접 입력"
                      value={item.name}
                      onChange={(e) => setTextItem(idx, e.target.value)}
                    />
                  )}
                  <Input
                    type="number" min={1}
                    value={item.qty}
                    onChange={(e) => updateQty(idx, e.target.value)}
                    className="w-16" placeholder="수량"
                  />
                  {item.goldValue > 0 && (
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {(item.goldValue * (parseInt(item.qty) || 1)).toLocaleString()}
                    </span>
                  )}
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isUnregistered && (
                  <div className="flex items-center gap-2 pl-10 text-xs text-amber-600">
                    <span>등록되지 않은 아이템입니다.</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setQuickRegister({ open: true, idx, name: item.name })}
                    >
                      등록하기
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {weightMode === "value_based" && (
            <p className="text-xs text-muted-foreground">
              총 가치(가치×개수) 높은 아이템이 기여도 1등에게 배정됩니다
            </p>
          )}
        </CardContent>
      </Card>

      {/* Import from event dialog */}
      <Dialog open={importEventOpen} onOpenChange={setImportEventOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>이벤트에서 참가자 가져오기</DialogTitle></DialogHeader>
          <ImportEventDialog
            events={recentEvents}
            onImport={importFromEvent}
          />
        </DialogContent>
      </Dialog>

      {/* Quick register dialog */}
      <Dialog open={quickRegister.open} onOpenChange={(open) => setQuickRegister((q) => ({ ...q, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>아이템 등록</DialogTitle></DialogHeader>
          <ItemForm
            item={null}
            categories={categories}
            initialName={quickRegister.name}
            onSaved={(saved) => {
              setQuickRegister((q) => ({ ...q, open: false }));
              setRegistryItems((prev) => [saved, ...prev]);
              selectRegistryItem(quickRegister.idx, saved.id);
            }}
          />
        </DialogContent>
      </Dialog>

      <Separator />

      <Button
        className="w-full"
        size="lg"
        onClick={handleCreate}
        disabled={saving}
      >
        {saving
          ? "생성 중..."
          : weightMode === "value_based"
            ? "순위 분배 실행"
            : "분배 실행"}
      </Button>
    </div>
  );
}

function ImportEventDialog({
  events,
  onImport,
}: {
  events: GuildEvent[];
  onImport: (eventId: string, statuses: ("present" | "afk" | "absent")[]) => void;
}) {
  const [selectedEventId, setSelectedEventId] = useState("");
  const [statusFilter, setStatusFilter] = useState<("present" | "afk" | "absent")[]>(["present"]);

  const toggleStatus = (s: "present" | "afk" | "absent") => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>이벤트 선택</Label>
        <Select value={selectedEventId} onValueChange={(v) => setSelectedEventId(v ?? "")}>
          <SelectTrigger>
            <SelectValue>{selectedEventId ? events.find(e => e.id === selectedEventId)?.title ?? "선택" : "선택"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                <span className="text-xs text-muted-foreground mr-2">
                  {format(new Date(e.scheduled_at), "MM/dd", { locale: ko })}
                </span>
                {e.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>참석 상태 포함</Label>
        <div className="flex gap-2">
          {(["present", "afk", "absent"] as const).map((s) => (
            <label key={s} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={statusFilter.includes(s)}
                onChange={() => toggleStatus(s)}
              />
              <span className="text-sm">{s === "present" ? "참석" : s === "afk" ? "잠수" : "불참"}</span>
            </label>
          ))}
        </div>
      </div>
      <Button
        className="w-full"
        disabled={!selectedEventId || statusFilter.length === 0}
        onClick={() => onImport(selectedEventId, statusFilter)}
      >
        가져오기
      </Button>
    </div>
  );
}
