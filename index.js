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
    getModule([ 'MAX_MESSAGE_LENGTH' ], false).MAX_MESSAGE_LENGTH = 2000;
  }

  // modified from https://github.com/mwittrien/BetterDiscordAddons/blob/1da72ed36acbad108f4cf6264577054d54ebb157/Plugins/SendLargeMessages/SendLargeMessages.plugin.js#L126
  formatText (text) {
    text = text.replace(/\t/g, '	');
    const longWords = text.match(new RegExp(`[^ ]{${2000 * (19 / 20)},}`, 'gm'));
    if (longWords) {
      for (const longWord of longWords) {
        let count1 = 0;
        const shortWords = [];
        longWord.split('').forEach(c => {
          if (shortWords[count1] && (shortWords[count1].length >= 2000 * (19 / 20) || (c == '\n' && shortWords[count1].length >= 2000 * (19 / 20) - 100))) {
            count1++;
          }
          shortWords[count1] = shortWords[count1] ? shortWords[count1] + c : c;
        });
        text = text.replace(longWord, shortWords.join(' '));
      }
    }
    const messages = [];
    let count2 = 0;
    text.split(' ').forEach((word) => {
      if (messages[count2] && (`${messages[count2]}${word}`).length > 2000 * (39 / 40)) {
        count2++;
      }
      messages[count2] = messages[count2] ? `${messages[count2]} ${word}` : word;
    });

    let insertCodeBlock = null,
      insertCodeLine = null;
    for (let j = 0; j < messages.length; j++) {
      if (insertCodeBlock) {
        messages[j] = insertCodeBlock + messages[j];
        insertCodeBlock = null;
      } else if (insertCodeLine) {
        messages[j] = insertCodeLine + messages[j];
        insertCodeLine = null;
      }

      const codeBlocks = messages[j].match(/`{3,}[\S]*\n|`{3,}/gm);
      const codeLines = messages[j].match(/[^`]{0,1}`{1,2}[^`]|[^`]`{1,2}[^`]{0,1}/gm);

      if (codeBlocks && codeBlocks.length % 2 == 1) {
        messages[j] = `${messages[j]}\`\`\``;
        insertCodeBlock = `${codeBlocks[codeBlocks.length - 1]}\n`;
      } else if (codeLines && codeLines.length % 2 == 1) {
        insertCodeLine = codeLines[codeLines.length - 1].replace(/[^`]/g, '');
        messages[j] += insertCodeLine;
      }
    }
    return messages;
  }

  async start () {
    const messageEvents = await getModule([ 'sendMessage' ]);
    const textArea = await getModule(m => m.default && m.default.displayName === 'ChannelEditorContainer');
    const messageLength = await getModule([ 'MAX_MESSAGE_LENGTH' ]);

    console.log(textArea);
    inject('largeMessages', messageEvents, 'sendMessage', (args) => {
      if (args[1].content.length >= 2000) {
        this.formatText(args[1].content).forEach(async (t, i) => {
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
