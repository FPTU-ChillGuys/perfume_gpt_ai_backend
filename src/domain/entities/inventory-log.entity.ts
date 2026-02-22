import { Entity, Property } from "@mikro-orm/core";
import { Common } from "./common/common.entities";
import { ApiProperty } from "@nestjs/swagger";

@Entity()
export class InventoryLog extends Common {
  
    @ApiProperty({ description: 'Nội dung log tồn kho' })
    @Property({ type: 'text' })
    inventoryLog!: string;

    constructor(init?: Partial<InventoryLog>) {
        super();
        Object.assign(this, init);
    }
    
}