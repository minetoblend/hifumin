import {CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {DiscordUser} from "./discordUser.js";
import {Mapper} from "./mapper.js";

@Entity("wishlist_entry")
export class WishlistEntry {
    @PrimaryGeneratedColumn('increment')
    id!: number;

    @ManyToOne(() => DiscordUser)
    @JoinColumn({name: 'user_id'})
    user!: DiscordUser;

    @ManyToOne(() => Mapper)
    @JoinColumn({name: 'mapper_id'})
    mapper!: Mapper;

    @CreateDateColumn()
    createdAt!: Date;
}