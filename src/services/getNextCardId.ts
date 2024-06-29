import { db } from "../db.js";
import { CardSequence } from "../entities/cardSequence.js";

export async function getNextCardId(
  count: number,
): Promise<number[]> {
  return await db.transaction(async (tx) => {
    const sequence = await tx.getRepository(CardSequence).findOne({
      where:{ id: 0},
      lock: {
        mode: 'pessimistic_write'
      }
    })
    if(!sequence) {
      throw new Error('Card sequence not found')
    }

    const nextId = sequence.value

    await tx.getRepository(CardSequence).update(0, { value: sequence.value + count })

    const ids = []

    for(let i = 0; i < count; i++) {
      ids.push(nextId + i)
    }

    return ids
  })
}