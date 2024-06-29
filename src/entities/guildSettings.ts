import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity('guild_settings')
export class GuildSettings {
  @PrimaryColumn('varchar', { name: 'guild_id', length: 32 })
  guildId!: string;

  @Column('varchar', { name: 'channel_id', length: 32, nullable: true })
  channelId!: string | null;

  @Column('int', { name: 'latest_changelog', nullable: true })
  latestChangelog!: number | null;

  @Column('boolean', { name: 'pin_changes', default: false })
  pinChanges!: boolean;

  @Column('boolean', { name: 'posted_settings_hint', default: false })
  postedSettingsHint!: boolean;
}