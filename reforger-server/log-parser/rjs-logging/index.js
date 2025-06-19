// log-parser/rjs-logging/index.js
const EventEmitter = require('events');
const async = require('async');
const TailCustomReader = require('../../log-parser/log-readers/tailCustom');
const path = require('path');
const logger = global.logger || console;

class RJSLoggingParser extends EventEmitter {
  constructor(filename, options = {}) {
    super();
    this.options = options;
    this.options.parserName = 'rjs-logging';
    
    this.linesPerMinute = {
      chat: 0,
      playerJoined: 0,
      playerKilled: 0,
      editorAction: 0
    };
    this.matchingLinesPerMinute = {
      chat: 0,
      playerJoined: 0,
      playerKilled: 0,
      editorAction: 0
    };
    this.parsingStatsInterval = null;
    
    this.chatQueue = async.queue((line, callback) => {
      this.processChatLine(line);
      callback();
    });
    
    this.playerJoinedQueue = async.queue((line, callback) => {
      this.processPlayerJoinedLine(line);
      callback();
    });
    
    this.playerKilledQueue = async.queue((line, callback) => {
      this.processPlayerKilledLine(line);
      callback();
    });

    this.editorActionQueue = async.queue((line, callback) => {
      this.processEditorActionLine(line);
      callback();
    });

    this.setupLogReaders();
    this.setupRegexHandlers();
  }

  setupLogReaders() {
    try {
      const logDir = this.options.logDir;
      
      const chatOptions = {
        ...this.options,
        filename: 'chatEvents.log',
        logDir: logDir,
        parserName: 'rjs-logging-chat'
      };
      this.chatLogReader = new TailCustomReader(this.chatQueue.push.bind(this.chatQueue), chatOptions);
      
      const playerJoinedOptions = {
        ...this.options,
        filename: 'playerJoinedEvents.log',
        logDir: logDir,
        parserName: 'rjs-logging-playerjoined'
      };
      this.playerJoinedLogReader = new TailCustomReader(this.playerJoinedQueue.push.bind(this.playerJoinedQueue), playerJoinedOptions);
      
      const playerKilledOptions = {
        ...this.options,
        filename: 'playerKilledEvents.log',
        logDir: logDir,
        parserName: 'rjs-logging-playerkilled'
      };
      this.playerKilledLogReader = new TailCustomReader(this.playerKilledQueue.push.bind(this.playerKilledQueue), playerKilledOptions);
      
      const editorActionOptions = {
        ...this.options,
        filename: 'editorActionEvents.log',
        logDir: logDir,
        parserName: 'rjs-logging-editoraction'
      };
      this.editorActionLogReader = new TailCustomReader(this.editorActionQueue.push.bind(this.editorActionQueue), editorActionOptions);
      
      logger.verbose('RJS-Logging log readers initialized');
    } catch (error) {
      logger.error(`Error setting up RJS-Logging log readers: ${error.message}`);
    }
  }

  setupRegexHandlers() {
    try {
      const ChatMessageEventHandler = require('./regexHandlers/ChatMessageEvent');
      const PlayerJoinedEventHandler = require('./regexHandlers/PlayerJoinedEvent');
      const PlayerKilledEventHandler = require('./regexHandlers/PlayerKilledEvent');
      const EditorActionEventHandler = require('./regexHandlers/EditorActionEvent');
      
      this.chatMessageEventHandler = new ChatMessageEventHandler();
      this.playerJoinedEventHandler = new PlayerJoinedEventHandler();
      this.playerKilledEventHandler = new PlayerKilledEventHandler();
      this.editorActionEventHandler = new EditorActionEventHandler();
      
      this.removeAllListeners();
      
      this.chatMessageEventHandler.on('chatMessageEvent', data => {
        logger.verbose(`RJS ChatMessageEvent: [${data.channelType}] ${data.playerName}: ${data.message}`);
        this.emit('rjsChatMessageEvent', data);
      });

      this.playerJoinedEventHandler.on('playerJoinedEvent', data => {
        logger.verbose(`RJS PlayerJoinedEvent: ${data.playerName} (${data.profileName}) joined from ${data.platformType}`);
        this.emit('rjsPlayerJoinedEvent', data);
      });

      this.playerKilledEventHandler.on('playerKilledEvent', data => {
        const killDescription = `${data.killer.name} killed ${data.victim.name} with ${data.kill.weapon} (${data.kill.type})`;
        logger.verbose(`RJS PlayerKilledEvent: ${killDescription} - Distance: ${data.kill.distance.toFixed(2)}m`);
        this.emit('rjsPlayerKilledEvent', data);
      });

      this.editorActionEventHandler.on('editorActionEvent', data => {
        const actionDescription = `${data.player.name} performed ${data.action.category} action: ${data.action.type}`;
        const entityInfo = data.selectedEntities.length > 0 ? ` on ${data.selectedEntities.length} entities` : '';
        logger.verbose(`RJS EditorActionEvent: ${actionDescription}${entityInfo}`);
        this.emit('rjsEditorActionEvent', data);
      });
      
      logger.verbose('RJS-Logging regex handlers initialized');
    } catch (error) {
      logger.error(`Error setting up RJS-Logging regex handlers: ${error.message}`);
    }
  }

  processChatLine(line) {
    this.linesPerMinute.chat++;
    
    if (this.chatMessageEventHandler && this.chatMessageEventHandler.test(line)) {
      this.chatMessageEventHandler.processLine(line);
      this.matchingLinesPerMinute.chat++;
    }
  }

  processPlayerJoinedLine(line) {
    this.linesPerMinute.playerJoined++;
    
    if (this.playerJoinedEventHandler && this.playerJoinedEventHandler.test(line)) {
      this.playerJoinedEventHandler.processLine(line);
      this.matchingLinesPerMinute.playerJoined++;
    }
  }

  processPlayerKilledLine(line) {
    this.linesPerMinute.playerKilled++;
    
    if (this.playerKilledEventHandler && this.playerKilledEventHandler.test(line)) {
      this.playerKilledEventHandler.processLine(line);
      this.matchingLinesPerMinute.playerKilled++;
    }
  }

  processEditorActionLine(line) {
    this.linesPerMinute.editorAction++;
    
    if (this.editorActionEventHandler && this.editorActionEventHandler.test(line)) {
      this.editorActionEventHandler.processLine(line);
      this.matchingLinesPerMinute.editorAction++;
    }
  }

  async watch() {
    logger.verbose('RJSLoggingParser - Starting log readers...');
    
    if (this.parsingStatsInterval) clearInterval(this.parsingStatsInterval);
    this.parsingStatsInterval = setInterval(() => this.logStats(), 60 * 1000);
    
    try {
      const watchPromises = [];
      
      if (this.chatLogReader) {
        watchPromises.push(
          Promise.resolve(this.chatLogReader.watch())
            .catch(error => {
              logger.error(`RJS Chat log reader error: ${error.message}`);
              return Promise.resolve();
            })
        );
      }
      
      if (this.playerJoinedLogReader) {
        watchPromises.push(
          Promise.resolve(this.playerJoinedLogReader.watch())
            .catch(error => {
              logger.error(`RJS PlayerJoined log reader error: ${error.message}`);
              return Promise.resolve();
            })
        );
      }
      
      if (this.playerKilledLogReader) {
        watchPromises.push(
          Promise.resolve(this.playerKilledLogReader.watch())
            .catch(error => {
              logger.error(`RJS PlayerKilled log reader error: ${error.message}`);
              return Promise.resolve();
            })
        );
      }

      if (this.editorActionLogReader) {
        watchPromises.push(
          Promise.resolve(this.editorActionLogReader.watch())
            .catch(error => {
              logger.error(`RJS EditorAction log reader error: ${error.message}`);
              return Promise.resolve();
            })
        );
      }
      
      await Promise.all(watchPromises);
      logger.info('RJS-Logging parser started successfully');
      return Promise.resolve();
    } catch (error) {
      logger.error(`RJSLoggingParser watch setup failed: ${error.message}`);
      return Promise.resolve();
    }
  }

  logStats() {
    const totalLines = this.linesPerMinute.chat + this.linesPerMinute.playerJoined + 
                      this.linesPerMinute.playerKilled + this.linesPerMinute.editorAction;
    const totalMatching = this.matchingLinesPerMinute.chat + this.matchingLinesPerMinute.playerJoined + 
                         this.matchingLinesPerMinute.playerKilled + this.matchingLinesPerMinute.editorAction;
    
    logger.info(`RJSLoggingParser - Total Lines/min: ${totalLines} | Total Matching: ${totalMatching}`);
    logger.verbose(`  - Chat: ${this.linesPerMinute.chat}/${this.matchingLinesPerMinute.chat}`);
    logger.verbose(`  - PlayerJoined: ${this.linesPerMinute.playerJoined}/${this.matchingLinesPerMinute.playerJoined}`);
    logger.verbose(`  - PlayerKilled: ${this.linesPerMinute.playerKilled}/${this.matchingLinesPerMinute.playerKilled}`);
    logger.verbose(`  - EditorAction: ${this.linesPerMinute.editorAction}/${this.matchingLinesPerMinute.editorAction}`);
    
    this.linesPerMinute = { chat: 0, playerJoined: 0, playerKilled: 0, editorAction: 0 };
    this.matchingLinesPerMinute = { chat: 0, playerJoined: 0, playerKilled: 0, editorAction: 0 };
  }

  async unwatch() {
    try {
      const unwatchPromises = [];
      
      if (this.chatLogReader) {
        unwatchPromises.push(this.chatLogReader.unwatch());
      }
      if (this.playerJoinedLogReader) {
        unwatchPromises.push(this.playerJoinedLogReader.unwatch());
      }
      if (this.playerKilledLogReader) {
        unwatchPromises.push(this.playerKilledLogReader.unwatch());
      }
      if (this.editorActionLogReader) {
        unwatchPromises.push(this.editorActionLogReader.unwatch());
      }
      
      await Promise.all(unwatchPromises);
    } catch (error) {
      logger.error(`Error stopping RJS-Logging LogReaders: ${error.message}`);
    }

    if (this.parsingStatsInterval) {
      clearInterval(this.parsingStatsInterval);
      this.parsingStatsInterval = null;
    }

    this.chatQueue.kill();
    this.playerJoinedQueue.kill();
    this.playerKilledQueue.kill();
    this.editorActionQueue.kill();
    
    this.removeAllListeners();
    logger.info('RJS-Logging parser stopped');
  }
}

RJSLoggingParser.eventNames = ['rjsChatMessageEvent', 'rjsPlayerJoinedEvent', 'rjsPlayerKilledEvent', 'rjsEditorActionEvent'];

module.exports = RJSLoggingParser;