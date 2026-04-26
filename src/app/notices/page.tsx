"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/layout/AdminGuard";
import type { Notice } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Pin,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";

const GUILD_ID = "00000000-0000-0000-0000-000000000001";

export default function NoticesPage() {
  const [supabase] = useState(() => createClient());
  const { isAdmin } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  const fetchNotices = useCallback(async () => {
    const { data } = await supabase
      .from("notices")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setNotices(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 공지를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) toast.error("삭제 실패");
    else {
      toast.success("삭제됨");
      fetchNotices();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">공지사항</h1>
          <p className="text-muted-foreground">길드 운영진 공지</p>
        </div>
        <AdminGuard>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingNotice(null);
            }}
          >
            <DialogTrigger>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                작성
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingNotice ? "공지 수정" : "공지 작성"}
                </DialogTitle>
              </DialogHeader>
              <NoticeForm
                notice={editingNotice}
                onSaved={() => {
                  setDialogOpen(false);
                  setEditingNotice(null);
                  fetchNotices();
                }}
              />
            </DialogContent>
          </Dialog>
        </AdminGuard>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            로딩 중...
          </CardContent>
        </Card>
      ) : notices.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Megaphone className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>공지사항이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <Card
              key={n.id}
              className={n.is_pinned ? "border-amber-500" : ""}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.is_pinned && (
                      <Badge className="bg-amber-500 text-white">
                        <Pin className="h-3 w-3 mr-1" />
                        고정
                      </Badge>
                    )}
                    <CardTitle className="text-base">{n.title}</CardTitle>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingNotice(n);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(n.id, n.title)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(n.created_at), "yyyy.MM.dd HH:mm", {
                    locale: ko,
                  })}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{n.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NoticeForm({
  notice,
  onSaved,
}: {
  notice: Notice | null;
  onSaved: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [title, setTitle] = useState(notice?.title ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  const [isPinned, setIsPinned] = useState(notice?.is_pinned ?? false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력하세요");
      return;
    }
    setSaving(true);

    const data = {
      title: title.trim(),
      content: content.trim(),
      is_pinned: isPinned,
      guild_id: GUILD_ID,
    };

    if (notice) {
      const { error } = await supabase
        .from("notices")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", notice.id);
      if (error) toast.error("수정 실패");
      else toast.success("수정됨");
    } else {
      const { error } = await supabase.from("notices").insert(data);
      if (error) toast.error("작성 실패: " + error.message);
      else toast.success("작성됨");
    }

    setSaving(false);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>제목 *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>내용 *</Label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus:border-primary min-h-[300px] resize-y"
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={isPinned}
          onCheckedChange={(v) => setIsPinned(v === true)}
        />
        <Label>상단 고정</Label>
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "저장 중..." : notice ? "수정" : "작성"}
      </Button>
    </form>
  );
}
