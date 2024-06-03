import {ApplicationCommandRegistry, Command} from "@sapphire/framework";
import {ChatInputCommandInteraction} from "discord.js";
import {DiscordUserService} from "../services/discordUserService.js";
import {getTimeout, TimeoutType} from "../services/timeout.js";
import {db} from "../db.js";
import {ItemService} from "../services/itemService.js";

export class DailyCommand extends Command {
    registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry
            .registerChatInputCommand(builder =>
                builder
                    .setName('daily')
                    .setDescription('Claim your daily reward')
            )
    }

    async chatInputRun(interaction: ChatInputCommandInteraction) {
        const user = await DiscordUserService.findOrCreate(interaction.user)


        await db.transaction('SERIALIZABLE', async (tx) => {
            const timeout = await getTimeout(user, TimeoutType.Daily, tx)

            if(timeout.expired) {
                await interaction.reply({
                    content: `<@${user.id}> You have already claimed your daily reward!`,
                })
                return
            }

            const amount = 50 + Math.floor(Math.random() * 200)
            await ItemService.changeItemCount(user, 'gold', amount, tx)

            await  timeout.consume()

            await interaction.reply({
                content: `<@${user.id}> You have claimed your daily reward of ${amount} gold!`,
            })
        })

    }
}