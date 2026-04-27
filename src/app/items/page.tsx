"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { ItemRegistry, ItemCategory, BossRegistry, ContentType, CharacterClassDef, DistributionAsset, ContentScoringRule } from "@/types";
import { ITEM_GRADES, ITEM_GRADE_COLORS, CONTENT_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Search, Package, Skull, Tag, KeyRound, Lock, Swords, Coins, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const GUILD_ID = "00000000-0000-0000-0000-000000000001";

export default function ManagementPage() {
  const [tab, setTab] = useState("items");
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/login");
    }
  }, [loading, isAdmin, router]);

  if (loading || !isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Lock className="mx-auto h-10 w-10 mb-2 opacity-50" />
          <p>운영진 전용 페이지입니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">관리</h1>
        <p className="text-muted-foreground">아이템 가치 및 보스명 등록 (오타 방지)</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v ?? "items"))}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="items"><Package className="h-4 w-4 mr-1" />아이템</TabsTrigger>
          <TabsTrigger value="categories"><Tag className="h-4 w-4 mr-1" />카테고리</TabsTrigger>
          <TabsTrigger value="bosses"><Skull className="h-4 w-4 mr-1" />보스</TabsTrigger>
          <TabsTrigger value="classes"><Swords className="h-4 w-4 mr-1" />직업</TabsTrigger>
          <TabsTrigger value="assets"><Coins className="h-4 w-4 mr-1" />자산</TabsTrigger>
          <TabsTrigger value="scoring"><Calculator className="h-4 w-4 mr-1" />점수규칙</TabsTrigger>
          <TabsTrigger value="account"><KeyRound className="h-4 w-4 mr-1" />계정</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "items" ? <ItemsTab />
        : tab === "categories" ? <CategoriesTab />
        : tab === "bosses" ? <BossesTab />
        : tab === "classes" ? <ClassesTab />
        : tab === "assets" ? <AssetsTab />
        : tab === "scoring" ? <ScoringRulesTab />
        : <AccountTab />}
    </div>
  );
}

// ==================== Items Tab ====================
function ItemsTab() {
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<ItemRegistry[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRegistry | null>(null);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("item_registry")
      .select("*")
      .eq("is_active", true)
      .order("gold_value", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [supabase]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("item_categories")
      .select("*")
      .eq("guild_id", GUILD_ID)
      .order("sort_order");
    setCategories(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchItems(); fetchCategories(); }, [fetchItems, fetchCategories]);

  const filtered = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || item.category_id === filterCat ||
      (filterCat === "none" && !item.category_id);
    return matchSearch && matchCat;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 아이템을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("item_registry").update({ is_active: false }).eq("id", id);
    if (error) toast.error("삭제 실패");
    else { toast.success("삭제됨"); fetchItems(); }
  };

  const getCatName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "-";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="아이템 검색..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onValueChange={(v) => setFilterCat(v ?? "all")}>
          <SelectTrigger className="w-36">
            <SelectValue>{filterCat === "all" ? "전체 카테고리" : filterCat === "none" ? "미분류" : getCatName(filterCat)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="none">미분류</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <AdminGuard>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingItem(null); }}>
            <DialogTrigger>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? "아이템 수정" : "아이템 추가"}</DialogTitle>
              </DialogHeader>
              <ItemForm
                item={editingItem}
                categories={categories}
                onSaved={() => { setDialogOpen(false); setEditingItem(null); fetchItems(); }}
              />
            </DialogContent>
          </Dialog>
        </AdminGuard>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">로딩 중...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Package className="mx-auto h-10 w-10 mb-2 opacity-50" /><p>등록된 아이템이 없습니다.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>아이템명</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>등급</TableHead>
                <TableHead className="text-right">가치 (다이아)</TableHead>
                {isAdmin && <TableHead className="w-20">관리</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{getCatName(item.category_id)}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.grade ? (
                      <Badge className={`${ITEM_GRADE_COLORS[item.grade] ?? "bg-gray-400 text-white"} text-xs`}>
                        {item.grade}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.gold_value > 0 ? item.gold_value.toLocaleString() : "-"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(item.id, item.name)}>
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

export function ItemForm({
  item,
  categories,
  initialName,
  onSaved,
}: {
  item: ItemRegistry | null;
  categories: ItemCategory[];
  initialName?: string;
  onSaved: (saved: ItemRegistry) => void;
}) {
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState(item?.name ?? initialName ?? "");
  const [grade, setGrade] = useState(item?.grade ?? "");
  const [goldValue, setGoldValue] = useState(item?.gold_value?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("아이템명을 입력하세요"); return; }
    setSaving(true);
    const data = {
      name: name.trim(),
      grade: grade || null,
      gold_value: parseInt(goldValue) || 0,
      category_id: categoryId || null,
      guild_id: GUILD_ID,
    };
    if (item) {
      const { data: updated, error } = await supabase
        .from("item_registry")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .select()
        .single();
      if (error) toast.error("수정 실패");
      else { toast.success("수정됨"); onSaved(updated); }
    } else {
      const { data: inserted, error } = await supabase
        .from("item_registry")
        .insert(data)
        .select()
        .single();
      if (error) toast.error("추가 실패: " + error.message);
      else { toast.success("추가됨"); onSaved(inserted); }
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>아이템명 *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>카테고리</Label>
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
          <SelectTrigger>
            <SelectValue>{categoryId ? (categories.find(c => c.id === categoryId)?.name ?? "선택") : "선택"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>등급</Label>
        <Select value={grade} onValueChange={(v) => setGrade(v ?? "")}>
          <SelectTrigger><SelectValue>{grade || "선택"}</SelectValue></SelectTrigger>
          <SelectContent>
            {ITEM_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>가치 (다이아)</Label>
        <Input type="number" value={goldValue} onChange={(e) => setGoldValue(e.target.value)} placeholder="0" />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "저장 중..." : item ? "수정" : "추가"}
      </Button>
    </form>
  );
}

// ==================== Categories Tab ====================
function CategoriesTab() {
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ItemCategory | null>(null);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("item_categories")
      .select("*")
      .eq("guild_id", GUILD_ID)
      .order("sort_order");
    setCategories(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까? 아이템 카테고리는 미분류로 변경됩니다.`)) return;
    const { error } = await supabase.from("item_categories").delete().eq("id", id);
    if (error) toast.error("삭제 실패");
    else { toast.success("삭제됨"); fetchCategories(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AdminGuard>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingCat(null); }}>
            <DialogTrigger>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCat ? "카테고리 수정" : "카테고리 추가"}</DialogTitle>
              </DialogHeader>
              <CategoryForm
                category={editingCat}
                onSaved={() => { setDialogOpen(false); setEditingCat(null); fetchCategories(); }}
              />
            </DialogContent>
          </Dialog>
        </AdminGuard>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">로딩 중...</CardContent></Card>
      ) : categories.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Tag className="mx-auto h-10 w-10 mb-2 opacity-50" /><p>등록된 카테고리가 없습니다.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>카테고리명</TableHead>
                <TableHead>순서</TableHead>
                {isAdmin && <TableHead className="w-20">관리</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.sort_order}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditingCat(c); setDialogOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(c.id, c.name)}>
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

function CategoryForm({ category, onSaved }: { category: ItemCategory | null; onSaved: () => void }) {
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState(category?.name ?? "");
  const [sortOrder, setSortOrder] = useState(category?.sort_order?.toString() ?? "0");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("카테고리명을 입력하세요"); return; }
    setSaving(true);
    const data = { name: name.trim(), sort_order: parseInt(sortOrder) || 0, guild_id: GUILD_ID };
    if (category) {
      const { error } = await supabase.from("item_categories").update(data).eq("id", category.id);
      if (error) toast.error("수정 실패"); else toast.success("수정됨");
    } else {
      const { error } = await supabase.from("item_categories").insert(data);
      if (error) toast.error("추가 실패: " + error.message); else toast.success("추가됨");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>카테고리명 *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 제작재료" required />
      </div>
      <div className="space-y-2">
        <Label>순서 (낮을수록 앞)</Label>
        <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "저장 중..." : category ? "수정" : "추가"}
      </Button>
    </form>
  );
}

// ==================== Bosses Tab ====================
function BossesTab() {
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();
  const [bosses, setBosses] = useState<BossRegistry[]>([]);
  const [search, setSearch] = useState("");
  const [contentFilter, setContentFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBoss, setEditingBoss] = useState<BossRegistry | null>(null);

  const fetchBosses = useCallback(async () => {
    const { data } = await supabase
      .from("boss_registry").select("*").eq("is_active", true)
      .order("content_type").order("name");
    setBosses(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchBosses(); }, [fetchBosses]);

  const filtered = bosses.filter((b) => {
    if (!b.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (contentFilter !== "all" && b.content_type !== contentFilter) return false;
    return true;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 보스를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("boss_registry").update({ is_active: false }).eq("id", id);
    if (error) toast.error("삭제 실패");
    else { toast.success("삭제됨"); fetchBosses(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="보스 검색..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={contentFilter} onValueChange={(v) => setContentFilter(v ?? "all")}>
          <SelectTrigger className="w-36">
            <SelectValue>
              {contentFilter === "all"
                ? "전체 컨텐츠"
                : CONTENT_TYPE_LABELS[contentFilter as ContentType] ?? contentFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 컨텐츠</SelectItem>
            <SelectItem value="guild_dungeon">{CONTENT_TYPE_LABELS.guild_dungeon}</SelectItem>
            <SelectItem value="guild_war">{CONTENT_TYPE_LABELS.guild_war}</SelectItem>
            <SelectItem value="crusade">{CONTENT_TYPE_LABELS.crusade}</SelectItem>
            <SelectItem value="boss_raid">{CONTENT_TYPE_LABELS.boss_raid}</SelectItem>
            <SelectItem value="ice_dungeon">{CONTENT_TYPE_LABELS.ice_dungeon}</SelectItem>
            <SelectItem value="faction_war">{CONTENT_TYPE_LABELS.faction_war}</SelectItem>
          </SelectContent>
        </Select>
        <AdminGuard>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingBoss(null); }}>
            <DialogTrigger>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBoss ? "보스 수정" : "보스 추가"}</DialogTitle>
              </DialogHeader>
              <BossForm boss={editingBoss} onSaved={() => { setDialogOpen(false); setEditingBoss(null); fetchBosses(); }} />
            </DialogContent>
          </Dialog>
        </AdminGuard>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">로딩 중...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Skull className="mx-auto h-10 w-10 mb-2 opacity-50" /><p>등록된 보스가 없습니다.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>보스명</TableHead>
                <TableHead>컨텐츠</TableHead>
                {isAdmin && <TableHead className="w-20">관리</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>
                    {b.content_type ? (
                      <Badge variant="outline">{CONTENT_TYPE_LABELS[b.content_type as ContentType] ?? b.content_type}</Badge>
                    ) : "-"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setEditingBoss(b); setDialogOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(b.id, b.name)}>
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

function BossForm({ boss, onSaved }: { boss: BossRegistry | null; onSaved: () => void }) {
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState(boss?.name ?? "");
  const [contentType, setContentType] = useState(boss?.content_type ?? "");
  const [saving, setSaving] = useState(false);

  const contentTypes: ContentType[] = ["guild_dungeon", "guild_war", "crusade", "boss_raid", "ice_dungeon", "faction_war"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("보스명을 입력하세요"); return; }
    setSaving(true);
    const data = { name: name.trim(), content_type: contentType || null, guild_id: GUILD_ID };
    if (boss) {
      const { error } = await supabase.from("boss_registry")
        .update({ ...data, updated_at: new Date().toISOString() }).eq("id", boss.id);
      if (error) toast.error("수정 실패"); else toast.success("수정됨");
    } else {
      const { error } = await supabase.from("boss_registry").insert(data);
      if (error) toast.error("추가 실패: " + error.message); else toast.success("추가됨");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>보스명 *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>컨텐츠 타입</Label>
        <Select value={contentType} onValueChange={(v) => setContentType(v ?? "")}>
          <SelectTrigger>
            <SelectValue>{contentType ? CONTENT_TYPE_LABELS[contentType as ContentType] : "선택"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {contentTypes.map((ct) => <SelectItem key={ct} value={ct}>{CONTENT_TYPE_LABELS[ct]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "저장 중..." : boss ? "수정" : "추가"}
      </Button>
    </form>
  );
}

// ==================== Classes Tab ====================
function ClassesTab() {
  const [supabase] = useState(() => createClient());
  const [classes, setClasses] = useState<CharacterClassDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CharacterClassDef | null>(null);

  const fetchClasses = useCallback(async () => {
    const { data } = await supabase
      .from("character_classes")
      .select("*")
      .eq("guild_id", GUILD_ID)
      .order("sort_order");
    setClasses(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`"${label}" 직업을 삭제하시겠습니까?\n해당 직업의 길드원은 직업이 비워집니다.`)) return;

    // First, look up code, then null out profiles
    const target = classes.find((c) => c.id === id);
    if (target) {
      await supabase
        .from("profiles")
        .update({ character_class: null })
        .eq("character_class", target.code);
    }

    const { error } = await supabase.from("character_classes").delete().eq("id", id);
    if (error) toast.error("삭제 실패: " + error.message);
    else { toast.success("삭제됨 (길드원 직업 비워짐)"); fetchClasses(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />추가</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "직업 수정" : "직업 추가"}</DialogTitle>
            </DialogHeader>
            <ClassForm
              cls={editing}
              onSaved={() => { setDialogOpen(false); setEditing(null); fetchClasses(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">로딩 중...</CardContent></Card>
      ) : classes.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">등록된 직업이 없습니다.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">순서</TableHead>
                <TableHead>이름</TableHead>
                <TableHead className="w-24">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.sort_order}</TableCell>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditing(c); setDialogOpen(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(c.id, c.label)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function ClassForm({ cls, onSaved }: { cls: CharacterClassDef | null; onSaved: () => void }) {
  const [supabase] = useState(() => createClient());
  const [label, setLabel] = useState(cls?.label ?? "");
  const [sortOrder, setSortOrder] = useState(cls?.sort_order?.toString() ?? "0");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    setSaving(true);
    if (cls) {
      const { error } = await supabase
        .from("character_classes")
        .update({
          label: label.trim(),
          sort_order: parseInt(sortOrder) || 0,
        })
        .eq("id", cls.id);
      if (error) toast.error("수정 실패: " + error.message);
      else toast.success("수정됨");
    } else {
      const code = `cls_${crypto.randomUUID().slice(0, 8)}`;
      const { error } = await supabase.from("character_classes").insert({
        code,
        label: label.trim(),
        sort_order: parseInt(sortOrder) || 0,
        guild_id: GUILD_ID,
      });
      if (error) toast.error("추가 실패: " + error.message);
      else toast.success("추가됨");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>이름 *</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="활, 힐러, ..." required />
      </div>
      <div className="space-y-2">
        <Label>정렬 순서</Label>
        <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "저장 중..." : cls ? "수정" : "추가"}
      </Button>
    </form>
  );
}

// ==================== Assets Tab ====================
function AssetsTab() {
  const [supabase] = useState(() => createClient());
  const [assets, setAssets] = useState<DistributionAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DistributionAsset | null>(null);

  const fetchAssets = useCallback(async () => {
    const { data } = await supabase
      .from("distribution_assets")
      .select("*")
      .eq("guild_id", GUILD_ID)
      .order("sort_order");
    setAssets(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 자산을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("distribution_assets").delete().eq("id", id);
    if (error) toast.error("삭제 실패: " + error.message);
    else { toast.success("삭제됨"); fetchAssets(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />추가</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "자산 수정" : "자산 추가"}</DialogTitle>
            </DialogHeader>
            <AssetForm
              asset={editing}
              onSaved={() => { setDialogOpen(false); setEditing(null); fetchAssets(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">로딩 중...</CardContent></Card>
      ) : assets.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">등록된 자산이 없습니다.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">순서</TableHead>
                <TableHead>이름</TableHead>
                <TableHead className="w-24">단위</TableHead>
                <TableHead className="w-20">상태</TableHead>
                <TableHead className="w-24">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id} className={!a.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{a.sort_order}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.unit ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={a.is_active ? "default" : "outline"}>
                      {a.is_active ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditing(a); setDialogOpen(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(a.id, a.name)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function AssetForm({ asset, onSaved }: { asset: DistributionAsset | null; onSaved: () => void }) {
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState(asset?.name ?? "");
  const [unit, setUnit] = useState(asset?.unit ?? "");
  const [sortOrder, setSortOrder] = useState(asset?.sort_order?.toString() ?? "0");
  const [isActive, setIsActive] = useState(asset?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("이름을 입력하세요"); return; }
    setSaving(true);
    const data = {
      name: name.trim(),
      unit: unit.trim() || null,
      sort_order: parseInt(sortOrder) || 0,
      is_active: isActive,
      guild_id: GUILD_ID,
    };
    if (asset) {
      const { error } = await supabase.from("distribution_assets").update(data).eq("id", asset.id);
      if (error) toast.error("수정 실패: " + error.message);
      else toast.success("수정됨");
    } else {
      const { error } = await supabase.from("distribution_assets").insert(data);
      if (error) toast.error("추가 실패: " + error.message);
      else toast.success("추가됨");
    }
    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>이름 *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="다이아, 길드주화..." required />
      </div>
      <div className="space-y-2">
        <Label>단위 (표시용)</Label>
        <Input value={unit} onChange={(e) => setUnit(e.target.value)}
          placeholder="다이아, 주화, 개..." />
      </div>
      <div className="space-y-2">
        <Label>정렬 순서</Label>
        <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
        활성 (분배에서 선택 가능)
      </label>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "저장 중..." : asset ? "수정" : "추가"}
      </Button>
    </form>
  );
}

// ==================== Scoring Rules Tab ====================
const SCORING_CONTENT_TYPES: ContentType[] = [
  "guild_dungeon", "guild_war", "crusade", "boss_raid", "ice_dungeon", "faction_war",
];

function ScoringRulesTab() {
  const [supabase] = useState(() => createClient());
  const [rules, setRules] = useState<Map<string, ContentScoringRule>>(new Map());
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    const { data } = await supabase
      .from("content_scoring_rules")
      .select("*")
      .eq("guild_id", GUILD_ID);
    const map = new Map<string, ContentScoringRule>();
    (data ?? []).forEach((r: ContentScoringRule) => map.set(r.content_type, r));
    setRules(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const updateRule = async (
    contentType: ContentType,
    field: "present_score" | "afk_score" | "absent_score",
    value: number
  ) => {
    setSavingKey(contentType);
    const existing = rules.get(contentType);
    const next = {
      guild_id: GUILD_ID,
      content_type: contentType,
      present_score: existing?.present_score ?? 2,
      afk_score: existing?.afk_score ?? 1,
      absent_score: existing?.absent_score ?? 0,
      [field]: value,
    };
    const { error } = await supabase
      .from("content_scoring_rules")
      .upsert(next, { onConflict: "guild_id,content_type" });
    setSavingKey(null);
    if (error) {
      toast.error("저장 실패: " + error.message);
    } else {
      // Optimistic local update
      const updated = new Map(rules);
      updated.set(contentType, { ...next, updated_at: new Date().toISOString() } as ContentScoringRule);
      setRules(updated);
    }
  };

  if (loading) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">로딩 중...</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            컨텐츠별 출석 점수 규칙. 음수 입력하면 페널티(점수 깎임). 변경 즉시 통계 페이지의 기여도 점수에 반영됩니다.
          </p>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>컨텐츠</TableHead>
              <TableHead className="w-28 text-center text-green-500">참석</TableHead>
              <TableHead className="w-28 text-center text-yellow-500">잠수</TableHead>
              <TableHead className="w-28 text-center text-red-500">불참</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SCORING_CONTENT_TYPES.map((ct) => {
              const r = rules.get(ct);
              const presentVal = r?.present_score ?? 2;
              const afkVal = r?.afk_score ?? 1;
              const absentVal = r?.absent_score ?? 0;
              const isSaving = savingKey === ct;
              return (
                <TableRow key={ct} className={isSaving ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{CONTENT_TYPE_LABELS[ct]}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.5"
                      defaultValue={presentVal}
                      className="h-8 text-center"
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v !== presentVal) updateRule(ct, "present_score", v);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.5"
                      defaultValue={afkVal}
                      className="h-8 text-center"
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v !== afkVal) updateRule(ct, "afk_score", v);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.5"
                      defaultValue={absentVal}
                      className="h-8 text-center"
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v !== absentVal) updateRule(ct, "absent_score", v);
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ==================== Account Tab ====================
function AccountTab() {
  const [supabase] = useState(() => createClient());
  const { user } = useAuth();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) {
      toast.error("변경 실패: " + error.message);
    } else {
      toast.success("비밀번호가 변경되었습니다.");
      setNewPw("");
      setConfirmPw("");
    }
  };

  return (
    <Card>
      <CardContent className="py-6 max-w-md mx-auto space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">현재 운영진 계정</Label>
          <p className="text-sm font-medium mt-1">{user?.email ?? "-"}</p>
        </div>
        <form onSubmit={handleChangePw} className="space-y-3">
          <div className="space-y-2">
            <Label>새 비밀번호 *</Label>
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="6자 이상"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label>새 비밀번호 확인 *</Label>
            <Input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "변경 중..." : "비밀번호 변경"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
