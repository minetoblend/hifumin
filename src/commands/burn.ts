import {Command} from "@sapphire/framework";
import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder
} from "discord.js";
import {DiscordUserService} from "../services/discordUserService.js";
import '../services/cardRenderer.js'
import {db} from "../db.js";
import {Card} from "../entities/card.js";
import {ApplyOptions} from "@sapphire/decorators";
import {renderCard} from "../services/cardRenderer.js";

@ApplyOptions<Command.Options>({
    description: 'Burn a card',
})
export class BurnCommand extends Command {

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder.setName('burn')
                .setDescription('Burn a card')
                .addStringOption(option =>
                    option.setName('card')
                        .setDescription('The card to burn')
                        .setRequired(false)
                )
        );
    }

    override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const user = await DiscordUserService.findOrCreate(interaction.user)

        const repository = db.getRepository(Card)

        const response = await interaction.deferReply()

        let card: Card | null
        if (interaction.options.getString('card')) {
            card = await repository.findOne({
                where: {
                    id: interaction.options.getString('card')!,
                    burned: false,
                },
                relations: {
                    owner: true,
                    condition: true,
                    mapper: true,
                }
            })
        } else {
            card = await repository.createQueryBuilder('card')
                .select()
                .innerJoinAndSelect('card.mapper', 'mapper')
                .innerJoinAndSelect('card.owner', 'owner')
                .innerJoinAndSelect('card.condition', 'condition')
                .where('card.owner.id = :userId', {userId: interaction.user.id})
                .andWhere('card.burned = false')
                .orderBy('card.createdAt', 'DESC')
                .limit(1)
                .getOne()
        }
        if (!card) {
            await response.edit({
                content: 'Card not found!',
            });
            return;
        }

        if (card.owner?.id !== interaction.user.id) {
            await response.edit({
                content: 'You do not own this card!',
            });
            console.log("not owner")
            return;
        }

        const imagePath = await renderCard(card, {cardCode: true})

        const attachment = new AttachmentBuilder(imagePath)
            .setName('card.png')



            

        const embed = new EmbedBuilder()
            .setTitle('Burn Card')
            .setDescription([
                `<@${user.id}> you will receive:`,
                '',
                `:money_bag: **${card.burnValue}** \`gold\``,
                `:sparkles: **${card.dustValue}** \`${card.dustType}\``,
            ].join('\n'))
            .addFields([
                {
                    name: 'Condition',
                    value: card.condition.id,
                    inline: true,
                },
                {
                    name: 'Rarity',
                    value: card.mapper.rarity.toString(),
                    inline: true,
                }
            ])
            .setThumbnail('attachment://card.png')

        await response.edit({
            files: [attachment],
            embeds: [embed],
            components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`burn:confirm:${card.id}`)
                            .setLabel('Confirm')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`burn:cancel:${card.id}`)
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Danger),
                    )
            ]
        })
    }
}