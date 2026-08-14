export type EventCategory =
  | "Quiz"
  | "IT Manager"
  | "Escape Room"
  | "Coding"
  | "Short Film"
  | "Shark Tank"
  | "Prompt Engineering"
  | "Gaming"
  | "Among Us"
  | "Info Gathering";

/** A faction's roster for one event, split into fixed-size teams. */
export interface TeamConfig {
  teamsPerFaction: number;
  /** Fixed team size, or a [min, max] range when leads gave a range (e.g. Static Vision). */
  membersPerTeam: number | [number, number];
}

/** The Grid only: BGMI and PES run simultaneously with separate rosters, so each gets its own team pool under the same event. */
export interface SubEvent {
  key: string;
  label: string;
  teamsPerFaction: number;
  membersPerTeam: number | [number, number];
}

export interface FestEvent {
  slug: string;
  name: string;
  category: EventCategory;
  tagline: string;
  briefing: string[];
  format: string[];
  glow: "magenta" | "cyan" | "yellow";
  /**
   * Team structure for faction-head registration, straight from event leads'
   * filled-in Operative Briefings. `null` means flat individual registration
   * with no team grouping (The Blacktie Protocol only — reported as
   * "1 member/team", i.e. no sub-teams at all). Events with `subEvents` set
   * (The Grid) ignore this field — each sub-event carries its own config.
   */
  teamConfig: TeamConfig | null;
  /** Only set when teamConfig is null: total individual slots per faction. */
  flatSlotsPerFaction?: number;
  /** The Grid only: independent per-game team pools (BGMI, PES). */
  subEvents?: SubEvent[];
  rounds: number;
  pointsTier: { label: string; points: number | null };
}

/** Total slots a faction gets for one event — teams × max team size, or the flat cap, or summed across sub-events. */
export function totalSlotsForEvent(event: FestEvent): number {
  if (event.subEvents) {
    return event.subEvents.reduce((sum, se) => {
      const size = Array.isArray(se.membersPerTeam) ? se.membersPerTeam[1] : se.membersPerTeam;
      return sum + se.teamsPerFaction * size;
    }, 0);
  }
  if (!event.teamConfig) return event.flatSlotsPerFaction ?? 0;
  const size = Array.isArray(event.teamConfig.membersPerTeam)
    ? event.teamConfig.membersPerTeam[1]
    : event.teamConfig.membersPerTeam;
  return event.teamConfig.teamsPerFaction * size;
}

// Total registration slots each faction has across all 10 events.
export const SLOTS_PER_FACTION = 50;

export function posterFor(slug: string): string {
  return `/events/${slug}.png`;
}

export const events: FestEvent[] = [
  {
    slug: "cortex-vortex",
    name: "Cortex Vortex",
    category: "Quiz",
    tagline: "General & tech quiz. Answer fast, think faster.",
    briefing: [
      "Teams mine the network for data — framed as extracting classified intel from a corp mainframe under time pressure. Fast, high-pressure, and ending in a live-stakes finale.",
      "Round 1 ranks every squad online with no elimination. Round 2 is a live buzzer round where wrong answers cost you. Round 3 is a Bet-Debt finale — squads wager Credits on their own confidence before every question.",
    ],
    format: [
      "Round 1: Online assessment, all 8 squads advance (seeding only)",
      "Round 2: Live buzzer round, top 5 squads advance",
      "Round 3: On-stage Bet-Debt finale on 24 Aug",
    ],
    glow: "cyan",
    teamConfig: { teamsPerFaction: 3, membersPerTeam: 2 },
    rounds: 3,
    pointsTier: { label: "Tier 2", points: 75 },
  },
  {
    slug: "blacktie-protocol",
    name: "The Blacktie Protocol",
    category: "IT Manager",
    tagline: "Run the org before it runs you.",
    briefing: [
      "You're handed a company on fire — budgets, deadlines, a team one bad sprint from mutiny. Judged purely on decision quality, not code.",
      "Participants get filtered through a case-MCQ screening, then live crisis-room simulations, down to a handful of finalists for a live boardroom defense on the main stage.",
    ],
    format: [
      "Round 1: Case-MCQ screening, 18 Aug",
      "Round 2: Live case simulation, 22 Aug (top 16 → 8 teams)",
      "Round 3: Final boardroom simulation, Main Stage, 24 Aug",
    ],
    glow: "magenta",
    teamConfig: null,
    flatSlotsPerFaction: 4,
    rounds: 3,
    pointsTier: { label: "Tier 1", points: 100 },
  },
  {
    slug: "room-zero",
    name: "Room Zero",
    category: "Escape Room",
    tagline: "Locked in. Puzzles are the only way out.",
    briefing: [
      "Teams are locked into a corp facility's mainframe room after a security breach and must solve a chain of physical and logical puzzles to escape before systems go into full lockdown.",
      "Each faction fields up to 6 squads of 3, entered team by team through the portal.",
    ],
    format: [
      "Round 1: Physical puzzle heats, 19 Aug",
      "Round 2: Narrowing round, 21 Aug — field cut to top squads",
      "Round 3: Grand Finale, 22 Aug",
    ],
    glow: "yellow",
    teamConfig: { teamsPerFaction: 6, membersPerTeam: 3 },
    rounds: 3,
    pointsTier: { label: "Tier 2", points: 75 },
  },
  {
    slug: "blackout-build",
    name: "Blackout Build",
    category: "Coding",
    tagline: "The grid goes dark. Ship code anyway.",
    briefing: [
      "The city's grid has gone dark — teams patch, race, and rebuild code under blackout-style pressure across two very different coding formats.",
      "No internet access except official docs. No AI code generators. Getting caught with unauthorized resources disqualifies the whole team, not just the round.",
    ],
    format: [
      "Round 1: Code Relay, 17 Aug — sequential handoff between teammates",
      "Round 2: Blind Coding, 18 Aug — no compiler feedback until final submission",
    ],
    glow: "cyan",
    teamConfig: { teamsPerFaction: 3, membersPerTeam: 3 },
    rounds: 2,
    pointsTier: { label: "Tier 1", points: 100 },
  },
  {
    slug: "static-vision",
    name: "Static Vision",
    category: "Short Film",
    tagline: "Frame the future in under five minutes.",
    briefing: [
      "A neon-noir documentation challenge — teams first prove their visual eye with a poster, then bring a short film to life on a theme dropped a week before the deadline.",
      "Strict 3–5 minute runtime including credits. Original score or royalty-free music only.",
    ],
    format: [
      "Round 1: Poster design, all factions advance (30% of score)",
      "Round 2: Short film, screened during the Closing Ceremony, 24 Aug (70% of score)",
    ],
    glow: "magenta",
    teamConfig: { teamsPerFaction: 1, membersPerTeam: [5, 10] },
    rounds: 2,
    pointsTier: { label: "Tier 3", points: 50 },
  },
  {
    slug: "cyberpitch",
    name: "CyberPitch",
    category: "Shark Tank",
    tagline: "Pitch it cold. Sell it colder.",
    briefing: [
      "Teams pitch a startup/product idea to a panel of corp \"investors\" in a high-stakes boardroom. The winning pitch gets flagged for real incubation support post-fest.",
      "5 minutes to pitch live, then 3 minutes of panel Q&A and rebuttal — true Shark Tank format, for the finalists who make it to the main stage.",
    ],
    format: [
      "Round 1: Pitch screening, 18 Aug",
      "Round 2: Panel round, 22 Aug",
      "Round 3: Live pitch finale, Main Stage, 24 Aug",
    ],
    glow: "yellow",
    teamConfig: { teamsPerFaction: 2, membersPerTeam: 2 },
    rounds: 3,
    pointsTier: { label: "Tier 2", points: 75 },
  },
  {
    slug: "ghost-override",
    name: "Ghost Override",
    category: "Prompt Engineering",
    tagline: "Command the machine with nothing but words.",
    briefing: [
      "Teams don't write code — they hijack machine minds, entirely in-theme with the fest's cyberpunk-AI narrative.",
      "Round 1 tests prompt efficiency under constraints. Round 2 hands teams a deliberately broken sandboxed chatbot to re-engineer live.",
    ],
    format: [
      "Round 1: Mindjack Trials, 17 Aug",
      "Round 2: Live application round, 19 Aug",
    ],
    glow: "cyan",
    teamConfig: { teamsPerFaction: 2, membersPerTeam: 3 },
    rounds: 2,
    pointsTier: { label: "Tier 3", points: 50 },
  },
  {
    slug: "the-grid",
    name: "The Grid",
    category: "Gaming",
    tagline: "Enter the arena. Only one faction levels up.",
    briefing: [
      "A neon digital arena where factions battle across BGMI and PES — the two titles run concurrently in the same venue to keep the schedule tight.",
      "Squads must be finalized and declared 48 hours before Round 1 — no last-minute substitutions on match day.",
    ],
    format: [
      "Gaming Block 1, 17 Aug: BGMI Round 1 + PES Games 1 & 2 (concurrent)",
      "Gaming Block 2, 18 Aug: BGMI Round 2 + PES Games 3 & 4 (concurrent)",
    ],
    glow: "magenta",
    teamConfig: null,
    subEvents: [
      { key: "bgmi", label: "BGMI", teamsPerFaction: 1, membersPerTeam: 5 },
      { key: "pes", label: "PES", teamsPerFaction: 1, membersPerTeam: 4 },
    ],
    rounds: 2,
    pointsTier: { label: "Tier 3", points: 50 },
  },
  {
    slug: "sleeper-cell",
    name: "Sleeper Cell",
    category: "Among Us",
    tagline: "Trust no one. Someone in the room is not who they say.",
    briefing: [
      "A live-action social deduction game — an infiltrator is embedded among each faction's own \"Sleeper Cell\" and must complete covert sabotage without being identified.",
      "Each faction fields up to 4 groups of 3, entered team by team through the portal. No rounds — one continuous session, campus-wide.",
    ],
    format: ["Single continuous session, 20 Aug, 2:00 – 4:30 PM — campus-wide, no rounds"],
    glow: "yellow",
    teamConfig: { teamsPerFaction: 4, membersPerTeam: 3 },
    rounds: 1,
    pointsTier: { label: "Tier 3", points: 50 },
  },
  {
    slug: "the-trace",
    name: "The Trace",
    category: "Info Gathering",
    tagline: "A city-wide hunt. Every clue is a decoy until it isn't.",
    briefing: [
      "Factions trace hidden signals and data trails across campus — part scavenger hunt, part puzzle relay, part physical mini-games, escalating to a final decryption challenge.",
      "Bonus-tier event — its exact point value stays hidden until the closing ceremony.",
    ],
    format: [
      "Round 1: Cipher prelim, 19 Aug (32 teams)",
      "Round 2: Campus signal hunt, 21 Aug",
      "Round 3: Final decryption challenge, 22 Aug",
    ],
    glow: "cyan",
    teamConfig: { teamsPerFaction: 3, membersPerTeam: 3 },
    rounds: 3,
    pointsTier: { label: "Bonus", points: null },
  },
];

export interface Faction {
  slug: string;
  name: string;
  heads: [string, string];
  accent: string;
  tagline: string;
  logo: string;
}

export const factions: Faction[] = [
  {
    slug: "neo-ronin",
    name: "Neo Ronin",
    heads: ["Agnel", "Neethu"],
    accent: "#a855f7",
    tagline: "Honor code. Break the meta.",
    logo: "/factions/neo-ronin.png",
  },
  {
    slug: "aetheris",
    name: "Aetheris",
    heads: ["Rasika", "Arjun"],
    accent: "#c4b5fd",
    tagline: "Beyond the system. Above the limits.",
    logo: "/factions/aetheris.png",
  },
  {
    slug: "hyperion",
    name: "Hyperion",
    heads: ["Vandhana", "Rohit Odiyar"],
    accent: "#2dd4bf",
    tagline: "Reach beyond limits. Set new standards.",
    logo: "/factions/hyperion.png",
  },
  {
    slug: "phoenix",
    name: "Phoenix",
    heads: ["Hariharan Rajan", "Rakshitha S"],
    accent: "#f5a623",
    tagline: "Every edition it loses, it comes back louder.",
    logo: "/factions/phoenix.png",
  },
  {
    slug: "maelstrom",
    name: "Maelstrom",
    heads: ["Pavan", "Sangita"],
    accent: "#d4e157",
    tagline: "Chaos isn't random. It's our edge.",
    logo: "/factions/maelstrom.png",
  },
  {
    slug: "renegades",
    name: "Renegades",
    heads: ["Mahendran", "Sinchana"],
    accent: "#ff2b8f",
    tagline: "Not the meta. Make the meta.",
    logo: "/factions/renegades.png",
  },
  {
    slug: "nightwire",
    name: "Nightwire",
    heads: ["Shivam", "Anishma"],
    accent: "#ef4444",
    tagline: "Move in the dark. Show up on top.",
    logo: "/factions/nightwire.png",
  },
  {
    slug: "edgerunners",
    name: "Edgerunners",
    heads: ["Alwin", "Annet"],
    accent: "#f4c430",
    tagline: "First into every event, last to back down.",
    logo: "/factions/edgerunners.png",
  },
];

export const FEST_START = "2026-08-17T09:00:00+05:30";
export const FEST_END = "2026-08-24T20:00:00+05:30";
export const FINALE_DATE = "2026-08-24T09:00:00+05:30";
