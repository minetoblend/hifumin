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
		const messge = specialCombos
      .sort((a, b) => a.multiplier - b.multiplier )
			.map((combo) => {

        const formattedCombo = combo.type === 'sequence' 
					? combo.sequence 
					: combo.symbol.repeat(combo.count)

				return `${formattedCombo}: ${combo.multiplier}x`;
			})
			.join('\n');

		await interaction.reply({
			embeds: [new EmbedBuilder().setTitle('Slot Machine Rewards').setDescription(messge)]
		});
	}
}
