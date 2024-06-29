import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { DiscordUser } from "./discordUser.js";

@Entity('support_request')
export class SupportRequest  {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => DiscordUser, { eager: true, nullable: false })
  user!: DiscordUser;

  @Column({ type: 'varchar', length: 20, nullable: false })
  guildId: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  channelId!: string;

  @Column({ type: 'text', nullable: false })
  message!: string;
}