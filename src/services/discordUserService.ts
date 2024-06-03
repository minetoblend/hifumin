import {db} from "../db.js";
import {User} from "discord.js";
import {DiscordUser} from "../entities/discordUser.js";


export class DiscordUserService {
    private static repository = db.getRepository(DiscordUser)


    static async findById(id: string) {
        return this.repository.findOneBy({id})
    }

    static async findOrCreate(user: User) {
        await this.repository.upsert({
            id: user.id,
            username: user.username,
        }, ['id'])

        return (await this.findById(user.id))!!;
    }
}
