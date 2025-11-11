// log-parser/wcs-commands/index.js
const EventEmitter = require('events');
const async = require('async');
const TailCustomReader = require('../log-readers/tailCustom');
const logger = global.logger || console;

class WCSCommandsParser extends EventEmitter {
  constructor(filename, options = {}) {
    super();
    options.filename = filename;
    options.parserName = 'wcs-commands';
    this.options = options;
    
    this.linesPerMinute = 0;
    this.matchingLinesPerMinute = 0;
    this.parsingStatsInterval = null;
    this.processLine = this.processLine.bind(this);
    this.queue = async.queue((line, callback) => {
      this.processLine(line);
      callback();
    }, 1); // Process one line at a time to prevent memory buildup

    this.logReader = new TailCustomReader(this.queue.push.bind(this.queue), options);
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Event handlers are defined in processLine method
    // This method is kept for potential future initialization
  }

  processLine(line) {
    this.linesPerMinute++;
    
    try {
      // Parse JSONL line
      const data = JSON.parse(line.trim());
      
      if (!data.type) {
        return;
      }

      this.matchingLinesPerMinute++;
      
      // Route to appropriate handler based on type
      switch (data.type) {
        case 'ChatMessageEvent':
          this.handleChatMessageEvent(data);
          break;
        case 'PlayerKilledEvent':
          this.handlePlayerKilledEvent(data);
          break;
        case 'EditorActionEvent':
          this.handleEditorActionEvent(data);
          break;
        case 'PlayerConnectedEvent':
          this.handlePlayerConnectedEvent(data);
          break;
        case 'GameStartEvent':
          this.handleGameStartEvent(data);
          break;
        case 'OnPlayerRegisteredEvent':
          this.handleOnPlayerRegisteredEvent(data);
          break;
        case 'OnPlayerAuditSuccessEvent':
          this.handleOnPlayerAuditSuccessEvent(data);
          break;
        case 'CreateEntityServerEvent':
          this.handleCreateEntityServerEvent(data);
          break;
        case 'VoteStartedEvent':
          this.handleVoteStartedEvent(data);
          break;
        case 'VoteEndedEvent':
          this.handleVoteEndedEvent(data);
          break;
        case 'BaseCapturedEvent':
          this.handleBaseCapturedEvent(data);
          break;
        case 'PlayerDisconnectedEvent':
          this.handlePlayerDisconnectedEvent(data);
          break;
        case 'SetCustomGroupNameEvent':
          this.handleSetCustomGroupNameEvent(data);
          break;
        case 'SetCustomGroupDescEvent':
          this.handleSetCustomGroupDescEvent(data);
          break;
        case 'VehicleDecommissionEvent':
          this.handleVehicleDecommissionEvent(data);
          break;
        case 'DeleteCompositionByUserActionEvent':
          this.handleDeleteCompositionByUserActionEvent(data);
          break;
        case 'EnterGMEvent':
          this.handleEnterGMEvent(data);
          break;
        case 'ExitGMEvent':
          this.handleExitGMEvent(data);
          break;
        case 'GMCreateEntityServerEvent':
          this.handleGMCreateEntityServerEvent(data);
          break;
        case 'EditModeTeleportEvent':
          this.handleEditModeTeleportEvent(data);
          break;
        case 'PromotePlayerContextEvent':
          this.handlePromotePlayerContextEvent(data);
          break;
        case 'DemotePlayerContextEvent':
          this.handleDemotePlayerContextEvent(data);
          break;
        default:
          logger.verbose(`Unknown WCS event type: ${data.type}`);
      }
    } catch (error) {
      // Not valid JSON or parsing error - skip this line
      // This is expected for non-JSON lines or malformed JSON
    }
  }

  handleChatMessageEvent(data) {
    const channelType = this.getChannelType(data.channelId);
    
    logger.verbose(`WCS ChatMessageEvent: [${channelType}] ${data.playerName}: ${data.message}`);
    this.emit('chatMessageEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      channelId: data.channelId,
      channelType,
      message: data.message,
      isServerMuted: data.isServerMuted || false
    });
  }

  handlePlayerKilledEvent(data) {
    const killType = this.determineKillType(
      data.killerId,
      data.killerName,
      data.killerGUID,
      data.friendlyFire,
      data.teamKill
    );
    const killerControlType = this.getControlType(data.killerControl);
    const victimControlType = this.getControlType(data.victimControl);
    const weaponSourceType = this.getWeaponSourceType(data.weaponSource);

    const killDescription = `${data.killerName} killed ${data.victimName} with ${data.weapon} (${killType})`;
    logger.verbose(`WCS PlayerKilledEvent: ${killDescription} - Distance: ${data.distance.toFixed(2)}m`);
    
    this.emit('playerKilledEvent', {
      timestamp: data.timestamp,
      killer: {
        id: data.killerId,
        name: data.killerName,
        guid: data.killerGUID,
        control: data.killerControl,
        controlType: killerControlType,
        disguise: data.killerDisguise
      },
      victim: {
        id: data.victimId,
        name: data.victimName,
        guid: data.victimGUID,
        control: data.victimControl,
        controlType: victimControlType,
        disguise: data.victimDisguise
      },
      kill: {
        friendlyFire: data.friendlyFire,
        teamKill: data.teamKill,
        weapon: data.weapon,
        weaponSource: data.weaponSource,
        weaponSourceType,
        distance: data.distance,
        type: killType,
        instigatorType: data.instigatorType
      }
    });
  }

  handleEditorActionEvent(data) {
    const actionType = this.getActionType(data.action);
    const selectedEntityNames = Array.isArray(data.selectedEntityComponentsNames) 
      ? data.selectedEntityComponentsNames 
      : (data.selectedEntityComponentsNames ? [data.selectedEntityComponentsNames] : []);
    const selectedEntityOwnerIds = Array.isArray(data.selectedEntityComponentsOwnerIds)
      ? data.selectedEntityComponentsOwnerIds
      : (data.selectedEntityComponentsOwnerIds ? [data.selectedEntityComponentsOwnerIds] : []);

    logger.verbose(`WCS EditorActionEvent: ${data.playerName} performed ${actionType} on ${data.hoveredEntityComponentName}`);
    
    this.emit('editorActionEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      action: data.action,
      actionType,
      hoveredEntityComponentName: data.hoveredEntityComponentName,
      hoveredEntityComponentOwnerId: data.hoveredEntityComponentOwnerId,
      selectedEntityNames,
      selectedEntityOwnerIds
    });
  }

  handlePlayerConnectedEvent(data) {
    const platformType = this.getPlatformType(data.platform);
    
    logger.verbose(`WCS PlayerConnectedEvent: ${data.playerName} (${data.profileName}) connected from ${platformType}`);
    
    this.emit('playerConnectedEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      profileName: data.profileName,
      platform: data.platform,
      platformType
    });
  }

  // New event handlers
  handleGameStartEvent(data) {
    logger.verbose(`WCS GameStartEvent: Game started (version: ${data.version || 'unknown'})`);
    this.emit('gameStartEvent', {
      timestamp: data.timestamp,
      version: data.version
    });
  }

  handleOnPlayerRegisteredEvent(data) {
    logger.verbose(`WCS OnPlayerRegisteredEvent: ${data.playerName} (ID: ${data.playerId}) registered`);
    this.emit('onPlayerRegisteredEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID || ''
    });
  }

  handleOnPlayerAuditSuccessEvent(data) {
    logger.verbose(`WCS OnPlayerAuditSuccessEvent: ${data.playerName} (ID: ${data.playerId}) audit successful`);
    this.emit('onPlayerAuditSuccessEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID
    });
  }

  handleCreateEntityServerEvent(data) {
    logger.verbose(`WCS CreateEntityServerEvent: ${data.playerName} created ${data.entityName}`);
    this.emit('createEntityServerEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      entityName: data.entityName
    });
  }

  handleVoteStartedEvent(data) {
    logger.verbose(`WCS VoteStartedEvent: ${data.playerName} started vote type ${data.voteType} for target ${data.voteTarget}`);
    this.emit('voteStartedEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      voteType: data.voteType,
      voteTarget: data.voteTarget
    });
  }

  handleVoteEndedEvent(data) {
    logger.verbose(`WCS VoteEndedEvent: Vote type ${data.voteType} for target ${data.voteTarget} ended with result ${data.voteResult}`);
    this.emit('voteEndedEvent', {
      timestamp: data.timestamp,
      voteType: data.voteType,
      voteTarget: data.voteTarget,
      voteResult: data.voteResult
    });
  }

  handleBaseCapturedEvent(data) {
    logger.verbose(`WCS BaseCapturedEvent: ${data.baseName} captured by ${data.capturingFactionName} (${data.capturingFactionKey})`);
    this.emit('baseCapturedEvent', {
      timestamp: data.timestamp,
      baseName: data.baseName,
      capturingFactionKey: data.capturingFactionKey,
      capturingFactionName: data.capturingFactionName
    });
  }

  handlePlayerDisconnectedEvent(data) {
    logger.verbose(`WCS PlayerDisconnectedEvent: ${data.playerName} disconnected (${data.reasonName})`);
    this.emit('playerDisconnectedEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      groupName: data.groupName,
      reasonName: data.reasonName
    });
  }

  handleSetCustomGroupNameEvent(data) {
    logger.verbose(`WCS SetCustomGroupNameEvent: ${data.playerName} set group name to "${data.groupName}"`);
    this.emit('setCustomGroupNameEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      groupName: data.groupName
    });
  }

  handleSetCustomGroupDescEvent(data) {
    logger.verbose(`WCS SetCustomGroupDescEvent: ${data.playerName} set group description to "${data.groupDesc}"`);
    this.emit('setCustomGroupDescEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      groupDesc: data.groupDesc
    });
  }

  handleVehicleDecommissionEvent(data) {
    logger.verbose(`WCS VehicleDecommissionEvent: ${data.playerName} decommissioned vehicle (owner: ${data.ownerName})`);
    this.emit('vehicleDecommissionEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      ownerId: data.ownerId,
      ownerName: data.ownerName,
      ownerGUID: data.ownerGUID,
      isVehicleOwner: data.isVehicleOwner
    });
  }

  handleDeleteCompositionByUserActionEvent(data) {
    logger.verbose(`WCS DeleteCompositionByUserActionEvent: ${data.instigatorName} deleted ${data.entityName} at distance ${data.distance}m`);
    this.emit('deleteCompositionByUserActionEvent', {
      timestamp: data.timestamp,
      instigatorId: data.instigatorId,
      instigatorName: data.instigatorName,
      instigatorGUID: data.instigatorGUID,
      entityName: data.entityName,
      distance: data.distance
    });
  }

  handleEnterGMEvent(data) {
    logger.verbose(`WCS EnterGMEvent: ${data.adminName} entered GM mode`);
    this.emit('enterGMEvent', {
      timestamp: data.timestamp,
      adminId: data.adminId,
      adminName: data.adminName,
      adminGUID: data.adminGUID
    });
  }

  handleExitGMEvent(data) {
    logger.verbose(`WCS ExitGMEvent: ${data.adminName} exited GM mode`);
    this.emit('exitGMEvent', {
      timestamp: data.timestamp,
      adminId: data.adminId,
      adminName: data.adminName,
      adminGUID: data.adminGUID
    });
  }

  handleGMCreateEntityServerEvent(data) {
    logger.verbose(`WCS GMCreateEntityServerEvent: ${data.playerName} (GM) created ${data.entityName}`);
    this.emit('gmCreateEntityServerEvent', {
      timestamp: data.timestamp,
      playerId: data.playerId,
      playerName: data.playerName,
      playerGUID: data.playerGUID,
      entityName: data.entityName
    });
  }

  handleEditModeTeleportEvent(data) {
    logger.verbose(`WCS EditModeTeleportEvent: ${data.adminName} teleported ${data.targetName} (${data.targetId})`);
    this.emit('editModeTeleportEvent', {
      timestamp: data.timestamp,
      adminId: data.adminId,
      adminName: data.adminName,
      adminGUID: data.adminGUID,
      targetId: data.targetId,
      targetName: data.targetName,
      targetGUID: data.targetGUID
    });
  }

  handlePromotePlayerContextEvent(data) {
    logger.verbose(`WCS PromotePlayerContextEvent: ${data.adminName} promoted ${data.targetName}`);
    this.emit('promotePlayerContextEvent', {
      timestamp: data.timestamp,
      adminId: data.adminId,
      adminName: data.adminName,
      adminGUID: data.adminGUID,
      targetId: data.targetId,
      targetName: data.targetName,
      targetGUID: data.targetGUID
    });
  }

  handleDemotePlayerContextEvent(data) {
    logger.verbose(`WCS DemotePlayerContextEvent: ${data.adminName} demoted ${data.targetName}`);
    this.emit('demotePlayerContextEvent', {
      timestamp: data.timestamp,
      adminId: data.adminId,
      adminName: data.adminName,
      adminGUID: data.adminGUID,
      targetId: data.targetId,
      targetName: data.targetName,
      targetGUID: data.targetGUID
    });
  }

  // Helper methods
  getChannelType(channelId) {
    switch(channelId) {
      case 0: return 'Global';
      case 1: return 'Faction'; 
      case 2: return 'Group';
      case 3: return 'Vehicle';
      case 4: return 'Local';
      default: return 'Unknown';
    }
  }

  determineKillType(killerId, killerName, killerGUID, friendlyFire, teamKill) {
    if (killerName === 'World' || killerGUID === 'World') {
      return 'Environmental Death';
    }
    if (killerName === 'AI' || killerGUID === 'AI' || killerId <= 0) {
      if (friendlyFire) {
        return 'Friendly AI Kill';
      }
      return 'AI Kill';
    }
    if (friendlyFire) {
      return 'Friendly Fire';
    }
    if (teamKill) {
      return 'Team Kill';
    }
    return 'Player Kill';
  }

  getControlType(control) {
    const controlMappings = {
      'PLAYER': 'Player',
      'UNLIMITED_EDITOR': 'Game Master',
      'LIMITED_EDITOR': 'Limited Editor',
      'NONE': 'None',
      'AI': 'AI Controller'
    };
    
    return controlMappings[control] || control;
  }

  getWeaponSourceType(weaponSource) {
    const weaponSourceMappings = {
      'Infantry': 'Infantry Weapon',
      'Vehicle': 'Vehicle Weapon',
      'Unknown': 'Unknown Source'
    };
    
    return weaponSourceMappings[weaponSource] || weaponSource;
  }

  getActionType(action) {
    const actionMappings = {
      'SCR_DeleteSelectedContextAction': 'Delete Entity',
      'SCR_LightningContextAction': 'Lightning Strike',
      'SCR_NeutralizeEntityContextAction': 'Neutralize Entity',
      'SCR_SpawnEntityContextAction': 'Spawn Entity',
      'SCR_MoveEntityContextAction': 'Move Entity',
      'SCR_RotateEntityContextAction': 'Rotate Entity',
      'SCR_ScaleEntityContextAction': 'Scale Entity',
      'SCR_CloneEntityContextAction': 'Clone Entity',
      'SCR_GroupEntityContextAction': 'Group Entities',
      'SCR_UngroupEntityContextAction': 'Ungroup Entities',
      'SCR_SetFireVehicleContextAction': 'Set Vehicle on Fire'
    };
    
    return actionMappings[action] || action;
  }

  getPlatformType(platform) {
    const platformMappings = {
      'platform-windows': 'PC (Windows)',
      'platform-xbox': 'Xbox',
      'platform-playstation': 'PlayStation',
      'platform-linux': 'PC (Linux)',
      'platform-mac': 'PC (Mac)'
    };
    
    return platformMappings[platform] || platform;
  }

  watch() {
    logger.verbose('WCSCommandsParser - Starting log reader...');
    
    if (this.parsingStatsInterval) clearInterval(this.parsingStatsInterval);
    this.parsingStatsInterval = setInterval(() => this.logStats(), 60 * 1000);
    
    try {
      return Promise.resolve(this.logReader.watch())
        .catch(error => {
          logger.error(`WCSCommandsParser watch error handled: ${error.message}`);
          return Promise.resolve();
        });
    } catch (error) {
      logger.error(`WCSCommandsParser watch setup failed: ${error.message}`);
      return Promise.resolve();
    }
  }

  logStats() {
    logger.info(`WCSCommandsParser - Lines/min: ${this.linesPerMinute} | Matching lines: ${this.matchingLinesPerMinute}`);
    this.linesPerMinute = 0;
    this.matchingLinesPerMinute = 0;
  }

  async unwatch() {
    try {
      if (this.logReader) await this.logReader.unwatch();
    } catch (error) {
      logger.error(`Error stopping WCSCommandsParser LogReader: ${error.message}`);
    }

    if (this.parsingStatsInterval) {
      clearInterval(this.parsingStatsInterval);
      this.parsingStatsInterval = null;
    }

    this.queue.kill();
    this.removeAllListeners();
  }
}

WCSCommandsParser.eventNames = [
  'chatMessageEvent',
  'editorActionEvent',
  'playerKilledEvent',
  'playerConnectedEvent',
  'gameStartEvent',
  'onPlayerRegisteredEvent',
  'onPlayerAuditSuccessEvent',
  'createEntityServerEvent',
  'voteStartedEvent',
  'voteEndedEvent',
  'baseCapturedEvent',
  'playerDisconnectedEvent',
  'setCustomGroupNameEvent',
  'setCustomGroupDescEvent',
  'vehicleDecommissionEvent',
  'deleteCompositionByUserActionEvent',
  'enterGMEvent',
  'exitGMEvent',
  'gmCreateEntityServerEvent',
  'editModeTeleportEvent',
  'promotePlayerContextEvent',
  'demotePlayerContextEvent'
];

module.exports = WCSCommandsParser;
