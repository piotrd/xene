import { Bot as B } from './bot'
import { DialogFactory } from './types'
import { Queue } from './queue'

export type ErrorFunc<T> = (reply: string, parsed: T) => void
export type ParseFunc<T> = (message: string) => T
export type CheckFunc<T> = (parsed: T) => boolean
export type ParserObject<T> = { parse: ParseFunc<T>, check: CheckFunc<T> }
export type Parser<T> = ParseFunc<T> | ParserObject<T>

const isNil = v => v == null
const isFunction = (v): v is Function => typeof v === 'function'

export class Dialog<
  Bot extends B,
  BotMessage extends Bot['_']['Message']= Bot['_']['Message'],
  User extends Bot['_']['User']= Bot['_']['User']> {

  bot: Bot
  user: User
  chat: string
  queue: Queue = new Queue()

  static isDefault = false

  /**
   * Method `match()` is used by xene to match user's messages with defined
   * dialogs. It's called when there aren't any active dialogs in the
   * [chat](chat) with a user. If you'll not override it and define matcher
   * for your dialog, xene will use the default one, which always evaluates to
   * `false`.
   * @param  {string}  message a user message
   * @return {boolean} indicates if the `message` is a start of the Dialog
   */
  static match(message: string): boolean { return false }

  /**
   * Very rarely you'll have to override constructor since both `bot` and
   * `chat` are available as properties of the dialog.
   * @param {Bot} bot instance of the xene bot to which a dialog belongs to
   * @param {string} chat a chat id
   */
  constructor(bot: Bot, chat: string) {
    this.bot = bot
    this.chat = chat
    this.ask = this.ask.bind(this)
    this.parse = this.parse.bind(this)
    this.message = this.message.bind(this)
  }

  /**
   * `talk()` is called by xene, you don't need to call it by yourself. It's
   * like `render()` function in react.js and like `render()` this is a method
   * where you will implement business logic(send a message, parse, ask
   * something). `talk()` is an `async` function and xene counts dialog as
   * active unless `talk()` is resolved.
   * @return {Promise<any>} a queue of a conversation with a user
   */
  async talk(): Promise<any> {
    throw new Error('Method talk is not defined')
  }

  /**
   * Xene calls `onIncomingMessage()` on each new message from a user in
   * current dialog.
   * @param {string} message user message
   */
  onIncomingMessage(message: string): void {
    /* implemented in a subclass */
  }

  /**
   * Xene calls `onOutgoingMessage()` on each new message bot sends during
   * dialog's lifecycle.
   * @param {BotMessage} message a bot message
   */
  onOutgoingMessage(message: BotMessage): void {
    /* implemented in a subclass */
  }

  /**
   * `onStart()` called right before the `talk()` method. Main difference
   * between overriding the `constructor()` and `onStart()` is that when
   * `onStart()` is called `user` propertie exists on the dialog, which is not
   * true for the `constructor()`.
   */
  onStart(): void {
    /* implemented in a subclass */
  }

  /**
   * `onAbort()` is called when conversation is aborted via
   * [`Bot#stopDialog()`] method call or when error occures in `talk()`
   * method. In second case `onAbort()` will be called with the error.
   * @param {any} error optional error object
   */
  onAbort(error?: any): void {
    /* implemented in a subclass */
  }

  /**
   * `onEnd()` is called when a conversation is naturally resolved.
   */
  onEnd(): void {
    /* implemented in a subclass */
  }

  /**
   * The purpose of the `message()` method is to send the messages to the
   * users. The exact format of the message that will be sent to the users is
   * defined in each bot separately.
   *
   * Xene always formats message you pass to the `message()` function and
   * this is not related to the type of the `Message` defined in the bots
   * (`string`, `object`, `array`). It uses [string templates](https://lodash.com/docs/#template)
   * from lodash with default presets and imports current dialog to the template.
   * To better understand the concept, take a look at the example bellow.
   *
   *
   * ```ts
   * class Greeting extends Dialog {
   *   static isDefault = true
   *   randomGreeting() {
   *     return randomElement(['Good day', 'Hi', 'Hello'])
   *   }
   *
   *   async talk() {
   *     await this.message('${randomGreeting()} ${user.name}.')
   *   }
   * }
   * ```
   *
   * @param {BotMessage} message a bot message
   * @returns result of `Bot#sendMessage()`
   */
  message(message: BotMessage) {
    const formatted = this.bot.formatMessage(message, this)
    this.onOutgoingMessage(formatted)
    return this.bot.sendMessage(this.chat, formatted)
  }

  /**
   * Queue parse for user messages
   */
  parse<Parsed>(parser: Parser<Parsed>, onError?: BotMessage | ErrorFunc<Parsed>) {
    const onErrorMessage = !isNil(onError) && !isFunction(onError)
    if (isFunction(parser)) parser = { parse: parser, check: parsed => !isNil(parsed) }
    return new Promise<Parsed>((resolve, reject) => this.queue.push({
      parser: parser as ParserObject<Parsed>,
      done: resolve as any,
      error: onErrorMessage ? () => this.message(onError as BotMessage) : onError
    }))
  }

  /**
   * as
   *
   * @template Parsed
   * @param {BotMessage} message
   * @param {Parser<Parsed>} parser
   * @param {(BotMessage | ErrorFunc<Parsed>)} [onError]
   * @returns
   */
  async ask<Parsed>(message: BotMessage, parser: Parser<Parsed>, onError?: BotMessage | ErrorFunc<Parsed>) {
    await this.message(message)
    this.queue.resetMessage()
    if (!onError) onError = () => this.message(message)
    return this.parse<Parsed>(parser as ParseFunc<Parsed>, onError)
  }

  startDialog(dialog: DialogFactory<Bot>, properties?: object) {
    return this.bot.startDialog({ dialog, chat: this.chat, user: this.user, properties })
  }
}
