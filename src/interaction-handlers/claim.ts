import {InteractionHandler, InteractionHandlerTypes} from '@sapphire/framework';
import type {ButtonInteraction} from 'discord.js';
import {db} from "../db.js";
import {Card} from "../entities/card.js";
import {DiscordUserService} from "../services/discordUserService.js";
import {getTimeout, TimeoutType} from "../services/timeout.js";

export class ButtonHandler extends InteractionHandler {

    public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
        super(ctx, {
            ...options,
            interactionHandlerType: InteractionHandlerTypes.Button

        });
    }


    public override parse(interaction: ButtonInteraction) {
        if (interaction.customId.startsWith('claim:')) {
            return this.some(interaction.customId.slice('claim:'.length));
        }

        return this.none();
    }

    public async run(interaction: ButtonInteraction, id: string) {
        const user = await DiscordUserService.findOrCreate(interaction.user)



        await db.transaction('SERIALIZABLE', async (tx) => {
            const ratelimit = await getTimeout(user, TimeoutType.Claim, tx)
            if (ratelimit.expired) {
                const duration = ratelimit.remainingTime > 60_000 ? `${Math.ceil(ratelimit.remainingTime / 60_000)} minutes` : `${Math.round(ratelimit.remainingTime / 1000)} seconds`;
                await interaction.reply({
                    content: `<@${user.id}> You need to wait ${duration} before claiming another card!`,
                });
                return;
            }

            const repository = tx.getRepository(Card);
            const card = await repository.findOne({
                where: {id, burned: false},
                relations: {
                    owner: true,
                    claimedBy: true,
                    droppedBy: true,
                    condition: true
                },
            });


            if (!card) {
                await interaction.reply({
                    content: 'Card not found',
                    ephemeral: true
                })
                return;
            }

            const age = Date.now() - card.createdAt.getTime();
            if (age > 1000 * 60) {
                await interaction.reply({
                    content: 'This card has expired!'
                })
                return;
            }

            if (card.owner && card.owner.id === user.id) {
                await interaction.reply({
                    content: `<@${user.id}> You already own this card!`,
                });
} else if (card.owner && card.droppedBy?.id === user.id) {
    if(Math.random() < 0.75) {
        await repository.update(card.id, {
            owner: user,
            claimedBy: user
        });

        await interaction.reply({
            content: `<@${user.id}> You fought <@${card.owner!!.id}> for this card and came out on top!`,
        });
        await ratelimit.consume()
    } else {
        await interaction.reply({
            content: `<@${user.id}> You fought <@${card.owner!!.id}> for this card but unfortunately lost!`,
        });
        await ratelimit.consume()
    }

} else if (card.owner) {
                await interaction.reply({
                    content: `<@${user.id}> This card is already claimed!`,
                });
            } else {
                await repository.update(card.id, {
                    owner: user,
                    claimedBy: user
                });

                let conditionText = ''
                switch (card.condition.id) {
                    case 'BadlyDamaged':
                        conditionText = 'Unfortunately, it is badly damaged.'
                        break;
                    case 'Poor':
                        conditionText = 'It is in poor condition.'
                        break;
                    case 'Good':
                        conditionText = 'It is in good condition.'
                        break;
                    case 'Mint':
                        conditionText = 'It is in mint condition!'
                        break;

                }

                await ratelimit.consume()

                await interaction.reply({
                    content: `<@${user.id}> You claimed the *${card.mapper.username}* card \`${card.id}\`! ${conditionText}`,
                });
            }
        })

    }
}