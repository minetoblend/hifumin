import {Command} from "@sapphire/framework";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction} from "discord.js";
import {DiscordUserService} from "../services/discordUserService.js";
import '../services/cardRenderer.js'
import {renderCards} from "../services/cardRenderer.js";
import {db} from "../db.js";
import {Mapper} from "../entities/mapper.js";
import {Card} from "../entities/card.js";
import {CardCondition} from "../entities/cardCondition.js";
import {ApplyOptions} from "@sapphire/decorators";
import {getTimeout, TimeoutType} from "../services/timeout.js";

@ApplyOptions<Command.Options>({
    description: 'Drops 3 cards',
})
export class DropCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder.setName('drop').setDescription('Drops 3 cards')
        )
    }


    override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const user = await DiscordUserService.findOrCreate(interaction.user)

        const isTestChannel = interaction.channelId === '1206534692761894953'

        await db.transaction('SERIALIZABLE', async tx => {
            const ratelimit = await getTimeout(user, TimeoutType.Drop, tx)
            if (ratelimit.expired && !isTestChannel) {
                const duration = ratelimit.remainingTime > 60_000 ? `${Math.ceil(ratelimit.remainingTime / 60_000)} minutes` : `${Math.round(ratelimit.remainingTime / 1000)} seconds`;
                await interaction.reply({
                    content: `You need to wait ${duration} before dropping more cards!`,
                });
                return;
            }

            const count = Math.random() < 0.05 ? 5 : 3


            const randomMappers = await tx
                .getRepository(Mapper)
                .createQueryBuilder('mapper')
                .leftJoin('mapper.wishlistEntries', 'wishlistEntry',
                    'wishlistEntry.user.id = :userId', {userId: user.id}
                )
                .select()
                .orderBy('-LOG(RAND()) / (1.0 - (rarity / 133.0 + CASE WHEN wishlistEntry.id is not null then 0.15 else 0 end))')
                .limit(count)
                .getMany()

            const conditions = [
                'BadlyDamaged',
                'BadlyDamaged',
                'Poor',
                'Poor',
                'Poor',
                'Good',
                'Good',
                'Mint'
            ]

            const cards: Card[] = []

            const response = await interaction.deferReply()


            const repository = tx.getRepository(Card)
            let nextId = await repository.count()

            for (const mapper of randomMappers) {
                const condition = conditions[Math.floor(Math.random() * conditions.length)]
                const card = new Card()
                card.id = stringId(nextId++)
                card.mapper = mapper
                card.username = mapper.username
                card.avatarUrl = mapper.avatarUrl
                card.condition = (await tx.findOneBy(CardCondition, {id: condition}))!!
                card.droppedBy = user
                card.createdAt = new Date()

                if(Math.random() < 0.05)
                    card.foil = true

                await repository.save(card)

                cards.push(card)
            }

            const frame = await renderCards(cards)

            const buttons = cards.map(card => {
                let name = card.mapper.username

                if (card.attributes.length > 0) {
                    name += ' (Foil)'
                }

                return new ButtonBuilder()
                    .setCustomId(`claim:${card.id}`)
                    .setLabel(name)
                    .setStyle(ButtonStyle.Primary)
            })

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(...buttons)

            if(!isTestChannel)
                await ratelimit.consume()

            

            const message = await response.edit({
                content: `<@${user.id}> Dropping ${count} cards...`,
                components: [row],
                files: [{
                    attachment: frame,
                    name: 'cards.png'
                }],
            })

            setTimeout(async () => {
                try {
                    await message.edit({
                        components: []
                    })
                } catch (e) {
                    console.error('Failed to remove components', e)
                }
            }, 1000 * 60)

            if (user.reminderEnabled) {
                // setTimeout(async () => {
                //     try {
                //         await interaction.user.send('Your drop is now off cooldown!')
                //     } catch (e) {
                //         console.error('Failed to send reminder', e)
                //     }
                // }, 1000 * 60 * 30)
            }
        })



    }
}

function stringId(id: number) {
    let stringId = ''
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'

    for (let i = 0; i < 4; i++) {
        stringId += chars[id % chars.length]
        id = Math.floor(id / chars.length)
    }

    return stringId.split('').reverse().join('')
}