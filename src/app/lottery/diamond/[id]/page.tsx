"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { DiamondDistribution, DiamondDistributionMember, Profile } from "@/types";
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
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import Link from "next/link";

interface MemberRow extends DiamondDistributionMember {
  profile: Profile;
}

export default function DiamondDetailPage() {
  const params = useParams();
  const distId = params.id as string;
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();

  const [dist, setDist] = useState<DiamondDistribution | null>(null);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [distRes, membersRes] = await Promise.all([
      supabase.from("diamond_distributions").select("*").eq("id", distId).single(),
      supabase
        .from("diamond_distribution_members")
        .select("*, profile:profiles(*)")
        .eq("distribution_id", distId)
        .order("created_at"),
    ]);
    setDist(distRes.data);
    setRows(membersRes.data ?? []);
    setLoading(false);
  }, [supabase, distId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleReceived = async (row: MemberRow) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from("diamond_distribution_members")
      .update({ is_received: !row.is_received })
      .eq("id", row.id);
    if (error) toast.error("업데이트 실패");
    else fetchData();
  };

  const markAllReceived = async () => {
    if (!isAdmin) return;
    const unreceivedIds = rows.filter((r) => !r.is_received).map((r) => r.id);
    if (unreceivedIds.length === 0) { toast("이미 전원 완료입니다"); return; }
    const { error } = await supabase
      .from("diamond_distribution_members")
      .update({ is_received: true })
      .in("id", unreceivedIds);
    if (error) toast.error("실패");
    else {
      await supabase
        .from("diamond_distributions")
        .update({ is_distributed: true, updated_at: new Date().toISOString() })
        .eq("id", distId);
      toast.success("전원 수령 완료 처리됨");
      fetchData();
    }
  };

  const toggleDistributed = async () => {
    if (!dist || !isAdmin) return;
    const { error } = await supabase
      .from("diamond_distributions")
      .update({ is_distributed: !dist.is_distributed, updated_at: new Date().toISOString() })
      .eq("id", distId);
    if (error) toast.error("실패");
    else fetchData();
  };

  if (loading) return <div className="text-center py-10 text-muted-foreground">로딩 중...</div>;
  if (!dist) return <div className="text-center py-10 text-muted-foreground">찾을 수 없습니다.</div>;

  const receivedCount = rows.filter((r) => r.is_received).length;

  return (
    <div className="space-y-6">
      <Link href="/lottery?tab=diamond" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" />
        분배 목록
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={dist.is_distributed ? "default" : "outline"}>
              {dist.is_distributed ? "분배완료" : "미분배"}
            </Badge>
            <AdminGuard>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleDistributed}>
                {dist.is_distributed ? "미분배로 변경" : "분배완료로 변경"}
              </Button>
            </AdminGuard>
          </div>
          <CardTitle>{dist.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {format(new Date(dist.created_at), "yyyy년 MM월 dd일 (EEE)", { locale: ko })}
          </p>
        </CardHeader>
      </Card>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-xl font-bold">{dist.total_amount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">총 다이아</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-xl font-bold text-blue-500">{dist.per_person.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">1인당</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-xl font-bold text-green-500">{receivedCount}/{dist.recipient_count}</div>
            <div className="text-xs text-muted-foreground">수령완료</div>
          </CardContent>
        </Card>
      </div>

      {dist.note && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">{dist.note}</CardContent>
        </Card>
      )}

      {/* 수령자 목록 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">수령자 목록</CardTitle>
          <AdminGuard>
            <Button variant="outline" size="sm" onClick={markAllReceived}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              전원 완료
            </Button>
          </AdminGuard>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>닉네임</TableHead>
              <TableHead className="w-24 text-center">수령</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.profile?.nickname ?? "-"}</TableCell>
                <TableCell className="text-center">
                  <button
                    onClick={() => toggleReceived(row)}
                    disabled={!isAdmin}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      isAdmin ? "cursor-pointer hover:opacity-80" : "cursor-default"
                    } ${row.is_received ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    {row.is_received
                      ? <><CheckCircle2 className="h-3 w-3" />수령</>
                      : <><Circle className="h-3 w-3" />미수령</>}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
