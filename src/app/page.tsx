"use client";

import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Calendar,
  Ticket,
  BarChart3,
  Shield,
} from "lucide-react";
import Link from "next/link";

const quickLinks = [
  {
    href: "/members",
    label: "길드원 관리",
    description: "길드원 등록, 수정, 엑셀 업로드",
    icon: Users,
    color: "text-blue-500",
  },
  {
    href: "/events",
    label: "이벤트 관리",
    description: "컨텐츠별 이벤트 생성 및 참석 체크",
    icon: Calendar,
    color: "text-green-500",
  },
  {
    href: "/lottery",
    label: "뽑기 / 사다리",
    description: "공정한 아이템 분배",
    icon: Ticket,
    color: "text-purple-500",
  },
  {
    href: "/stats",
    label: "참석률 통계",
    description: "컨텐츠별 참석률 차트 및 컷라인",
    icon: BarChart3,
    color: "text-orange-500",
  },
];

export default function Dashboard() {
  const { isAdmin, loading } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            꿀메이트
          </h1>
          <p className="text-muted-foreground">
            나이트크로우 길드 관리
          </p>
        </div>
        {!loading && (
          <Badge
            variant={isAdmin ? "default" : "secondary"}
            className="ml-auto"
          >
            {isAdmin ? "운영진 모드" : "열람 모드"}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition-colors hover:bg-accent/50 cursor-pointer">
                <CardHeader className="pb-2">
                  <Icon className={`h-8 w-8 ${item.color}`} />
                  <CardTitle className="text-base">
                    {item.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {!isAdmin && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-muted-foreground">
            <p>
              현재 열람 모드입니다. 데이터를 수정하려면{" "}
              <Link
                href="/login"
                className="text-primary underline"
              >
                운영진 로그인
              </Link>
              이 필요합니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
