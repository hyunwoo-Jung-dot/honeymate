"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { Lottery, Profile, LotteryResult } from "@/types";
import { revealResult, verifyCommit } from "@/lib/lottery";
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
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [animating, setAnimating] = useState(false);

  const fetchData = useCallback(async () => {
    const [lotteryRes, profilesRes] = await Promise.all([
      supabase
        .from("lotteries")
        .select("*")
        .eq("id", lotteryId)
        .single(),
      supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true),
    ]);

    setLottery(lotteryRes.data);

    const pMap = new Map<string, Profile>();
    (profilesRes.data ?? []).forEach((p: Profile) =>
      pMap.set(p.id, p)
    );
    setProfiles(pMap);
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
        뽑기를 찾을 수 없습니다.
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

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
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
            <Badge variant="outline">
              {lottery.type === "ladder"
                ? "사다리타기"
                : "랜덤 뽑기"}
            </Badge>
          </div>
          <CardTitle>{lottery.title}</CardTitle>
          <CardDescription>
            {format(
              new Date(lottery.created_at),
              "yyyy.MM.dd HH:mm",
              { locale: ko }
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Commit Hash (always visible) */}
      <Card>
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
      <div className="grid gap-4 sm:grid-cols-2">
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
                    뽑기 실행
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </AdminGuard>
      )}

      {/* Results */}
      {lottery.status === "revealed" && lottery.result && (
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
                            <Badge className="bg-yellow-500 text-black">{r.item}</Badge>
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

          <Separator />

          {/* Verification */}
          <Card>
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
