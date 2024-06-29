import {ApplicationCommandRegistry, Command} from "@sapphire/framework";
import {ChatInputCommandInteraction} from "discord.js";
import {db} from "../db.js";
import {OptOut} from "../entities/optOut.js";

export class OptOutCommand extends Command {
    registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) => {
            builder
                .setName('optout')
                .setDescription('I don\'t want there to be a card of me in this game.')
                .addStringOption((option) =>
                    option
                        .setName('username')
                        .setDescription('Your osu username or user id')
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Optional reason for opting out.')
                        .setRequired(false)
                )
        })
    }

    async chatInputRun(interaction: ChatInputCommandInteraction) {
        await db.getRepository(OptOut).insert({
            username: interaction.options.getString('username')!,
            reason: interaction.options.getString('reason') ?? null,
            discordUsername: interaction.user.tag
        })
        await interaction.reply({
            content: 'You have been opted out. Please note that this is a manual process and will take a few hours to take effect.',
        })
    }

}