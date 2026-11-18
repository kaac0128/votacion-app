const BEATS: Record<string, string> = { rock: "scissors", paper: "rock", scissors: "paper" };

// sobrevivientes de una ronda: 2 tipos => gana el que le gana al otro;
// 1 solo tipo o ciclo (los 3 presentes) => todos repiten
export function roundSurvivors(picks: { user_id: string; pick: string }[]): string[] {
  const types = [...new Set(picks.map((p) => p.pick))];
  if (types.length !== 2) return picks.map((p) => p.user_id);
  const [t1, t2] = types;
  const winnerType = BEATS[t1] === t2 ? t1 : t2;
  return picks.filter((p) => p.pick === winnerType).map((p) => p.user_id);
}

// devuelve el id del ganador del desempate si ya terminó, null si no
export async function tiebreakWinnerId(
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  roomId: string
): Promise<string | null> {
  const { rows: rounds } = await query(
    "select id, round, participants from tiebreak_rounds where room_id = $1 order by round",
    [roomId]
  );
  if (rounds.length === 0) return null;
  let survivors: string[] = rounds[0].participants;
  for (const r of rounds) {
    const { rows: picks } = await query("select user_id, pick from tiebreak_picks where round_id = $1", [r.id]);
    if (picks.length < r.participants.length) return null; // ronda en curso
    survivors = roundSurvivors(picks);
    if (survivors.length === 1) return survivors[0];
  }
  return null;
}
