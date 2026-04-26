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
  UsersRound,
  Package,
  Megaphone,
} from "lucide-react";
import Link from "next/link";

const quickLinks = [
  {
    href: "/members",
    label: "길드원 관리",
    description: "길드원 등록, 수정, 각성 여부",
    icon: Users,
    color: "text-blue-500",
    adminOnly: false,
  },
  {
    href: "/events",
    label: "참석 관리",
    description: "컨텐츠별 참석 체크 및 관리",
    icon: Calendar,
    color: "text-green-500",
    adminOnly: false,
  },
  {
    href: "/lottery",
    label: "분배",
    description: "아이템 분배 및 다이아 분배",
    icon: Ticket,
    color: "text-purple-500",
    adminOnly: false,
  },
  {
    href: "/party",
    label: "파티 편성",
    description: "역할·성장도 기반 자동 파티 구성",
    icon: UsersRound,
    color: "text-cyan-500",
    adminOnly: false,
  },
  {
    href: "/items",
    label: "관리",
    description: "아이템 가치 및 보스 이름 등록",
    icon: Package,
    color: "text-yellow-500",
    adminOnly: true,
  },
  {
    href: "/notices",
    label: "공지사항",
    description: "운영진 공지 작성 및 열람",
    icon: Megaphone,
    color: "text-pink-500",
    adminOnly: false,
  },
  {
    href: "/stats",
    label: "통계",
    description: "기여도 순위 및 참석률 차트",
    icon: BarChart3,
    color: "text-orange-500",
    adminOnly: false,
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

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {quickLinks.filter((item) => !item.adminOnly || isAdmin).map((item) => {
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
