export const TOPIC_IDS = ['ai-operations', 'ai-engineering', 'frontend-devops'] as const;

export type TopicId = (typeof TOPIC_IDS)[number];

export const TOPICS: Record<TopicId, string> = {
  'ai-operations': 'AI in Operations',
  'ai-engineering': 'AI Engineering',
  'frontend-devops': 'Frontend & DevOps',
};

export function isTopic(value: string | null | undefined): value is TopicId {
  return TOPIC_IDS.includes(value as TopicId);
}
