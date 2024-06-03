import {ApplicationCommandRegistry, Command} from "@sapphire/framework";
import {ChatInputCommandInteraction, EmbedBuilder} from "discord.js";
import {db} from "../db.js";
import {WishlistEntry} from "../entities/wishlistEntry.js";

export class Wishlisted extends Command{
    registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder.setName('wishlisted')
                .setDescription('Who has wishlisted this mapper')
                .addStringOption(option =>
                    option.setName('mapper')
                        .setDescription('The card to check')
                        .setRequired(true)
                )
        );
    }
    async chatInputRun(interaction: ChatInputCommandInteraction) {
        const result = await db.getRepository(WishlistEntry)
            .createQueryBuilder('wishlistEntry')
            .innerJoinAndSelect('wishlistEntry.mapper', 'mapper')
            .innerJoinAndSelect('wishlistEntry.user', 'user')
            .where('LOWER(mapper.username) = :mapperName', {mapperName: interaction.options.getString('mapper')!.toLowerCase()})
            .getMany()

        if (result.length === 0) {
            await interaction.reply('No one has wishlisted this mapper')
            return;
        }

        const users = result.map(entry => entry.user.username)
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Wishlist for ' + result[0].mapper.username)
                    .setDescription(users.join('\n'))
            ]
        })
    }
}