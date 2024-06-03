import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity('opt_out')
export class OptOut {
    @PrimaryGeneratedColumn('increment', {type: 'int'})
    id!: number;

    @Column({type: 'varchar', length: 255})
    username!: string;

    @Column({type: 'text', nullable: true})
    reason?: string | null;
}