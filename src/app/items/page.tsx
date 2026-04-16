"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { ItemRegistry } from "@/types";
import { ITEM_GRADES } from "@/lib/constants";
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
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
} from "lucide-react";
import { toast } from "sonner";

const GUILD_ID = "00000000-0000-0000-0000-000000000001";

const GRADE_COLORS: Record<string, string> = {
  일반: "bg-gray-500",
  고급: "bg-green-500",
  희귀: "bg-blue-500",
  영웅: "bg-purple-500",
  전설: "bg-orange-500",
};

export default function ItemsPage() {
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<ItemRegistry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] =
    useState<ItemRegistry | null>(null);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("item_registry")
      .select("*")
      .eq("is_active", true)
      .order("gold_value", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (
    id: string,
    name: string
  ) => {
    if (!confirm(`"${name}" 아이템을 삭제하시겠습니까?`))
      return;
    const { error } = await supabase
      .from("item_registry")
      .update({ is_active: false })
      .eq("id", id);
    if (error) toast.error("삭제 실패");
    else {
      toast.success("삭제됨");
      fetchItems();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            아이템 관리
          </h1>
          <p className="text-muted-foreground">
            총 {filtered.length}개
          </p>
        </div>
        <AdminGuard>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingItem(null);
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
                  {editingItem
                    ? "아이템 수정"
                    : "아이템 추가"}
                </DialogTitle>
              </DialogHeader>
              <ItemForm
                item={editingItem}
                onSaved={() => {
                  setDialogOpen(false);
                  setEditingItem(null);
                  fetchItems();
                }}
              />
            </DialogContent>
          </Dialog>
        </AdminGuard>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="아이템 검색..."
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
            <Package className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>등록된 아이템이 없습니다.</p>
            {isAdmin && (
              <p className="text-sm mt-1">
                &quot;추가&quot; 버튼으로 아이템을
                등록하세요.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>아이템명</TableHead>
                <TableHead>등급</TableHead>
                <TableHead className="text-right">
                  가치
                </TableHead>
                {isAdmin && (
                  <TableHead className="w-20">
                    관리
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.name}
                  </TableCell>
                  <TableCell>
                    {item.grade ? (
                      <Badge
                        className={`${GRADE_COLORS[item.grade] ?? "bg-gray-500"} text-white text-xs`}
                      >
                        {item.grade}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.gold_value > 0
                      ? item.gold_value.toLocaleString()
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
                            setEditingItem(item);
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
                            handleDelete(
                              item.id,
                              item.name
                            )
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

function ItemForm({
  item,
  onSaved,
}: {
  item: ItemRegistry | null;
  onSaved: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState(item?.name ?? "");
  const [grade, setGrade] = useState(item?.grade ?? "");
  const [goldValue, setGoldValue] = useState(
    item?.gold_value?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("아이템명을 입력하세요");
      return;
    }
    setSaving(true);

    const data = {
      name: name.trim(),
      grade: grade || null,
      gold_value: parseInt(goldValue) || 0,
      guild_id: GUILD_ID,
    };

    if (item) {
      const { error } = await supabase
        .from("item_registry")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (error) toast.error("수정 실패");
      else toast.success("수정됨");
    } else {
      const { error } = await supabase
        .from("item_registry")
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
        <Label>아이템명 *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 전설 무기"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>등급</Label>
        <Select
          value={grade}
          onValueChange={(v) => setGrade(v ?? "")}
        >
          <SelectTrigger>
            <SelectValue placeholder="선택">
              {grade || "선택"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ITEM_GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>가치 (골드)</Label>
        <Input
          type="number"
          value={goldValue}
          onChange={(e) => setGoldValue(e.target.value)}
          placeholder="0"
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={saving}
      >
        {saving ? "저장 중..." : item ? "수정" : "추가"}
      </Button>
    </form>
  );
}
