const { Plugin } = require('powercord/entities');
const { inject, uninject } = require('powercord/injector');
const { getModule } = require('powercord/webpack');
module.exports = class SendLargeMessage extends Plugin {
  startPlugin () {
    this.start();
  }

  pluginWillUnload () {
    uninject('largeMessages');
    uninject('largeMessages-limit-remover');
    uninject('largeMessages-max-remover');
  }

  async start () {
    const messageEvents = await getModule([ 'sendMessage' ]);
    const textArea = await getModule(m => m.default && m.default.displayName === 'ChannelEditorContainer');
    const messageLength = await getModule([ 'MAX_MESSAGE_LENGTH' ]);

    console.log(textArea);
    inject('largeMessages', messageEvents, 'sendMessage', (args) => {
      if (args[1].content.length >= 2000) {
        args[1].content.match(/.{1,1999}/g).forEach(async (t, i) => {
          setTimeout(() => {
            const messageArgs = { ...args[1] };
            messageArgs.content = t;
            messageEvents.sendMessage(args[0], messageArgs);
          }, 1000 * i);
        });
        return false;
      }
      return args;
    }, true);
    inject('largeMessages-limit-remover', textArea.default.prototype, 'render', (args, res) => {
      res.props.shouldUploadLongMessages = false;
      return res;
    });
    textArea.default.displayName = 'ChannelEditorContainer';
    inject('largeMessages-max-remover', messageLength, 'get MAX_MESSAGE_LENGTH', (args) => 999999999999999999);
    messageLength.MAX_MESSAGE_LENGTH = 999999999999999999;
  }
};
