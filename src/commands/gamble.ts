import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, InteractionResponse } from 'discord.js';
import { db } from '../db.js';
import { ItemService } from '../services/itemService.js';
import { DiscordUserService } from '../services/discordUserService.js';
import { DiscordUser } from '../entities/discordUser.js';
import { EventLogService } from '../services/eventLogService.js';

export class GambleCommand extends Command {
	constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, cooldownDelay: 300_000, cooldownLimit: 1 });
	}

	registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('gamble')
				.setDescription('Gamble your gold')
				.addIntegerOption((option) =>
					option.setName('amount').setDescription('Amount of gold to gamble').setRequired(true).setMinValue(1).setMaxValue(100)
				)
		);
	}

	async chatInputRun(interaction: ChatInputCommandInteraction) {
		// if (interaction.channelId !== '1245322362925223957') {
		// 	await interaction.reply('Gambling is temporarily disabled to make some adjustments.');
		// 	return;
		// }

		const bet = interaction.options.getInteger('amount')!;
		if (bet < 1) {
			interaction.reply('You must gamble at least 1 gold');
			return;
		}

		if (bet > 100) {
			interaction.reply('You cannot gamble more than 100 gold');
			return;
		}

		const user = await DiscordUserService.findOrCreate(interaction.user);

		let msg: InteractionResponse | undefined = undefined;

		if (!user.gamblingWarningShown && interaction.channel) {
			msg = await interaction.reply({
				content:
					"The gambling command has changed. You can get much higher rewards now but the likelyhood of winning is lower.\n Use /slotrewards to see the winning combinations (Press ctrl+r if you don't see the command).",
				components: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder().setCustomId('confirm').setStyle(ButtonStyle.Secondary).setLabel('I understand').setEmoji('✅'),
						new ButtonBuilder().setCustomId('cancel').setStyle(ButtonStyle.Secondary).setLabel('Cancel').setEmoji('❌')
					)
				]
			});

			await db.getRepository(DiscordUser).update(user.id, {
				gamblingWarningShown: true
			});

			try {
				const result = await msg.awaitMessageComponent({
					filter: (interaction) => interaction.user.id === user.id,
					time: 60000,
					componentType: ComponentType.Button
				});

				if (result.customId === 'cancel') {
					await msg.edit({ content: 'You have cancelled the gambling command', components: [] });
					return;
				}
			} catch (e) {
				await msg.delete();
				return;
			}
		}

		const amountGold = await ItemService.getItemCount(user, 'gold');
		if (amountGold < bet) {
			await interaction.reply('You do not have enough gold to gamble that amount');
			return;
		}

		const result = [this.spin(), this.spin(), this.spin()];

		let display = `${animatedEmoji} ${animatedEmoji} ${animatedEmoji}`;

		if (!msg) {
			msg = await interaction.reply(slotMachineTop + display + slotMachineBottom);
		} else {
			await msg.edit({
				content: slotMachineTop + display + slotMachineBottom,
				components: []
			});
		}

		const multiplier = calculateMultiplier(result);

		let winnings = bet * multiplier;

		await db.transaction('SERIALIZABLE', async (tx) => {
			const currentAmount = await ItemService.getItemCount(user, 'gold', tx);
			if (currentAmount < bet) {
				await msg.edit('Race condition detected. You do not have enough gold to gamble that amount');
				return;
			}

			await ItemService.changeItemCount(user, 'gold', winnings - bet, tx);
		});

		EventLogService.logEvent(user, 'gamble', { bet, winnings, roll: [...result].sort((a, b) => a.localeCompare(b)).join(',') });

		for (let i = 0; i < result.length; i++) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			display = display
				.split(' ')
				.map((d, index) => (index === i ? result[i] : d))
				.join(' ');
			await msg.edit(slotMachineTop + display + slotMachineBottom);
		}

		if (multiplier >= 1) {
			await msg.edit(slotMachineTop + display + slotMachineBottomWin + `\n\nYou won \`${winnings}\` gold!`);
		} else {
			await msg.edit(slotMachineTop + display + slotMachineBottom + `\n\nYou lost...`);
			if (multiplier === 0 && result.includes('💀')) {
				try {
					(await msg.fetch()).react('💀');
				} catch (e) {}
			}
		}
	}

	private spin(): string {
		const symbols = symbolsWeighted.map((s) => s.symbol);
		const weights = symbolsWeighted.map((s) => s.weight);
		const sum = weights.reduce((a, b) => a + b, 0);
		const probabilities = weights.map((w) => w / sum);
		return weightedRandom(symbols, probabilities);
	}
}

const animatedEmoji = '<a:slotMachineAnimation:1249081278381162577>'; // replace this with id of emoji from a server the bot is in

const symbolsWeighted = [
	{ symbol: "🍀", weight: 0.25 },
  { symbol: "🍒", weight: 1.0 },
  { symbol: "❤️", weight: 0.9 },
  { symbol: "🍋", weight: 1.0 },
  { symbol: "🍊", weight: 0.8 },
  { symbol: "💀", weight: 1.0 },
  { symbol: "🍉", weight: 0.7 },
  { symbol: "🍇", weight: 0.7 },
  { symbol: "⭐", weight: 0.2 },
  { symbol: "💰", weight: 0.15 },
  { symbol: "💎", weight: 0.1 },
  { symbol: "👑", weight: 0.08 },
];

export const specialCombos: ({
	type: 'symbol',
	symbol: string,
	count: number,
	multiplier: number,
} | {
	type: 'sequence',
	sequence: string,
	multiplier: number,
})[] = [
	{
    type: "symbol",
    symbol: "🍀",
    count: 1,
    multiplier: 2,
  },
  {
    type: "symbol",
    symbol: "🍒",
    count: 2,
    multiplier: 3,
  },
  {
    type: "symbol",
    symbol: "❤️",
    count: 2,
    multiplier: 10,
  },
  {
    type: "symbol",
    symbol: "🍀",
    count: 2,
    multiplier: 15,
  },
  {
    type: "sequence",
    sequence: "🍋🍋🍋",
    multiplier: 20,
  },
  {
    type: "sequence",
    sequence: "🍊🍊🍊",
    multiplier: 20,
  },
  {
    type: "sequence",
    sequence: "🍇🍇🍇",
    multiplier: 25,
  },
  {
    type: "sequence",
    sequence: "❤️❤️❤️",
    multiplier: 50,
  },
  {
    type: "sequence",
    sequence: "🍒🍒🍒",
    multiplier: 35,
  },
  {
    type: "sequence",
    sequence: "🍉🍉🍉",
    multiplier: 50,
  },
  {
    type: "sequence",
    sequence: "💎⭐💎",
    multiplier: 50,
  },
  {
    type: "sequence",
    sequence: "💎💰💎",
    multiplier: 50,
  },
  {
    type: "sequence",
    sequence: "💰👑💰",
    multiplier: 65,
  },
  {
    type: "sequence",
    sequence: "👑💎👑",
    multiplier: 65,
  },
  {
    type: "sequence",
    sequence: "👑⭐👑",
    multiplier: 65,
  },
  {
    type: "sequence",
    sequence: "🍀🍀🍀",
    multiplier: 75,
  },
  {
    type: "sequence",
    sequence: "⭐⭐⭐",
    multiplier: 100,
  },
  {
    type: "sequence",
    sequence: "💰💰💰",
    multiplier: 100,
  },
  {
    type: "sequence",
    sequence: "💎💎💎",
    multiplier: 150,
  },
  {
    type: "sequence",
    sequence: "👑👑👑",
    multiplier: 333,
  },
]

const slotMachineTop = '_ _   \u{200A}        🚨\n🇸\u{E0020}🇱\u{E0020}🇴\u{E0020}🇹\u{E0020}🇸\n\n   \u{200A}\u{200A}  ';
const slotMachineBottom = '\n\n🟦🟦⬛🟦🟦📍';
const slotMachineBottomWin = '\n\n🟦🟦💵🟦🟦📍';

function calculateMultiplier(symbols: string[]) {
  let multiplier = 1;
  let match = false;

  for (const combo of specialCombos) {
    if (combo.type === "symbol") {
      let count = 0;

      for (let symbol of symbols) {
        if (symbol === combo.symbol) count++;
      }

      if (count === combo.count) {
        multiplier *= combo.multiplier;
        match = true    ;
      }
    } else if (combo.type === "sequence" && symbols.join('').includes(combo.sequence)) {
      return combo.multiplier;
    }
  }

  return match ? multiplier : 0;
}

function weightedRandom(items: string[], probabilities: number[]): string {
	const random = Math.random();
	let cumulative = 0;
	for (let i = 0; i < items.length; i++) {
		cumulative += probabilities[i];
		if (random < cumulative) {
			return items[i];
		}
	}
	// if we get here, something went wrong.
	return '';
}
