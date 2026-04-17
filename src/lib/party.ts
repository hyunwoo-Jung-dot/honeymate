import type { Profile } from "@/types";

export interface PartyMember {
  profile: Profile;
  role: "healer" | "lancer" | "dealer";
}

export interface Party {
  number: number;
  healer: Profile | null;
  lancer: Profile | null;
  dealers: Profile[];
}

const HEALER_CLASSES = ["healer"];
const LANCER_CLASSES = ["lancer"];

// Auto-compose parties from guild members
export function composeParties(
  members: Profile[],
  partySize: number = 5
): Party[] {
  // Split by role, sorted by growth_score desc
  const healers = members
    .filter((m) =>
      HEALER_CLASSES.includes(m.character_class ?? "")
    )
    .sort((a, b) => b.growth_score - a.growth_score);

  const lancers = members
    .filter((m) =>
      LANCER_CLASSES.includes(m.character_class ?? "")
    )
    .sort((a, b) => b.growth_score - a.growth_score);

  const dealers = members
    .filter(
      (m) =>
        !HEALER_CLASSES.includes(
          m.character_class ?? ""
        ) &&
        !LANCER_CLASSES.includes(m.character_class ?? "")
    )
    .sort((a, b) => b.growth_score - a.growth_score);

  // Number of parties = enough to fit all members
  const numParties = Math.max(
    healers.length,
    lancers.length,
    Math.ceil(members.length / partySize)
  );

  const parties: Party[] = Array.from(
    { length: numParties },
    (_, i) => ({
      number: i + 1,
      healer: null,
      lancer: null,
      dealers: [],
    })
  );

  // Assign healers (1 per party, top first)
  const extraHealers: Profile[] = [];
  healers.forEach((h, i) => {
    if (i < numParties) {
      parties[i].healer = h;
    } else {
      extraHealers.push(h);
    }
  });

  // Assign lancers (1 per party, top first)
  const extraLancers: Profile[] = [];
  lancers.forEach((l, i) => {
    if (i < numParties) {
      parties[i].lancer = l;
    } else {
      extraLancers.push(l);
    }
  });

  // Merge extra healers/lancers into dealer pool
  const allDealers = [
    ...dealers,
    ...extraHealers,
    ...extraLancers,
  ].sort((a, b) => b.growth_score - a.growth_score);

  // Available dealer slots per party = partySize minus filled healer/lancer slots
  const getAvailableSlots = (p: Party) =>
    partySize - (p.healer ? 1 : 0) - (p.lancer ? 1 : 0) - p.dealers.length;

  allDealers.forEach((d) => {
    // Find party with most available slots (prefer parties missing healer/lancer)
    const target = parties.reduce((best, p) =>
      getAvailableSlots(p) > getAvailableSlots(best) ? p : best
    );
    target.dealers.push(d);
  });

  return parties;
}
