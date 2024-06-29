import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity('card_sequence')
export class CardSequence {
  @PrimaryColumn('int')
  id!: number;

  @Column('int', { nullable: false })
  value!: number;
}