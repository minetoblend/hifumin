import { EntityManager, IsNull, Not } from 'typeorm';
import { DiscordUser } from '../entities/discordUser.js';
import { Card } from '../entities/card.js';
import { Result } from '../types.js';
import { JobAssignment } from '../entities/job_assignment.js';

export class CardService {
	static async getOwnedCard(
		tx: EntityManager,
		user: DiscordUser,
		id: string,
		lockForWrite = false
	): Promise<Result<Card>> {
		try {
			const cardRepository = tx.getRepository(Card);

			const card = await cardRepository.findOne({
				where: {
					id: id.toLowerCase(),
					burned: false,
					owner: Not(IsNull())
				},
				relations: ['owner', 'condition', 'mapper'],
				lock: lockForWrite ? { mode: 'pessimistic_write' } : undefined
			});

			if (!card) {
				return Result.err('Card not found')
			}

			if (card.owner?.id !== user.id) {
				return Result.err("You don't own this card")
			}

			return Result.ok(card)
		} catch (e) {
			console.error(e);
			return Result.err('An unknown error occured')
		}
	}

	static async getCardUsage(tx: EntityManager, id: string) : Promise<'job_slot' | null> {
		const assignmentCount = await tx.getRepository(JobAssignment).countBy({
			card: {
				id,
			}
		})

		if(assignmentCount > 0)
			return 'job_slot'

		return null
	}
}
