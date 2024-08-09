import { db } from "../db.js";
import { DiscordUser } from "../entities/discordUser.js";
import { EventLog } from "../entities/eventLog.js";

export class EventLogService {
  static logEvent(user: DiscordUser, action: string, info = {}) {
    console.log(JSON.stringify({
      user: {
        id: user.id,
        username: user.username,
      },
      action: action,
      ...info,
    }))
  }
}
