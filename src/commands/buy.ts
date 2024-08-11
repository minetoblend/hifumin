import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { ShopItem, ShopPrice } from '../entities/shopItem.js';
import { db } from '../db.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ItemService } from '../services/itemService.js';
import { DiscordUserService } from '../services/discordUserService.js';

export class BuyCommand extends Command {
	registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName('buy')
				.setDescription('Buy an item')
				.addStringOption((option) => option.setName('item').setDescription('Item to buy').setRequired(true))
				.addIntegerOption((option) => option.setName('quantity').setDescription('Quantity to buy').setRequired(false));
		});
	}

	async chatInputRun(interaction: ChatInputCommandInteraction) {
		const itemId = interaction.options.getString('item')!;
		const quantity = interaction.options.getInteger('quantity') ?? 1;
		const user = await DiscordUserService.findOrCreate(interaction.user);

		if (quantity <= 0) {
			await interaction.reply({
				content: 'You must buy at least 1 item',
				ephemeral: true
			});
			return;
		}

		const item = await db.getRepository(ShopItem).findOne({
			where: {
				id: itemId
			},
			relations: {
				item: true,
				prices: true,
			}
		});

		if (!item) {
			await interaction.reply({
				content: 'Item not found',
				ephemeral: true
			});
			return;
		}

		function formatPrices(prices: ShopPrice[]) {
			console.log(prices)
			return prices.map(p => `${p.amount * quantity} ${p.itemId}`).join(', ')
	}

		const message = await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle('Purchase ' + item.name)
					.setDescription(`Are you sure you want to buy ${quantity}x \`${item.id}\` for ${formatPrices(item.prices)}?`)
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId('cancel').setEmoji('❌').setStyle(ButtonStyle.Secondary),
					new ButtonBuilder().setCustomId('confirm').setEmoji('✅').setStyle(ButtonStyle.Secondary)
				)
			]
		});

		const response = await message.awaitMessageComponent({
			filter: (it) => it.user.id === interaction.user.id,
			time: 60_000
		});

		if (!response) {
			await message.edit({
				components: []
			});
			return;
		}

		if (response.customId === 'cancel') {
			await message.edit({
				embeds: [new EmbedBuilder().setFooter({ text: 'Purchase Cancelled' }).setColor('Red')],
				components: []
			});
			return;
		}

		if (response.customId === 'confirm') {
			await db.transaction('SERIALIZABLE', async (tx) => {
				for(const price of item.prices) {
					const numItems = await ItemService.getItemCount(user, price.itemId, tx);
					if (numItems < price.amount * quantity) {
						await message.edit({
							embeds: [new EmbedBuilder().setFooter({ text: 'Purchase Cancelled' }).setColor('Red')],
							components: []
						});
						const errorMessage = await response.reply({
							content: `You do not have enough \`${item.id}\``
						});
						setTimeout(async () => {
							try {
								await errorMessage.delete();
							} catch (e) {}
						}, 15000);
						throw Error()
					}
	
					await ItemService.changeItemCount(user, price.itemId, -price.amount * quantity, tx);
				}

				await ItemService.changeItemCount(user, item.item.id, quantity, tx);
				

				await message.edit({
					embeds: [
						new EmbedBuilder().setDescription(`You have bought ${quantity}x \`${item.name}\` for ${formatPrices(item.prices,)}`).setColor('Green')
					],
					components: []
				});
			});
		}
	}
}
