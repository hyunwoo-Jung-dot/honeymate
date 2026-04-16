"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, CharacterClass } from "@/types";
import { CLASS_LABELS } from "@/lib/constants";
import { composeParties, type Party } from "@/lib/party";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users, RefreshCw, Shield, Sword } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  healer: "bg-red-500",
  lancer: "bg-blue-500",
  dealer: "bg-yellow-500",
};

export default function PartyPage() {
  const [supabase] = useState(() => createClient());
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [partySize, setPartySize] = useState(5);
  const [parties, setParties] = useState<Party[]>([]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("growth_score", { ascending: false });
    setMembers(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleCompose = () => {
    const result = composeParties(members, partySize);
    setParties(result);
  };

  // Auto-compose on load
  useEffect(() => {
    if (members.length > 0 && parties.length === 0) {
      handleCompose();
    }
  }, [members]);

  const getClassBadge = (cls: string | null) => {
    if (!cls) return null;
    const label =
      CLASS_LABELS[cls as CharacterClass] ?? cls;
    const isHealer = cls === "healer";
    const isLancer = cls === "lancer";
    return (
      <Badge
        variant="outline"
        className={`text-xs ${
          isHealer
            ? "border-red-500 text-red-400"
            : isLancer
              ? "border-blue-500 text-blue-400"
              : "border-yellow-500 text-yellow-400"
        }`}
      >
        {label}
      </Badge>
    );
  };

  const healerCount = members.filter(
    (m) => m.character_class === "healer"
  ).length;
  const lancerCount = members.filter(
    (m) => m.character_class === "lancer"
  ).length;
  const dealerCount = members.length - healerCount - lancerCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            파티 편성
          </h1>
          <p className="text-muted-foreground">
            성장도 기반 자동 파티 구성
          </p>
        </div>
        <Button onClick={handleCompose} size="sm">
          <RefreshCw className="h-4 w-4 mr-1" />
          재편성
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold">
              {members.length}
            </div>
            <div className="text-xs text-muted-foreground">
              전체
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-red-400">
              {healerCount}
            </div>
            <div className="text-xs text-muted-foreground">
              힐러
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {lancerCount}
            </div>
            <div className="text-xs text-muted-foreground">
              창
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {dealerCount}
            </div>
            <div className="text-xs text-muted-foreground">
              딜러
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Label>파티당 인원</Label>
            <Input
              type="number"
              min={3}
              max={10}
              value={partySize}
              onChange={(e) =>
                setPartySize(parseInt(e.target.value) || 5)
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              = {parties.length}파티
            </span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Party Cards */}
      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            로딩 중...
          </CardContent>
        </Card>
      ) : parties.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>길드원 데이터가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parties.map((party) => (
            <Card key={party.number}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sword className="h-4 w-4" />
                  {party.number}파티
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {(party.healer ? 1 : 0) +
                      (party.lancer ? 1 : 0) +
                      party.dealers.length}
                    명
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {/* Healer */}
                {party.healer ? (
                  <div className="flex items-center gap-2 p-1.5 rounded bg-red-500/10">
                    <Badge className="bg-red-500 text-white text-xs w-10 justify-center">
                      힐러
                    </Badge>
                    <span className="text-sm font-medium flex-1">
                      {party.healer.nickname}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {party.healer.growth_score > 0
                        ? party.healer.growth_score.toLocaleString()
                        : "-"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-1.5 rounded bg-red-500/5 opacity-30">
                    <Badge className="bg-red-500 text-white text-xs w-10 justify-center">
                      힐러
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      없음
                    </span>
                  </div>
                )}

                {/* Lancer */}
                {party.lancer ? (
                  <div className="flex items-center gap-2 p-1.5 rounded bg-blue-500/10">
                    <Badge className="bg-blue-500 text-white text-xs w-10 justify-center">
                      창
                    </Badge>
                    <span className="text-sm font-medium flex-1">
                      {party.lancer.nickname}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {party.lancer.growth_score > 0
                        ? party.lancer.growth_score.toLocaleString()
                        : "-"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-1.5 rounded bg-blue-500/5 opacity-30">
                    <Badge className="bg-blue-500 text-white text-xs w-10 justify-center">
                      창
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      없음
                    </span>
                  </div>
                )}

                {/* Dealers */}
                {party.dealers.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 p-1.5 rounded bg-yellow-500/10"
                  >
                    {getClassBadge(d.character_class)}
                    <span className="text-sm font-medium flex-1">
                      {d.nickname}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.growth_score > 0
                        ? d.growth_score.toLocaleString()
                        : "-"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
