import { UnitOfWork } from '../repositories/unit-of-work';

export class RecommandationService {
  constructor(private unitOfWork: UnitOfWork) {}
}
