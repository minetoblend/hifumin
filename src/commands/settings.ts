import { Subcommand } from '@sapphire/plugin-subcommands';
import { ChatInputCommandInteraction } from 'discord.js';
import { GuildSettings } from '../entities/guildSettings.js';
import { db } from '../db.js';
import { ChangelogCommand } from './changelog.js';

export class SettingsCommand extends Subcommand {
	public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
		super(context, {
			...options,
			name: 'settings',
			subcommands: [
				{
					name: 'setchannel',
					chatInputRun: 'chatInputSetChannel'
				},
				{
					name: 'unsetchannel',
					chatInputRun: 'chatInputUnsetChannel'
				},
        {
          name: 'pinchanges',
          chatInputRun: 'chatInputPinChanges'
        }
			]
		});
	}

	registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('settings')
				.setDescription('Settings')
				.addSubcommand((command) => command.setName('setchannel').setDescription('Set channel for bot commands'))
				.addSubcommand((command) => command.setName('unsetchannel').setDescription('Unset channel for bot commands'))
        .addSubcommand((command) => command.setName('pinchanges').setDescription('Toggle pinning of new change announcements in the bot channel'))
		);
	}

	async chatInputSetChannel(interaction: ChatInputCommandInteraction) {
    const guildId = await this.getGuildId(interaction);
    if (guildId === null) return;

    if(!(await this.ensureAdmin(interaction))) return;

    const response = await interaction.deferReply();

		const settings = (await db.getRepository(GuildSettings).findOneBy({ guildId: interaction.guildId! })) ?? new GuildSettings();
		
    settings.guildId = interaction.guildId!;
    settings.channelId = interaction.channelId!;
    settings.latestChangelog = ChangelogCommand.latestChangelogId;

    await db.getRepository(GuildSettings).save(settings);

    await response.edit(`Channel set to <#${interaction.channelId!}>`);
	}

	async chatInputUnsetChannel(interaction: ChatInputCommandInteraction) {
    const guildId = await this.getGuildId(interaction);
    if (guildId === null) return;
    
    if(!(await this.ensureAdmin(interaction))) return;

    const settings = await db.getRepository(GuildSettings).findOneBy({ guildId: interaction.guildId! });
    if (!settings) {
      await interaction.reply('Channel is not set');
      return;
    }

    settings.channelId = null;
    await db.getRepository(GuildSettings).save(settings);

    await interaction.reply('Channel unset');
  }

  async chatInputPinChanges(interaction: ChatInputCommandInteraction) {
    const guildId = await this.getGuildId(interaction);
    if (guildId === null) return;

    if(!(await this.ensureAdmin(interaction))) return;

    const settings = await db.getRepository(GuildSettings).findOneBy({ guildId: interaction.guildId! });
    if (!settings) {
      await interaction.reply('Channel is not set');
      return;
    }

    settings.pinChanges = !settings.pinChanges;
    await db.getRepository(GuildSettings).save(settings);

    await interaction.reply(`Changes will ${settings.pinChanges ? 'now' : 'no longer'} be pinned`);
  }

private async getGuildId(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply('This command can only be used in a server');
      return null;
    }
    return interaction.guildId;
  }


  private async ensureAdmin(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply('You must be an administrator to use this command');
      return false;
    }
    return true;
  }
  
}
