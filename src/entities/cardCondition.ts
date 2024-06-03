import {Column, Entity, JoinColumn, ManyToOne, PrimaryColumn} from "typeorm";

@Entity('card_condition')
export class CardCondition {
    @PrimaryColumn('varchar', {length: 20})
    id!: string
    @Column('float')
    multiplier!: number;

    @Column('float', {default: 0})
    upgradeChance!: number;

    @Column('int', {default: 0})
    upgradePrice!: number;

    @ManyToOne(() => CardCondition, {nullable: true})
    @JoinColumn({name: 'next_upgrade'})
    nextUpgrade!: CardCondition | null;

    @ManyToOne(() => CardCondition, {nullable: true})
    @JoinColumn({name: 'previous_upgrade'})
    previousUpgrade!: CardCondition | null;
}