const EventEmitter = require('events');
const async = require('async');
const TailCustomReader = require('../../log-parser/log-readers/tailCustom');
const TailCustomScanReader = require('../../log-parser/log-readers/tailCustomScan');
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
      editorAction: 0,
      baseCapture: 0,
      gmStatus: 0,
      gameStatus: 0,
      squadList: 0
    };
    this.matchingLinesPerMinute = {
      chat: 0,
      playerJoined: 0,
      playerKilled: 0,
      editorAction: 0,
      baseCapture: 0,
      gmStatus: 0,
      gameStatus: 0,
      squadList: 0
    };
    this.parsingStatsInterval = null;
    
    this.players = [];
    
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

    this.baseCaptureQueue = async.queue((line, callback) => {
      this.processBaseCaptureLine(line);
      callback();
    });

    this.gmStatusQueue = async.queue((line, callback) => {
      this.processGmStatusLine(line);
      callback();
    });

    this.gameStatusQueue = async.queue((line, callback) => {
      this.processGameStatusLine(line);
      callback();
    });

    this.squadListQueue = async.queue((data, callback) => {
      this.processSquadListData(data);
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
      
      const baseCaptureOptions = {
        ...this.options,
        filename: 'baseCaptureEvents.log',
        logDir: logDir,
        parserName: 'rjs-logging-basecapture'
      };
      this.baseCaptureLogReader = new TailCustomReader(this.baseCaptureQueue.push.bind(this.baseCaptureQueue), baseCaptureOptions);
      
      const gmStatusOptions = {
        ...this.options,
        filename: 'editorDurationEvents.log',
        logDir: logDir,
        parserName: 'rjs-logging-gmstatus'
      };
      this.gmStatusLogReader = new TailCustomReader(this.gmStatusQueue.push.bind(this.gmStatusQueue), gmStatusOptions);
      
      const gameStatusOptions = {
        ...this.options,
        filename: 'serverStatusEvents.log',
        logDir: logDir,
        parserName: 'rjs-logging-gamestatus'
      };
      this.gameStatusLogReader = new TailCustomReader(this.gameStatusQueue.push.bind(this.gameStatusQueue), gameStatusOptions);
      
      const squadListOptions = {
        ...this.options,
        filename: 'autoSquadList.json',
        logDir: logDir,
        scanInterval: 60000,
        parserName: 'rjs-logging-squadlist'
      };
      this.squadListReader = new TailCustomScanReader(this.squadListQueue.push.bind(this.squadListQueue), squadListOptions);
      
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
      const AIKilledEventHandler = require('./regexHandlers/AIKilledEvent');
      const BaseCaptureEventHandler = require('./regexHandlers/BaseCaptureEvent');
      const GmStatusEventHandler = require('./regexHandlers/GmStatusEvent');
      const GameStatusEventHandler = require('./regexHandlers/GameStatusEvent');
      const SquadListEventHandler = require('./regexHandlers/SquadListEvent');
      
      this.chatMessageEventHandler = new ChatMessageEventHandler();
      this.playerJoinedEventHandler = new PlayerJoinedEventHandler();
      this.playerKilledEventHandler = new PlayerKilledEventHandler();
      this.editorActionEventHandler = new EditorActionEventHandler();
      this.aiKilledEventHandler = new AIKilledEventHandler();
      this.baseCaptureEventHandler = new BaseCaptureEventHandler();
      this.gmStatusEventHandler = new GmStatusEventHandler();
      this.gameStatusEventHandler = new GameStatusEventHandler();
      this.squadListEventHandler = new SquadListEventHandler();
      
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
        const killDescription = `${data.killerName} killed ${data.victimName} with ${data.weaponName} (${data.weaponType})`;
        logger.verbose(`RJS PlayerKilledEvent: ${killDescription} - Distance: ${data.killDistance}m`);
        this.emit('rjsPlayerKilledEvent', data);
      });

      this.aiKilledEventHandler.on('aiKilledEvent', data => {
        const teamKillText = data.isTeamKill ? ' (TEAM KILL)' : '';
        const killDescription = `${data.killerName} killed AI with ${data.weaponName} (${data.weaponType})${teamKillText}`;
        logger.verbose(`RJS AIKilledEvent: ${killDescription} - Distance: ${data.killDistance}m`);
        this.emit('rjsAIKilledEvent', data);
      });

      this.editorActionEventHandler.on('editorActionEvent', data => {
        const actionDescription = `${data.player.name} performed ${data.action.category} action: ${data.action.type}`;
        const entityInfo = data.selectedEntities.length > 0 ? ` on ${data.selectedEntities.length} entities` : '';
        logger.verbose(`RJS EditorActionEvent: ${actionDescription}${entityInfo}`);
        this.emit('rjsEditorActionEvent', data);
      });

      this.baseCaptureEventHandler.on('baseCaptureEvent', data => {
        logger.verbose(`RJS BaseCaptureEvent: ${data.baseName} captured by ${data.factionName} (${data.factionKey})`);
        this.emit('rjsBaseCaptureEvent', data);
      });

      this.gmStatusEventHandler.on('gmStatusEvent', data => {
        const statusDescription = data.status === 'enter' ? 'entered GM mode' : `exited GM mode after ${data.duration} seconds`;
        logger.verbose(`RJS GmStatusEvent: ${data.playerName} ${statusDescription}`);
        this.emit('rjsGmStatusEvent', data);
      });

      this.gameStatusEventHandler.on('gameStatusEvent', data => {
        if (data.status === 'start') {
          logger.verbose(`RJS GameStatusEvent: Game started - Scenario: ${data.scenarioId}, Build: ${data.buildVersion}`);
        } else {
          logger.verbose(`RJS GameStatusEvent: Game ended - Reason: ${data.endReason}, Winner: ${data.winnerFactionName} (${data.winnerFactionKey}), Build: ${data.buildVersion}`);
        }
        this.emit('rjsGameStatusEvent', data);
      });

      this.squadListEventHandler.on('squadListEvent', data => {
        this.players = data.players;
        logger.verbose(`RJS SquadListEvent: Updated player list - ${data.players.length} players in ${data.summary.totalGroups} groups`);
        this.emit('rjsSquadListEvent', data);
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
    else if (this.aiKilledEventHandler && this.aiKilledEventHandler.test(line)) {
      this.aiKilledEventHandler.processLine(line);
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

  processBaseCaptureLine(line) {
    this.linesPerMinute.baseCapture++;
    
    if (this.baseCaptureEventHandler && this.baseCaptureEventHandler.test(line)) {
      this.baseCaptureEventHandler.processLine(line);
      this.matchingLinesPerMinute.baseCapture++;
    }
  }

  processGmStatusLine(line) {
    this.linesPerMinute.gmStatus++;
    
    if (this.gmStatusEventHandler && this.gmStatusEventHandler.test(line)) {
      this.gmStatusEventHandler.processLine(line);
      this.matchingLinesPerMinute.gmStatus++;
    }
  }

  processGameStatusLine(line) {
    this.linesPerMinute.gameStatus++;
    
    if (this.gameStatusEventHandler && this.gameStatusEventHandler.test(line)) {
      this.gameStatusEventHandler.processLine(line);
      this.matchingLinesPerMinute.gameStatus++;
    }
  }

  processSquadListData(data) {
    this.linesPerMinute.squadList++;
    
    if (this.squadListEventHandler) {
      this.squadListEventHandler.processData(data);
      this.matchingLinesPerMinute.squadList++;
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

      if (this.baseCaptureLogReader) {
        watchPromises.push(
          Promise.resolve(this.baseCaptureLogReader.watch())
            .catch(error => {
              logger.error(`RJS BaseCapture log reader error: ${error.message}`);
              return Promise.resolve();
            })
        );
      }

      if (this.gmStatusLogReader) {
        watchPromises.push(
          Promise.resolve(this.gmStatusLogReader.watch())
            .catch(error => {
              logger.error(`RJS GmStatus log reader error: ${error.message}`);
              return Promise.resolve();
            })
        );
      }

      if (this.gameStatusLogReader) {
        watchPromises.push(
          Promise.resolve(this.gameStatusLogReader.watch())
            .catch(error => {
              logger.error(`RJS GameStatus log reader error: ${error.message}`);
              return Promise.resolve();
            })
        );
      }

      if (this.squadListReader) {
        watchPromises.push(
          Promise.resolve(this.squadListReader.watch())
            .catch(error => {
              logger.error(`RJS SquadList reader error: ${error.message}`);
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
                      this.linesPerMinute.playerKilled + this.linesPerMinute.editorAction +
                      this.linesPerMinute.baseCapture + this.linesPerMinute.gmStatus +
                      this.linesPerMinute.gameStatus + this.linesPerMinute.squadList;
    const totalMatching = this.matchingLinesPerMinute.chat + this.matchingLinesPerMinute.playerJoined + 
                         this.matchingLinesPerMinute.playerKilled + this.matchingLinesPerMinute.editorAction +
                         this.matchingLinesPerMinute.baseCapture + this.matchingLinesPerMinute.gmStatus +
                         this.matchingLinesPerMinute.gameStatus + this.matchingLinesPerMinute.squadList;
    
    logger.info(`RJSLoggingParser - Total Lines/min: ${totalLines} | Total Matching: ${totalMatching}`);
    logger.verbose(`  - Chat: ${this.linesPerMinute.chat}/${this.matchingLinesPerMinute.chat}`);
    logger.verbose(`  - PlayerJoined: ${this.linesPerMinute.playerJoined}/${this.matchingLinesPerMinute.playerJoined}`);
    logger.verbose(`  - PlayerKilled: ${this.linesPerMinute.playerKilled}/${this.matchingLinesPerMinute.playerKilled}`);
    logger.verbose(`  - EditorAction: ${this.linesPerMinute.editorAction}/${this.matchingLinesPerMinute.editorAction}`);
    logger.verbose(`  - BaseCapture: ${this.linesPerMinute.baseCapture}/${this.matchingLinesPerMinute.baseCapture}`);
    logger.verbose(`  - GmStatus: ${this.linesPerMinute.gmStatus}/${this.matchingLinesPerMinute.gmStatus}`);
    logger.verbose(`  - GameStatus: ${this.linesPerMinute.gameStatus}/${this.matchingLinesPerMinute.gameStatus}`);
    logger.verbose(`  - SquadList: ${this.linesPerMinute.squadList}/${this.matchingLinesPerMinute.squadList}`);
    
    this.linesPerMinute = { chat: 0, playerJoined: 0, playerKilled: 0, editorAction: 0, baseCapture: 0, gmStatus: 0, gameStatus: 0, squadList: 0 };
    this.matchingLinesPerMinute = { chat: 0, playerJoined: 0, playerKilled: 0, editorAction: 0, baseCapture: 0, gmStatus: 0, gameStatus: 0, squadList: 0 };
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
      if (this.baseCaptureLogReader) {
        unwatchPromises.push(this.baseCaptureLogReader.unwatch());
      }
      if (this.gmStatusLogReader) {
        unwatchPromises.push(this.gmStatusLogReader.unwatch());
      }
      if (this.gameStatusLogReader) {
        unwatchPromises.push(this.gameStatusLogReader.unwatch());
      }
      if (this.squadListReader) {
        unwatchPromises.push(this.squadListReader.unwatch());
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
    this.baseCaptureQueue.kill();
    this.gmStatusQueue.kill();
    this.gameStatusQueue.kill();
    this.squadListQueue.kill();
    
    this.removeAllListeners();
    logger.info('RJS-Logging parser stopped');
  }
}

RJSLoggingParser.eventNames = ['rjsChatMessageEvent', 'rjsPlayerJoinedEvent', 'rjsPlayerKilledEvent', 'rjsEditorActionEvent', 'rjsAIKilledEvent', 'rjsBaseCaptureEvent', 'rjsGmStatusEvent', 'rjsGameStatusEvent', 'rjsSquadListEvent'];

module.exports = RJSLoggingParser;