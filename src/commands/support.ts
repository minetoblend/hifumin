import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction } from 'discord.js';
import { db } from '../db.js';
import { SupportRequest } from '../entities/report.js';
import { DiscordUserService } from '../services/discordUserService.js';

export class SupportCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('support')
				.setDescription('Open a support ticket')
				.addStringOption((option) => option.setName('message').setDescription('The message to send to support').setRequired(true))
		);
	}

	override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const message = interaction.options.getString('message')!;

    const user = await DiscordUserService.findOrCreate(interaction.user);

    if(!interaction.guildId || !interaction.channelId) {
      await interaction.reply('This command is only available in a guild');
      return;
    }

    await db.getRepository(SupportRequest).insert({
      user,
      guildId: interaction.guildId!,
      channelId: interaction.channelId!,
      message,
    })

    await interaction.reply('Support ticket created');
  }
}
