export type GamifyAction = "easy" | "good" | "hard" | "quiz-correct";

export const ACTION_POINTS: Record<GamifyAction, number> = {
  easy: 10,
  good: 5,
  hard: 2,
  "quiz-correct": 15,
};

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getYesterdayKey() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

export function getLevel(points: number): "Beginner" | "Learner" | "Master" {
  if (points >= 2000) return "Master";
  if (points >= 500) return "Learner";
  return "Beginner";
}
