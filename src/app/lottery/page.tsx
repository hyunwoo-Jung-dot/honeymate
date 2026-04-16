"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { Lottery } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Ticket, Plus } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import Link from "next/link";

export default function LotteryListPage() {
  const supabase = createClient();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLotteries = useCallback(async () => {
    const { data } = await supabase
      .from("lotteries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setLotteries(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchLotteries();
  }, [fetchLotteries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            뽑기 / 사다리
          </h1>
          <p className="text-muted-foreground">
            공정한 아이템 분배
          </p>
        </div>
        <AdminGuard>
          <Link href="/lottery/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              새 뽑기
            </Button>
          </Link>
        </AdminGuard>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            로딩 중...
          </CardContent>
        </Card>
      ) : lotteries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Ticket className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>아직 뽑기 기록이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {lotteries.map((lottery) => (
            <Link key={lottery.id} href={`/lottery/${lottery.id}`}>
              <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        lottery.status === "revealed"
                          ? "default"
                          : lottery.status === "committed"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {lottery.status === "revealed"
                        ? "완료"
                        : lottery.status === "committed"
                          ? "대기"
                          : "준비"}
                    </Badge>
                    <Badge variant="outline">
                      {lottery.type === "ladder"
                        ? "사다리"
                        : "랜덤 뽑기"}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">
                    {lottery.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    참가자 {lottery.participants.length}명 |
                    아이템 {lottery.items.length}개 |{" "}
                    {format(
                      new Date(lottery.created_at),
                      "yyyy.MM.dd HH:mm",
                      { locale: ko }
                    )}
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
