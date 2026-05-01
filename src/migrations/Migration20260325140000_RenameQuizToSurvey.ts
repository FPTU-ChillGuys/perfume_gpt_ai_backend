import { Migration } from '@mikro-orm/migrations';

export class Migration20260325140000_RenameQuizToSurvey extends Migration {
  override async up(): Promise<void> {
    // This migration is now a no-op because preceding migrations have been
    // updated to use the "survey_" prefix directly.
  }

  override async down(): Promise<void> {
    // This migration is now a no-op because preceding migrations have been
    // updated to use the "survey_" prefix directly.
  }
}
