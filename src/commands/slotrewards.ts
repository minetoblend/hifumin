import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { specialCombos } from './gamble.js';

export class SlotrewardsCommand extends Command {
	registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('slotrewards').setDescription('Shows the possible rewards for the slot machine')
		);
	}

	async chatInputRun(interaction: ChatInputCommandInteraction) {
		const messge = Object.entries(specialCombos)
      .sort(([, amountA], [, amountB]) => amountA - amountB )
			.map(([combo, amount]) => {
        const formattedCombo = combo.padStart(3, '   ');

				return `${formattedCombo}: ${amount}x`;
			})
			.join('\n');

		await interaction.reply({
			embeds: [new EmbedBuilder().setTitle('Slot Machine Rewards').setDescription(messge)]
		});
	}
}
