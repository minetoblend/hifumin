import {Column, Entity, PrimaryColumn} from "typeorm";

@Entity('user_effect')
export class UserEffect {
    @PrimaryColumn('bigint', { unsigned: true })
    userId!: string;

    @PrimaryColumn('varchar', { length: 32 })
    effect!: string;

    @Column('datetime', { nullable: false })
    activeUntil!: Date;
}