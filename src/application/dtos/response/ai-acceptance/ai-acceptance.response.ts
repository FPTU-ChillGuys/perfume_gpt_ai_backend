import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AIAcceptance } from 'src/domain/entities/ai-acceptance.entities';

export class AIAcceptanceResponse {
  @ApiProperty() id: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional({ nullable: true }) responseId?: string | null;
  @ApiPropertyOptional({ nullable: true }) contextType?: string | null;
  @ApiPropertyOptional({ nullable: true }) sourceRefId?: string | null;
  @ApiPropertyOptional({ nullable: true }) productIdsJson?: string | null;
  @ApiPropertyOptional({ nullable: true }) metadataJson?: string | null;
  @ApiPropertyOptional({ nullable: true }) visibleAfterAt?: Date | null;
  @ApiPropertyOptional({ nullable: true }) clickedAt?: Date | null;
  @ApiPropertyOptional() isAccepted?: boolean;
  @ApiProperty({
    description: 'Trạng thái computed: accepted | rejected | pending'
  })
  status: 'accepted' | 'rejected' | 'pending';

  static fromEntity(entity: AIAcceptance): AIAcceptanceResponse | null {
    if (!entity) return null;
    const dto = new AIAcceptanceResponse();
    dto.id = entity.id;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.isActive = entity.isActive;
    dto.responseId = entity.responseId;
    dto.contextType = entity.contextType;
    dto.sourceRefId = entity.sourceRefId;
    dto.productIdsJson = entity.productIdsJson;
    dto.metadataJson = entity.metadataJson;
    dto.visibleAfterAt = entity.visibleAfterAt;
    dto.clickedAt = entity.clickedAt;
    dto.isAccepted = entity.isAccepted;
    dto.status = AIAcceptanceResponse.computeStatus(entity);
    return dto;
  }

  private static computeStatus(entity: AIAcceptance): 'accepted' | 'rejected' | 'pending' {
    if (entity.isAccepted) return 'accepted';
    if (!entity.visibleAfterAt) return 'pending';
    return new Date(entity.visibleAfterAt).getTime() <= Date.now() ? 'rejected' : 'pending';
  }
}
