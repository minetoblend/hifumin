import {Command} from "@sapphire/framework";
import {ChatInputCommandInteraction, EmbedBuilder} from "discord.js";
import {DiscordUserService} from "../services/discordUserService.js";
import '../services/cardRenderer.js'
import {db} from "../db.js";
import {ApplyOptions} from "@sapphire/decorators";
import {InventoryEntry} from "../entities/inventoryEntry.js";
import {PaginatedMessage} from "@sapphire/discord.js-utilities";
import {MoreThan} from "typeorm";

@ApplyOptions<Command.Options>({
    description: 'Show user inventory',
})
export class BurnCommand extends Command {

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder.setName('inventory')
                .setDescription('Show inventory')
        );
    }

    override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const user = await DiscordUserService.findOrCreate(interaction.user)

        const repository = db.getRepository(InventoryEntry)

        const total = await repository.count({
            where: {
                userId: user.id,
                amount: MoreThan(0)
            }
        })

        const message = new PaginatedMessage({
            template: new EmbedBuilder().setColor('#FF0000').setFooter({text: 'Inventory'}),
        })


        for (let i = 0; i <= total; i += 10) {
            message.addAsyncPageBuilder(async builder => {
                const entries = await repository
                    .createQueryBuilder('entry')
                    .select()
                    .innerJoinAndSelect('entry.item', 'item')
                    .where('entry.user.id = :userId', {userId: user.id})
                    .andWhere('entry.amount > 0')
                    .orderBy('item.order', 'ASC')
                    .addOrderBy('item.name', 'ASC')
                    .skip(i)
                    .take(10)
                    .getMany()

                const embed = new EmbedBuilder()
                    .setTitle('Inventory for ' + user.username)

                if (entries.length > 0)
                    embed.setDescription(
                        entries
                            .map(entry => `${entry.item.icon ?? ''} ${entry.amount} · \`${entry.item.id}\` · ${entry.item.name}`)
                            .join('\n')
                    )

                return builder
                    .setEmbeds([embed])

            })
        }

        await message.run(interaction)

    }
}
