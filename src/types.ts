export abstract class ResultBase<T> {
  abstract isOk(): this is Ok<T>

  isErr(): this is Err {
    return !this.isOk()
  }
}

export class Ok<T> extends ResultBase<T> {
  constructor(readonly value: T) {
    super()
  }

  isOk(): this is Ok<T> {
    return true
  }
  

}

export class Err extends ResultBase<never> {
  constructor(readonly message: string) {
    super()
  }

  isOk(): this is Ok<never> {
    return false
  }
  
}

export type Result<T> = Ok<T> | Err

export const Result = {
  ok: <T>(value: T) => new Ok(value),
  err: (message: string) => new Err(message),
}