import { EntityType } from 'src/domain/types/dictionary.types';

export interface VocabBm25Result {
  termId: string;
  entityType: EntityType;
  canonical: string;
  score: number;
}
