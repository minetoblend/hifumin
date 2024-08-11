import {ApplicationCommandRegistry, Command} from "@sapphire/framework";
import {ChatInputCommandInteraction, EmbedBuilder} from "discord.js";
import {db} from "../db.js";
import {ShopItem, ShopPrice} from "../entities/shopItem.js";
import {ItemService} from "../services/itemService.js";
import {DiscordUserService} from "../services/discordUserService.js";

export class ShopCommand extends Command {

    registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) => {
            builder.setName('shop').setDescription('View the shop')
        })
    }

    async chatInputRun(interaction: ChatInputCommandInteraction) {
        const shopItems = await db.getRepository(ShopItem)
            .createQueryBuilder('shop_item')
            .innerJoinAndSelect('shop_item.item', 'item')
            .innerJoinAndSelect('shop_item.prices', 'prices')
            .getMany()

        shopItems.sort((a, b) => a.order - b.order)

        const user = await DiscordUserService.findOrCreate(interaction.user)

        const embed = new EmbedBuilder()
            .setTitle('Shop')
            .addFields([
                {
                    name: 'Current balance',
                    value: `${await ItemService.getItemCount(user, 'gold')} Gold`
                }
            ])
            .setFooter({ text: 'Use `/buy` command to purchase items.' })

        function formatPrices(prices: ShopPrice[]) {
            return prices.map(p => `${p.amount} ${p.itemId}`).join(', ')
        }

        if (shopItems.length > 0)
            embed.setDescription(shopItems
                .map(item => `${item.item.icon} \`${item.id}\` · ${formatPrices(item.prices)}\n        *${item.name}*`)
                .join('\n\n'))
        else
            embed
                .setDescription('There is nothing for sale at the moment.')

        await interaction.reply({
            embeds: [embed]
        })
    }


}