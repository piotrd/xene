import Module from './module'
import IGroup from './types/group'
import * as converters from './converters'
import * as messageFormat from '../helpers/formatters/message'
import { IMessage, IOptions as IMessageOptions } from './types/message'

export default class Chat extends Module {

  async postMessage(channel: string, message: IMessage, options: IMessageOptions = {}) {
    return this.call('postMessage',
      converters.snake({
        ...messageFormat.toSlack(message),
        ...{ channel, asUser: true },
        ...options
      }),
    true)
    .then(converters.camel)
  }

  async del(channel: string, ts: string, options: { asUser?: boolean } = {}) {
    return this.call('delete', converters.snake({ channel, ts, ...options }), true)
  }
}