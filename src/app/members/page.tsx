"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { Profile, CharacterClass } from "@/types";
import { CLASS_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const GUILD_ID_PLACEHOLDER = "00000000-0000-0000-0000-000000000001";

export default function MembersPage() {
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"nickname" | "class" | "growth">("nickname");
  const [sortDesc, setSortDesc] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] =
    useState<Profile | null>(null);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("nickname");
    setMembers(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filtered = members
    .filter(
      (m) =>
        m.nickname.toLowerCase().includes(search.toLowerCase()) &&
        m.is_active
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "nickname") {
        cmp = a.nickname.localeCompare(b.nickname, "ko");
      } else if (sortBy === "class") {
        cmp = (a.character_class ?? "zzz").localeCompare(
          b.character_class ?? "zzz"
        );
      } else if (sortBy === "growth") {
        cmp = a.growth_score - b.growth_score;
      }
      return sortDesc ? -cmp : cmp;
    });

  const toggleSort = (col: "nickname" | "class" | "growth") => {
    if (sortBy === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(col);
      setSortDesc(col === "growth"); // growth defaults to desc
    }
  };

  const sortIcon = (col: "nickname" | "class" | "growth") => {
    if (sortBy !== col) return " ⇅";
    return sortDesc ? " ↓" : " ↑";
  };

  const handleDelete = async (id: string, nickname: string) => {
    if (!confirm(`${nickname} 길드원을 삭제하시겠습니까?`)) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", id);
    if (error) {
      toast.error("삭제 실패");
    } else {
      toast.success(`${nickname} 삭제됨`);
      fetchMembers();
    }
  };

  const handleExcelUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
      sheet
    );

    const profiles = rows.map((row) => ({
      nickname:
        row["닉네임"] || row["nickname"] || row["이름"] || "",
      server_name: row["서버"] || row["server_name"] || null,
      character_class:
        row["직업"] || row["class"] || row["character_class"] || null,
      growth_score: parseInt(row["성장도"] || row["전투력"] || row["growth_score"] || "0") || 0,
      guild_id: GUILD_ID_PLACEHOLDER,
      is_active: true,
    })).filter((p) => p.nickname);

    if (profiles.length === 0) {
      toast.error("유효한 데이터가 없습니다. 닉네임 열을 확인하세요.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(profiles, { onConflict: "nickname,guild_id", ignoreDuplicates: false });

    if (error) {
      // Fallback: insert one by one
      let success = 0;
      for (const p of profiles) {
        const { error: err } = await supabase
          .from("profiles")
          .insert(p);
        if (!err) success++;
      }
      toast.success(`${success}/${profiles.length}명 업로드됨`);
    } else {
      toast.success(`${profiles.length}명 업로드됨`);
    }

    fetchMembers();
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            길드원 관리
          </h1>
          <p className="text-muted-foreground">
            총 {filtered.length}명
          </p>
        </div>
        <AdminGuard>
          <div className="flex gap-2">
            <label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelUpload}
              />
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" />
                엑셀 업로드
              </Button>
            </label>
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) setEditingMember(null);
              }}
            >
              <DialogTrigger>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  추가
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingMember
                      ? "길드원 수정"
                      : "길드원 추가"}
                  </DialogTitle>
                </DialogHeader>
                <MemberForm
                  member={editingMember}
                  onSaved={() => {
                    setDialogOpen(false);
                    setEditingMember(null);
                    fetchMembers();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </AdminGuard>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="닉네임 검색..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            로딩 중...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>등록된 길드원이 없습니다.</p>
            {isAdmin && (
              <p className="text-sm mt-1">
                상단의 &quot;추가&quot; 또는 &quot;엑셀 업로드&quot;로
                길드원을 등록하세요.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("nickname")}
                >
                  닉네임{sortIcon("nickname")}
                </TableHead>
                <TableHead
                  className="hidden sm:table-cell cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("class")}
                >
                  직업{sortIcon("class")}
                </TableHead>
                <TableHead
                  className="hidden sm:table-cell cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("growth")}
                >
                  성장도{sortIcon("growth")}
                </TableHead>
                {isAdmin && (
                  <TableHead className="w-20">관리</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.nickname}
                    {m.is_awakened && (
                      <Badge className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0">
                        각성
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {m.character_class ? (
                      <Badge variant="outline">
                        {CLASS_LABELS[m.character_class]}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {m.growth_score > 0
                      ? m.growth_score.toLocaleString()
                      : "-"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingMember(m);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            handleDelete(m.id, m.nickname)
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ---- Member Form Component ----
function MemberForm({
  member,
  onSaved,
}: {
  member: Profile | null;
  onSaved: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [nickname, setNickname] = useState(
    member?.nickname ?? ""
  );
  const [charClass, setCharClass] = useState(
    member?.character_class ?? ""
  );
  const [combatPower, setCombatPower] = useState(
    member?.growth_score?.toString() ?? ""
  );
  const [isAwakened, setIsAwakened] = useState(
    member?.is_awakened ?? false
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      toast.error("닉네임을 입력하세요");
      return;
    }
    setSaving(true);

    const data = {
      nickname: nickname.trim(),
      server_name: null,
      character_class: charClass || null,
      growth_score: parseInt(combatPower) || 0,
      is_awakened: isAwakened,
      guild_id: GUILD_ID_PLACEHOLDER,
    };

    if (member) {
      const { error } = await supabase
        .from("profiles")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", member.id);
      if (error) toast.error("수정 실패");
      else toast.success("수정됨");
    } else {
      const { error } = await supabase
        .from("profiles")
        .insert(data);
      if (error) toast.error("추가 실패: " + error.message);
      else toast.success("추가됨");
    }

    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>닉네임 *</Label>
        <Input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="게임 내 닉네임"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>직업</Label>
        <Select value={charClass} onValueChange={(v) => setCharClass(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="선택">
              {charClass ? CLASS_LABELS[charClass as CharacterClass] ?? charClass : "선택"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="archer">활</SelectItem>
            <SelectItem value="healer">힐러</SelectItem>
            <SelectItem value="swordsman">쌍검</SelectItem>
            <SelectItem value="lancer">창</SelectItem>
            <SelectItem value="gunner">화포</SelectItem>
            <SelectItem value="rapier">레이피어</SelectItem>
            <SelectItem value="sword">한손검</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>성장도</Label>
        <Input
          type="number"
          value={combatPower}
          onChange={(e) => setCombatPower(e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={isAwakened}
          onCheckedChange={(v) => setIsAwakened(v === true)}
        />
        <Label>각성 여부</Label>
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving
          ? "저장 중..."
          : member
            ? "수정"
            : "추가"}
      </Button>
    </form>
  );
}
