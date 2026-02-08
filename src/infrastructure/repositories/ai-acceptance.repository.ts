import { SqlEntityRepository } from "@mikro-orm/postgresql";
import { AIAcceptance } from "src/domain/entities/ai-acceptance.entities";

export class AIAcceptanceRepository extends SqlEntityRepository<AIAcceptance> {
  
}