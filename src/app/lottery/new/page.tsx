"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Profile, LotteryType, ContentType } from "@/types";
import { CONTENT_TYPE_LABELS } from "@/lib/constants";
import { createCommit, revealResult } from "@/lib/lottery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
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
  ArrowLeft,
  Plus,
  X,
  Users,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function NewLotteryPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<LotteryType>("random_pick");
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set()
  );
  const [items, setItems] = useState<string[]>([""]);
  const [cutlineEnabled, setCutlineEnabled] = useState(false);
  const [cutlineRate, setCutlineRate] = useState([70]);
  const [cutlineContentType, setCutlineContentType] = useState<string>("all");
  const [attendanceRates, setAttendanceRates] = useState<
    Map<string, number>
  >(new Map());
  const [rawRates, setRawRates] = useState<
    { profile_id: string; content_type: string; attendance_rate: number }[]
  >([]);
  const [saving, setSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("nickname");
    setMembers(data ?? []);
  }, [supabase]);

  const fetchAttendanceRates = useCallback(async () => {
    const { data } = await supabase
      .from("attendance_rates")
      .select("*");
    setRawRates(data ?? []);
  }, [supabase]);

  // Recalculate rates when content type filter changes
  useEffect(() => {
    const filtered = cutlineContentType === "all"
      ? rawRates
      : rawRates.filter((r) => r.content_type === cutlineContentType);
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      const existing = map.get(r.profile_id) ?? 0;
      map.set(r.profile_id, Math.max(existing, r.attendance_rate));
    });
    setAttendanceRates(map);
  }, [rawRates, cutlineContentType]);

  useEffect(() => {
    fetchMembers();
    fetchAttendanceRates();
  }, [fetchMembers, fetchAttendanceRates]);

  const eligibleMembers = cutlineEnabled
    ? members.filter(
        (m) =>
          (attendanceRates.get(m.id) ?? 0) >= cutlineRate[0]
      )
    : members;

  const toggleMember = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(eligibleMembers.map((m) => m.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const addItem = () => setItems([...items, ""]);
  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, value: string) => {
    const next = [...items];
    next[idx] = value;
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
    const validItems = items.filter((i) => i.trim());
    if (validItems.length === 0) {
      toast.error("아이템을 1개 이상 입력하세요");
      return;
    }

    setSaving(true);

    const participants = Array.from(selectedIds).sort();
    const commit = await createCommit({
      participants,
      items: validItems,
    });

    // Auto-reveal: create and execute in one step
    const result = await revealResult(
      { participants, items: validItems },
      commit
    );

    const { data, error } = await supabase
      .from("lotteries")
      .insert({
        title: title.trim(),
        type,
        participants,
        items: validItems,
        seed_timestamp: commit.seedTimestamp,
        server_secret: commit.serverSecret,
        commit_hash: commit.commitHash,
        result: result.assignments,
        revealed_at: new Date().toISOString(),
        status: "revealed",
      })
      .select()
      .single();

    if (error) {
      toast.error("생성 실패: " + error.message);
      setSaving(false);
      return;
    }

    toast.success("뽑기 완료! 결과를 확인하세요.");
    router.push(`/lottery/${data.id}`);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        운영진만 뽑기를 생성할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/lottery"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        뽑기 목록
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">
        새 뽑기 생성
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
          <div className="space-y-2">
            <Label>방식</Label>
            <Select
              value={type}
              onValueChange={(v) => v && setType(v as LotteryType)}
            >
              <SelectTrigger>
                <SelectValue>
                  {type === "random_pick" ? "랜덤 뽑기" : "사다리타기"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random_pick">
                  랜덤 뽑기
                </SelectItem>
                <SelectItem value="ladder">사다리타기</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cutline Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            참석률 컷라인
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={cutlineEnabled}
              onCheckedChange={(v) =>
                setCutlineEnabled(v === true)
              }
            />
            <Label>참석률 기준으로 참가자 필터링</Label>
          </div>
          {cutlineEnabled && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">컨텐츠 기준</Label>
                <Select
                  value={cutlineContentType}
                  onValueChange={(v) => setCutlineContentType(v ?? "all")}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {cutlineContentType === "all"
                        ? "전체 통합"
                        : CONTENT_TYPE_LABELS[cutlineContentType as ContentType]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 통합</SelectItem>
                    <SelectItem value="guild_dungeon">길드 던전</SelectItem>
                    <SelectItem value="guild_war">길드 전장</SelectItem>
                    <SelectItem value="crusade">크루세이드</SelectItem>
                    <SelectItem value="boss_raid">보스 토벌</SelectItem>
                    <SelectItem value="ice_dungeon">특수던전 (얼동)</SelectItem>
                    <SelectItem value="faction_war">세력전</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>최소 참석률</span>
                  <span className="font-bold">
                    {cutlineRate[0]}%
                  </span>
                </div>
                <Slider
                  value={cutlineRate}
                  onValueChange={(v) => setCutlineRate(Array.isArray(v) ? [...v] : [v])}
                  min={0}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  자격자: {eligibleMembers.length}명 / 전체:{" "}
                  {members.length}명
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Participant Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              <Users className="inline h-4 w-4 mr-1" />
              참가자 선택 ({selectedIds.size}명)
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                전체선택
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
              >
                해제
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
            {eligibleMembers.map((m) => (
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
                {cutlineEnabled && (
                  <Badge
                    variant="outline"
                    className="ml-auto text-xs"
                  >
                    {attendanceRates.get(m.id) ?? 0}%
                  </Badge>
                )}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              <Ticket className="inline h-4 w-4 mr-1" />
              아이템 ({items.filter((i) => i.trim()).length}개)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={addItem}
            >
              <Plus className="h-3 w-3 mr-1" />
              추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => updateItem(idx, e.target.value)}
                placeholder={`아이템 ${idx + 1}`}
              />
              {items.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      <Button
        className="w-full"
        size="lg"
        onClick={handleCreate}
        disabled={saving}
      >
        {saving
          ? "생성 중..."
          : "뽑기 생성 (Commit Hash 공개)"}
      </Button>
    </div>
  );
}
