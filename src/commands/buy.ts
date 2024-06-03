import {ApplicationCommandRegistry, Command} from "@sapphire/framework";
import {ShopItem} from "../entities/shopItem.js";
import {db} from "../db.js";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder} from "discord.js";
import {ItemService} from "../services/itemService.js";
import {DiscordUserService} from "../services/discordUserService.js";

export class BuyCommand extends Command {
    registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) => {
            builder.setName('buy').setDescription('Buy an item')
                .addStringOption((option) =>
                    option.setName('item').setDescription('Item to buy').setRequired(true)
                )
                .addIntegerOption((option) =>
                    option.setName('quantity').setDescription('Quantity to buy').setRequired(false)
                )
        })
    }

    async chatInputRun(interaction: ChatInputCommandInteraction) {
        const itemId = interaction.options.getString('item')!;
        const quantity = interaction.options.getInteger('quantity') ?? 1;
        const user = await DiscordUserService.findOrCreate(interaction.user)

        if (quantity <= 0) {
            await interaction.reply({
                content: 'You must buy at least 1 item',
                ephemeral: true
            })
            return;
        }

        const item = await db.getRepository(ShopItem).findOne({
            where: {
                id: itemId
            },
            relations: {
                item: true
            }
        })

        if (!item) {
            await interaction.reply({
                content: 'Item not found',
                ephemeral: true
            })
            return;
        }

        const totalCost = item.price * quantity;


        const message = await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Purchase ' + item.name)
                    .setDescription(`Are you sure you want to buy ${quantity}x \`${item.id}\` for ${totalCost} gold?`)
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('cancel')
                            .setEmoji('❌')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('confirm')
                            .setEmoji('✅')
                            .setStyle(ButtonStyle.Secondary),
                    )
            ]
        })

        const response = await message.awaitMessageComponent({
            filter: (interaction) => interaction.user.id === interaction.user.id,
            time: 60_000,
        })

        if (!response) {
            await message.edit({
                components: []
            })
            return;
        }

        if (response.customId === 'cancel') {
            await message.edit({
                embeds: [
                    new EmbedBuilder()
                        .setFooter({text: 'Purchase Cancelled'})
                        .setColor('Red')
                ],
                components: []
            })
            return;
        }

        if (response.customId === 'confirm') {

            await db.transaction('SERIALIZABLE', async tx => {
                const gold = await ItemService.getItemCount(user, 'gold', tx)
                if (gold < totalCost) {
                    await message.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setFooter({text: 'Purchase Cancelled'})
                                .setColor('Red')
                        ],
                        components: []
                    })
                    const errorMessage = await interaction.reply({
                        content: 'You do not have enough gold',
                    })
                    setTimeout(async () =>
                            await errorMessage.delete(),
                        15000)
                    return;
                }

                await ItemService.changeItemCount(user, 'gold', -totalCost, tx)
                await ItemService.changeItemCount(user, item.item.id, quantity, tx)

                await message.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`You have bought ${quantity}x \`${item.name}\` for ${totalCost} gold`)
                            .setColor('Green')
                    ],
                    components: []
                })
            })

        }
    }
}