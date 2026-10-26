import type { Question } from '../game/types';

/**
 * Question bank. Each answer is a percentage (0–100).
 * Add your own here — the game picks up to ROUNDS of them at random each game.
 */
export const QUESTIONS: Question[] = [
  { id: 'q1', text: 'What percentage of people have ridden a motorcycle?', answer: 25 },
  { id: 'q2', text: "What percentage of Earth's surface is covered by water?", answer: 71 },
  { id: 'q3', text: "What percentage of Earth's atmosphere is nitrogen?", answer: 78 },
  { id: 'q4', text: "What percentage of Earth's atmosphere is oxygen?", answer: 21 },
  { id: 'q5', text: "What percentage of Earth's water is fresh water?", answer: 3 },
  { id: 'q6', text: 'Roughly what percentage of an adult human body is water?', answer: 60 },
];
