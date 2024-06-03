import { Command } from "@sapphire/framework";
import { db } from "../db.js";
import { Card } from "../entities/card.js";
import { renderCard } from "../services/cardRenderer.js";
import { MessageBuilder } from "@sapphire/discord.js-utilities";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import {Mapper} from "../entities/mapper.js";

export class ViewCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {...options});
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
        builder.setName('mapper').setDescription('View a mapper')
            .addStringOption(option => option.setName('username').setDescription('The mapper to view').setRequired(true))
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const username = interaction.options.getString('username')!


    const mapper = await db
        .getRepository(Mapper)
        .createQueryBuilder('mapper')
        .where('LOWER(mapper.username) = :username', {username: username.toLowerCase()})
        .getOne()


    if(!mapper) {
      const message = await interaction.reply({
        content: 'Mapper not found'
      })
    setTimeout(() => message.delete(), 15000)
      return;
    }

    const card = new Card()
      card.mapper = mapper
    const file = await renderCard(card, {cardCode: false})

    await interaction.reply(new MessageBuilder()
        .addFile(
            new AttachmentBuilder(file)
                .setName('card.png'),
        )
        .setEmbeds([
            new EmbedBuilder()
                .setTitle(`${mapper.username}`)
                .setImage('attachment://card.png')
                .addFields([
                  {
                    name: 'Rarity',
                    value: mapper.rarity.toString()
                  }
                ])
        ])
    )
  }
}