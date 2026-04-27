"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { Lottery, Profile, LotteryResult, ItemRegistry, LotteryAllocation, DistributionAsset } from "@/types";
import { ITEM_GRADE_TEXT_COLORS } from "@/lib/constants";
import { revealResult, verifyCommit, allocate } from "@/lib/lottery";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Play,
  ShieldCheck,
  ShieldAlert,
  Hash,
  Clock,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import Link from "next/link";

export default function LotteryDetailPage() {
  const params = useParams();
  const lotteryId = params.id as string;
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();

  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(
    new Map()
  );
  const [itemRegistry, setItemRegistry] = useState<Map<string, ItemRegistry>>(new Map());
  const [allocations, setAllocations] = useState<LotteryAllocation[]>([]);
  const [asset, setAsset] = useState<DistributionAsset | null>(null);
  const [basisEventTitles, setBasisEventTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [animating, setAnimating] = useState(false);

  const fetchData = useCallback(async () => {
    const [lotteryRes, profilesRes, itemsRes, allocRes] = await Promise.all([
      supabase
        .from("lotteries")
        .select("*")
        .eq("id", lotteryId)
        .single(),
      supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true),
      supabase
        .from("item_registry")
        .select("*")
        .eq("is_active", true),
      supabase
        .from("lottery_allocations")
        .select("*")
        .eq("lottery_id", lotteryId)
        .order("rank", { ascending: true, nullsFirst: false }),
    ]);

    const lot = lotteryRes.data as Lottery | null;
    setLottery(lot);
    setAllocations(allocRes.data ?? []);

    const iMap = new Map<string, ItemRegistry>();
    (itemsRes.data ?? []).forEach((i: ItemRegistry) => iMap.set(i.name, i));
    setItemRegistry(iMap);

    const pMap = new Map<string, Profile>();
    (profilesRes.data ?? []).forEach((p: Profile) =>
      pMap.set(p.id, p)
    );
    setProfiles(pMap);

    // For asset distributions: fetch asset + basis events
    if (lot?.target_kind === "asset") {
      if (lot.asset_id) {
        const { data: a } = await supabase
          .from("distribution_assets")
          .select("*").eq("id", lot.asset_id).single();
        setAsset(a);
      }
      const { data: be } = await supabase
        .from("lottery_basis_events")
        .select("event_id, events(title, scheduled_at)")
        .eq("lottery_id", lotteryId);
      type BasisRow = { event_id: string; events: { title: string; scheduled_at: string } | null };
      const titles = (be as BasisRow[] | null ?? []).map((row) =>
        row.events ? `${row.events.title}` : ""
      ).filter(Boolean);
      setBasisEventTitles(titles);
    }

    setLoading(false);
  }, [supabase, lotteryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReveal = async () => {
    if (!lottery) return;
    setRevealing(true);
    setAnimating(true);

    // Animation delay
    await new Promise((r) => setTimeout(r, 2000));

    if (lottery.target_kind === "asset") {
      // Asset distribution path
      try {
        // Fetch contribution scores if needed
        const needsScores =
          lottery.selection_mode === "weighted_pick" ||
          lottery.selection_mode === "ranked";
        let scoreMap: Record<string, number> = {};

        if (needsScores) {
          const { data: basisRows } = await supabase
            .from("lottery_basis_events")
            .select("event_id")
            .eq("lottery_id", lotteryId);
          const eventIds = (basisRows ?? []).map((r: { event_id: string }) => r.event_id);
          if (eventIds.length > 0) {
            // Fetch attendances + scoring rules + events
            const [{ data: atts }, { data: events }, { data: rules }] = await Promise.all([
              supabase.from("attendances").select("*").in("event_id", eventIds),
              supabase.from("events").select("id, content_type").in("id", eventIds),
              supabase.from("content_scoring_rules").select("*"),
            ]);
            const eventTypeMap = new Map<string, string>();
            (events ?? []).forEach((e: { id: string; content_type: string }) =>
              eventTypeMap.set(e.id, e.content_type)
            );
            type Rule = { content_type: string; present_score: number; afk_score: number; absent_score: number };
            const ruleMap = new Map<string, Rule>();
            (rules ?? []).forEach((r: Rule) => ruleMap.set(r.content_type, r));
            for (const a of (atts ?? [])) {
              const ct = eventTypeMap.get(a.event_id);
              if (!ct) continue;
              const r = ruleMap.get(ct);
              const score = a.status === "present" ? (r?.present_score ?? 2)
                : a.status === "afk" ? (r?.afk_score ?? 1)
                : (r?.absent_score ?? 0);
              scoreMap[a.profile_id] = (scoreMap[a.profile_id] ?? 0) + score;
            }
          }
        }

        const result = await allocate({
          targetKind: "asset",
          selectionMode: lottery.selection_mode!,
          participants: lottery.participants,
          scores: scoreMap,
          totalAmount: lottery.total_amount ?? 0,
          recipientCount: lottery.recipient_count ?? undefined,
          rankRatios: lottery.rank_ratios ?? undefined,
          serverSecret: lottery.server_secret,
          seedTimestamp: lottery.seed_timestamp,
        });

        // Save allocations
        if (result.length > 0) {
          const rows = result.map((r) => ({
            lottery_id: lotteryId,
            profile_id: r.profileId,
            rank: r.rank ?? null,
            score: r.score ?? null,
            amount: r.amount ?? null,
            item: null,
          }));
          const { error: allocErr } = await supabase
            .from("lottery_allocations")
            .insert(rows);
          if (allocErr) throw new Error(allocErr.message);
        }

        const { error: updErr } = await supabase
          .from("lotteries")
          .update({
            status: "revealed",
            revealed_at: new Date().toISOString(),
          })
          .eq("id", lotteryId);
        if (updErr) throw new Error(updErr.message);

        toast.success("결과가 공개되었습니다!");
        fetchData();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "오류";
        toast.error("공개 실패: " + message);
      }
      setRevealing(false);
      setAnimating(false);
      return;
    }

    // Items target (legacy path)
    const result = await revealResult(
      {
        participants: lottery.participants,
        items: lottery.items,
      },
      {
        serverSecret: lottery.server_secret,
        seedTimestamp: lottery.seed_timestamp,
        commitHash: lottery.commit_hash,
      }
    );

    const { error } = await supabase
      .from("lotteries")
      .update({
        result: result.assignments,
        status: "revealed",
        revealed_at: new Date().toISOString(),
      })
      .eq("id", lotteryId);

    if (error) {
      toast.error("공개 실패");
    } else {
      toast.success("결과가 공개되었습니다!");
      fetchData();
    }
    setRevealing(false);
    setAnimating(false);
  };

  const toggleReceived = async (allocId: string, current: boolean) => {
    const { error } = await supabase
      .from("lottery_allocations")
      .update({ is_received: !current })
      .eq("id", allocId);
    if (error) toast.error("업데이트 실패");
    else {
      setAllocations((prev) => prev.map((a) =>
        a.id === allocId ? { ...a, is_received: !current } : a
      ));
    }
  };

  const markAllReceived = async () => {
    const ids = allocations.filter((a) => !a.is_received).map((a) => a.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("lottery_allocations")
      .update({ is_received: true })
      .in("id", ids);
    if (error) toast.error("업데이트 실패");
    else {
      toast.success("전원 지급 완료 처리됨");
      fetchData();
    }
  };

  const handleVerify = async () => {
    if (!lottery) return;
    setVerifying(true);
    const isValid = await verifyCommit(
      {
        participants: lottery.participants,
        items: lottery.items,
      },
      lottery.server_secret,
      lottery.seed_timestamp,
      lottery.commit_hash
    );
    setVerified(isValid);
    setVerifying(false);
    if (isValid) {
      toast.success("검증 성공! 결과가 조작되지 않았습니다.");
    } else {
      toast.error("검증 실패! 해시가 일치하지 않습니다.");
    }
  };

  const getNickname = (id: string) =>
    profiles.get(id)?.nickname ?? id.slice(0, 8);

  if (loading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        분배를 찾을 수 없습니다.
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
        분배 목록
      </Link>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={
                lottery.status === "revealed"
                  ? "default"
                  : "secondary"
              }
            >
              {lottery.status === "revealed"
                ? "완료"
                : lottery.status === "committed"
                  ? "결과 대기"
                  : "준비 중"}
            </Badge>
            {lottery.target_kind === "asset" ? (
              <>
                <Badge variant="outline" className="bg-purple-500/10">
                  {asset?.name ?? "자산"}
                </Badge>
                <Badge variant="outline">
                  {lottery.selection_mode === "all" ? "전원 균등"
                    : lottery.selection_mode === "random_pick" ? "랜덤 추첨"
                    : lottery.selection_mode === "weighted_pick" ? "가중 추첨"
                    : "순위 분배"}
                </Badge>
              </>
            ) : (
              <Badge variant="outline">
                {lottery.type === "ladder" ? "사다리타기" : "랜덤"}
              </Badge>
            )}
          </div>
          <CardTitle>{lottery.title}</CardTitle>
          <CardDescription>
            {format(
              new Date(lottery.created_at),
              "yyyy.MM.dd HH:mm",
              { locale: ko }
            )}
            {lottery.target_kind === "asset" && lottery.total_amount && (
              <span className="ml-2">
                | 총량: <strong>{lottery.total_amount.toLocaleString()}</strong>
                {asset?.unit && ` ${asset.unit}`}
              </span>
            )}
          </CardDescription>
          {basisEventTitles.length > 0 && (
            <p className="text-xs text-muted-foreground">
              기준 이벤트: {basisEventTitles.join(", ")}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Commit Hash - hidden for now */}
      <Card className="hidden">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Commit Hash
          </CardTitle>
          <CardDescription>
            이 해시는 뽑기 생성 시 확정되었으며 결과 조작이
            불가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block p-3 bg-muted rounded text-xs break-all font-mono">
            {lottery.commit_hash}
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            <Clock className="inline h-3 w-3 mr-1" />
            시드 타임스탬프:{" "}
            {format(
              new Date(lottery.seed_timestamp),
              "yyyy-MM-dd HH:mm:ss.SSS"
            )}
          </p>
        </CardContent>
      </Card>

      {/* Participants & Items */}
      <div className={`grid gap-4 ${lottery.target_kind === "asset" ? "" : "sm:grid-cols-2"}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              참가자 ({(lottery.participants as string[])?.length ?? 0}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {(lottery.participants as string[])?.map((id) => (
                <Badge key={id} variant="outline">
                  {getNickname(id)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        {lottery.target_kind !== "asset" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                아이템 ({(lottery.items as string[])?.length ?? 0}개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {(lottery.items as string[])?.map((item, i) => (
                  <Badge key={i} variant="secondary">
                    {item}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reveal Button */}
      {lottery.status === "committed" && (
        <AdminGuard>
          <Card className="border-primary">
            <CardContent className="py-6 text-center">
              {animating ? (
                <div className="space-y-4">
                  <div className="text-4xl animate-bounce">
                    🎲
                  </div>
                  <p className="text-lg font-bold animate-pulse">
                    추첨 중...
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4">
                    참가자 전원이 Commit Hash를 확인한 후
                    실행하세요.
                  </p>
                  <Button
                    size="lg"
                    onClick={handleReveal}
                    disabled={revealing}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    분배 실행
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </AdminGuard>
      )}

      {/* Asset Results */}
      {lottery.status === "revealed" && lottery.target_kind === "asset" && (
        <Card className="border-green-500">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  분배 결과
                </CardTitle>
                {lottery.revealed_at && (
                  <CardDescription>
                    공개 시각: {format(new Date(lottery.revealed_at), "yyyy.MM.dd HH:mm:ss")}
                  </CardDescription>
                )}
              </div>
              {isAdmin && allocations.some((a) => !a.is_received) && (
                <Button size="sm" onClick={markAllReceived}>
                  전원 지급 완료
                </Button>
              )}
            </div>
          </CardHeader>
          {allocations.length === 0 ? (
            <CardContent className="text-center text-muted-foreground py-6">
              할당 결과가 없습니다.
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>닉네임</TableHead>
                  {(lottery.selection_mode === "weighted_pick" ||
                    lottery.selection_mode === "ranked") && (
                    <TableHead className="w-20 text-right">점수</TableHead>
                  )}
                  <TableHead className="w-28 text-right">받을 양</TableHead>
                  <TableHead className="w-28 text-center">지급</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((a, i) => (
                  <TableRow key={a.id} className={a.is_received ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-xs">
                      {a.rank ?? i + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getNickname(a.profile_id)}
                    </TableCell>
                    {(lottery.selection_mode === "weighted_pick" ||
                      lottery.selection_mode === "ranked") && (
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {a.score?.toLocaleString() ?? "-"}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-bold">
                      {a.amount?.toLocaleString() ?? "-"}
                      {asset?.unit && <span className="text-xs text-muted-foreground ml-1">{asset.unit}</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {isAdmin ? (
                        <Button
                          variant={a.is_received ? "default" : "outline"}
                          size="sm"
                          className="h-7"
                          onClick={() => toggleReceived(a.id, a.is_received)}
                        >
                          {a.is_received ? "✓ 완료" : "미지급"}
                        </Button>
                      ) : (
                        <Badge variant={a.is_received ? "default" : "outline"}>
                          {a.is_received ? "완료" : "미지급"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* Items Results (legacy) */}
      {lottery.status === "revealed" && lottery.target_kind !== "asset" && lottery.result && (
        <>
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                결과
              </CardTitle>
              {lottery.revealed_at && (
                <CardDescription>
                  공개 시각:{" "}
                  {format(
                    new Date(lottery.revealed_at),
                    "yyyy.MM.dd HH:mm:ss"
                  )}
                </CardDescription>
              )}
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>닉네임</TableHead>
                  <TableHead>결과</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const results = lottery.result as LotteryResult[];
                  const winnerIds = new Set(results.map((r) => r.participantId));
                  const participants = lottery.participants as string[];
                  const losers = participants.filter((id) => !winnerIds.has(id));
                  return (
                    <>
                      {results.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            {getNickname(r.participantId)}
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold ${
                              itemRegistry.get(r.item)?.grade
                                ? ITEM_GRADE_TEXT_COLORS[itemRegistry.get(r.item)!.grade!] ?? "text-yellow-400"
                                : "text-yellow-400"
                            }`}>{r.item}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {losers.map((id, i) => (
                        <TableRow key={`lose-${i}`} className="opacity-50">
                          <TableCell>{results.length + i + 1}</TableCell>
                          <TableCell className="font-medium">
                            {getNickname(id)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">꽝</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })()}
              </TableBody>
            </Table>
          </Card>

          <Separator className="hidden" />
          {/* Verification - hidden for now */}
          <Card className="hidden">
            <CardHeader>
              <CardTitle className="text-base">
                결과 검증
              </CardTitle>
              <CardDescription>
                아래 정보로 누구든 결과가 조작되지 않았는지 확인할
                수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Server Secret (결과 확정 후 공개)
                </Label>
                <code className="block p-2 bg-muted rounded text-xs break-all font-mono mt-1">
                  {lottery.server_secret}
                </code>
              </div>

              <Button
                onClick={handleVerify}
                disabled={verifying}
                variant={
                  verified === true
                    ? "default"
                    : verified === false
                      ? "destructive"
                      : "outline"
                }
              >
                {verifying ? (
                  "검증 중..."
                ) : verified === true ? (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-1" />
                    검증 성공
                  </>
                ) : verified === false ? (
                  <>
                    <ShieldAlert className="h-4 w-4 mr-1" />
                    검증 실패
                  </>
                ) : (
                  "검증하기"
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                검증 원리: SHA-256(참가자 + 아이템 + ServerSecret
                + 타임스탬프) = CommitHash 일치 여부 확인
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={className}>{children}</p>;
}
