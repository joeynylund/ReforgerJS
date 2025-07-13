const mysql = require("mysql2/promise");

class RJS_DBEvents {
  constructor(config) {
    this.config = config;
    this.name = "RJS_DBEvents Plugin";
    this.isInitialized = false;
    this.serverInstance = null;
    this.serverId = null; 
  }

  async prepareToMount(serverInstance) {
    await this.cleanup();
    this.serverInstance = serverInstance;

    try {
      if (
        !this.config.connectors ||
        !this.config.connectors.mysql ||
        !this.config.connectors.mysql.enabled
      ) {
        logger.warn(`[${this.name}] MySQL is not enabled in the configuration. Plugin will be disabled.`);
        return;
      }

      if (!process.mysqlPool) {
        logger.error(`[${this.name}] MySQL pool is not available. Ensure MySQL is connected before enabling this plugin.`);
        return;
      }

      const pluginConfig = this.config.plugins.find(plugin => plugin.plugin === "RJS_DBEvents");
      if (!pluginConfig || !pluginConfig.enabled) {
        logger.verbose(`[${this.name}] Plugin is disabled in configuration.`);
        return;
      }

      this.serverId = this.config.server?.id || null;
      if (this.serverId) {
        logger.info(`[${this.name}] Using server ID: ${this.serverId}`);
      } else {
        logger.warn(`[${this.name}] No server ID found in config.server.id`);
      }

      await this.setupSchema();

      this.setupEventListeners();

      this.isInitialized = true;
      logger.info(`[${this.name}] Initialized successfully and listening for RJS events.`);
    } catch (error) {
      logger.error(`[${this.name}] Error during initialization: ${error.message}`);
    }
  }

  async setupSchema() {
    try {
      const connection = await process.mysqlPool.getConnection();

      const createChatTable = `
        CREATE TABLE IF NOT EXISTS rjs_chat (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NULL,
          timestamp VARCHAR(50) NOT NULL,
          playerId INT NOT NULL,
          playerName VARCHAR(255) NULL,
          playerBiId VARCHAR(255) NULL,
          channelId INT NOT NULL,
          channelType VARCHAR(50) NULL,
          message TEXT NULL,
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp),
          INDEX idx_player_biid (playerBiId),
          INDEX idx_channel (channelId)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;

      const createPlayerKillsTable = `
        CREATE TABLE IF NOT EXISTS rjs_playerkills (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NULL,
          timestamp VARCHAR(50) NOT NULL,
          killerId INT NOT NULL,
          killerName VARCHAR(255) NULL,
          killerBiId VARCHAR(255) NULL,
          killerFaction VARCHAR(100) NULL,
          victimId INT NOT NULL,
          victimName VARCHAR(255) NULL,
          victimBiId VARCHAR(255) NULL,
          victimFaction VARCHAR(100) NULL,
          grenadeType VARCHAR(100) NULL,
          weaponName VARCHAR(255) NULL,
          weaponType VARCHAR(100) NULL,
          weaponSource VARCHAR(100) NULL,
          attachments TEXT NULL,
          sightName VARCHAR(255) NULL,
          isTeamKill BOOLEAN DEFAULT FALSE,
          isFriendlyFire BOOLEAN DEFAULT FALSE,
          killDistance FLOAT DEFAULT 0,
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp),
          INDEX idx_killer_biid (killerBiId),
          INDEX idx_victim_biid (victimBiId),
          INDEX idx_weapon_name (weaponName),
          INDEX idx_team_kill (isTeamKill),
          INDEX idx_friendly_fire (isFriendlyFire)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;

      const createAIKillsTable = `
        CREATE TABLE IF NOT EXISTS rjs_aikills (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NULL,
          timestamp VARCHAR(50) NOT NULL,
          killerId INT NOT NULL,
          killerName VARCHAR(255) NULL,
          killerBiId VARCHAR(255) NULL,
          killerFaction VARCHAR(100) NULL,
          victimType VARCHAR(50) NULL,
          grenadeType VARCHAR(100) NULL,
          weaponName VARCHAR(255) NULL,
          weaponType VARCHAR(100) NULL,
          weaponSource VARCHAR(100) NULL,
          attachments TEXT NULL,
          sightName VARCHAR(255) NULL,
          isTeamKill BOOLEAN DEFAULT FALSE,
          killDistance FLOAT DEFAULT 0,
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp),
          INDEX idx_killer_biid (killerBiId),
          INDEX idx_weapon_name (weaponName),
          INDEX idx_victim_type (victimType),
          INDEX idx_team_kill (isTeamKill)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;

      const createEditorActionsTable = `
        CREATE TABLE IF NOT EXISTS rjs_editoractions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NULL,
          timestamp VARCHAR(50) NOT NULL,
          playerId INT NOT NULL,
          playerName VARCHAR(255) NULL,
          playerGUID VARCHAR(255) NULL,
          actionType VARCHAR(255) NULL,
          actionCategory VARCHAR(100) NULL,
          hoveredEntityName VARCHAR(255) NULL,
          hoveredEntityOwnerId INT NULL,
          selectedEntitiesCount INT DEFAULT 0,
          selectedEntitiesNames TEXT NULL,
          selectedEntitiesOwners TEXT NULL,
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp),
          INDEX idx_player_guid (playerGUID),
          INDEX idx_action_type (actionType),
          INDEX idx_action_category (actionCategory),
          INDEX idx_player_id (playerId)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;

      const createGameStartTable = `
        CREATE TABLE IF NOT EXISTS rjs_gamestart (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NULL,
          timestamp VARCHAR(50) NOT NULL,
          scenarioId VARCHAR(100) NOT NULL,
          buildVersion VARCHAR(50) NULL,
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp),
          INDEX idx_scenario_id (scenarioId)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;

      const createGameEndTable = `
        CREATE TABLE IF NOT EXISTS rjs_gameend (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NULL,
          timestamp VARCHAR(50) NOT NULL,
          endReason VARCHAR(100) NULL,
          winnerFactionName VARCHAR(100) NULL,
          winnerFactionKey VARCHAR(50) NULL,
          buildVersion VARCHAR(50) NULL,
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp),
          INDEX idx_winner_faction (winnerFactionKey),
          INDEX idx_end_reason (endReason)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;

      const createGmStatusTable = `
        CREATE TABLE IF NOT EXISTS rjs_gmstatus (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NULL,
          timestamp VARCHAR(50) NOT NULL,
          status VARCHAR(10) NOT NULL,
          playerBiId VARCHAR(255) NOT NULL,
          playerName VARCHAR(255) NULL,
          playerId INT NOT NULL,
          duration INT NULL,
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp),
          INDEX idx_player_biid (playerBiId),
          INDEX idx_status (status),
          INDEX idx_player_id (playerId)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;

      const createBaseCaptureTable = `
        CREATE TABLE IF NOT EXISTS rjs_basecaptures (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NULL,
          timestamp VARCHAR(50) NOT NULL,
          factionKey VARCHAR(50) NOT NULL,
          baseName VARCHAR(255) NOT NULL,
          factionName VARCHAR(100) NULL,
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp),
          INDEX idx_faction_key (factionKey),
          INDEX idx_base_name (baseName)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;

      await connection.query(createChatTable);
      await connection.query(createPlayerKillsTable);
      await connection.query(createAIKillsTable);
      await connection.query(createEditorActionsTable);
      await connection.query(createGameStartTable);
      await connection.query(createGameEndTable);
      await connection.query(createGmStatusTable);
      await connection.query(createBaseCaptureTable);

      connection.release();
      logger.info(`[${this.name}] Database schema setup complete - created all RJS tables including gamestart, gameend, gmstatus, and basecaptures.`);
    } catch (error) {
      logger.error(`[${this.name}] Error setting up database schema: ${error.message}`);
      throw error;
    }
  }

  setupEventListeners() {
    this.serverInstance.on('rjsChatMessageEvent', this.handleChatMessage.bind(this));
    this.serverInstance.on('rjsPlayerKilledEvent', this.handlePlayerKilled.bind(this));
    this.serverInstance.on('rjsAIKilledEvent', this.handleAIKilled.bind(this));
    this.serverInstance.on('rjsEditorActionEvent', this.handleEditorAction.bind(this));
    this.serverInstance.on('rjsGameStatusEvent', this.handleGameStatus.bind(this));
    this.serverInstance.on('rjsGmStatusEvent', this.handleGmStatus.bind(this));
    this.serverInstance.on('rjsBaseCaptureEvent', this.handleBaseCapture.bind(this));
  }

  async handleChatMessage(data) {
    if (!data || !data.timestamp) {
      logger.warn(`[${this.name}] Received incomplete rjsChatMessageEvent data`);
      return;
    }

    try {
      const insertQuery = `
        INSERT INTO rjs_chat (
          server_id, timestamp, playerId, playerName, playerBiId, channelId, channelType, message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await process.mysqlPool.query(insertQuery, [
        this.serverId,
        data.timestamp,
        data.playerId || 0,
        data.playerName || null,
        data.playerBiId || null,
        data.channelId || 0,
        data.channelType || null,
        data.message || null
      ]);

      logger.verbose(`[${this.name}] Stored RJS chat message from ${data.playerName} in channel ${data.channelType} (Server: ${this.serverId})`);
    } catch (error) {
      logger.error(`[${this.name}] Error storing RJS chat message: ${error.message}`);
    }
  }

  async handlePlayerKilled(data) {
    if (!data || !data.timestamp) {
      logger.warn(`[${this.name}] Received incomplete rjsPlayerKilledEvent data`);
      return;
    }

    try {
      const insertQuery = `
        INSERT INTO rjs_playerkills (
          server_id, timestamp, killerId, killerName, killerBiId, killerFaction,
          victimId, victimName, victimBiId, victimFaction,
          grenadeType, weaponName, weaponType, weaponSource, attachments, sightName,
          isTeamKill, isFriendlyFire, killDistance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await process.mysqlPool.query(insertQuery, [
        this.serverId,
        data.timestamp,
        data.killerId || -1,
        data.killerName || null,
        data.killerBiId || null,
        data.killerFaction || null,
        data.victimId || -1,
        data.victimName || null,
        data.victimBiId || null,
        data.victimFaction || null,
        data.grenadeType || null,
        data.weaponName || null,
        data.weaponType || null,
        data.weaponSource || null,
        data.attachments || null,
        data.sightName || null,
        data.isTeamKill || false,
        data.isFriendlyFire || false,
        data.killDistance || 0
      ]);

      logger.verbose(`[${this.name}] Stored RJS player kill: ${data.killerName} killed ${data.victimName} with ${data.weaponName} at ${data.killDistance}m (Server: ${this.serverId})`);
    } catch (error) {
      logger.error(`[${this.name}] Error storing RJS player kill: ${error.message}`);
    }
  }

  async handleAIKilled(data) {
    if (!data || !data.timestamp) {
      logger.warn(`[${this.name}] Received incomplete rjsAIKilledEvent data`);
      return;
    }

    try {
      const insertQuery = `
        INSERT INTO rjs_aikills (
          server_id, timestamp, killerId, killerName, killerBiId, killerFaction,
          victimType, grenadeType, weaponName, weaponType, weaponSource, 
          attachments, sightName, isTeamKill, killDistance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await process.mysqlPool.query(insertQuery, [
        this.serverId,
        data.timestamp,
        data.killerId || -1,
        data.killerName || null,
        data.killerBiId || null,
        data.killerFaction || null,
        data.victimType || null,
        data.grenadeType || null,
        data.weaponName || null,
        data.weaponType || null,
        data.weaponSource || null,
        data.attachments || null,
        data.sightName || null,
        data.isTeamKill || false,
        data.killDistance || 0
      ]);

      const teamKillText = data.isTeamKill ? ' (TEAM KILL)' : '';
      logger.verbose(`[${this.name}] Stored RJS AI kill: ${data.killerName} killed ${data.victimType} with ${data.weaponName} at ${data.killDistance}m${teamKillText} (Server: ${this.serverId})`);
    } catch (error) {
      logger.error(`[${this.name}] Error storing RJS AI kill: ${error.message}`);
    }
  }

  async handleEditorAction(data) {
    if (!data || !data.timestamp) {
      logger.warn(`[${this.name}] Received incomplete rjsEditorActionEvent data`);
      return;
    }

    try {
      const selectedEntitiesCount = data.selectedEntities ? data.selectedEntities.length : 0;
      let selectedEntitiesNames = null;
      let selectedEntitiesOwners = null;

      if (data.selectedEntities && data.selectedEntities.length > 0) {
        selectedEntitiesNames = data.selectedEntities
          .map(entity => entity.name || 'unknown')
          .join(',');
        selectedEntitiesOwners = data.selectedEntities
          .map(entity => entity.ownerId !== null ? entity.ownerId.toString() : '-1')
          .join(',');
      }

      const insertQuery = `
        INSERT INTO rjs_editoractions (
          server_id, timestamp, playerId, playerName, playerGUID, actionType, actionCategory,
          hoveredEntityName, hoveredEntityOwnerId, selectedEntitiesCount, 
          selectedEntitiesNames, selectedEntitiesOwners
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await process.mysqlPool.query(insertQuery, [
        this.serverId,
        data.timestamp,
        data.player?.id || -1,
        data.player?.name || null,
        data.player?.guid || null,
        data.action?.type || null,
        data.action?.category || null,
        data.hoveredEntity?.name || null,
        data.hoveredEntity?.ownerId || null,
        selectedEntitiesCount,
        selectedEntitiesNames,
        selectedEntitiesOwners
      ]);

      logger.verbose(`[${this.name}] Stored RJS editor action: ${data.player?.name} performed ${data.action?.category} (${data.action?.type}) on ${selectedEntitiesCount} entities (Server: ${this.serverId})`);
    } catch (error) {
      logger.error(`[${this.name}] Error storing RJS editor action: ${error.message}`);
    }
  }

  async handleGameStatus(data) {
    if (!data || !data.timestamp || !data.status) {
      logger.warn(`[${this.name}] Received incomplete rjsGameStatusEvent data`);
      return;
    }

    try {
      if (data.status === 'start') {
        const insertQuery = `
          INSERT INTO rjs_gamestart (
            server_id, timestamp, scenarioId, buildVersion
          ) VALUES (?, ?, ?, ?)
        `;

        await process.mysqlPool.query(insertQuery, [
          this.serverId,
          data.timestamp,
          data.scenarioId || '',
          data.buildVersion || null
        ]);

        logger.verbose(`[${this.name}] Stored RJS game start: Scenario ${data.scenarioId}, Build ${data.buildVersion} (Server: ${this.serverId})`);
      } else if (data.status === 'end') {
        const insertQuery = `
          INSERT INTO rjs_gameend (
            server_id, timestamp, endReason, winnerFactionName, winnerFactionKey, buildVersion
          ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        await process.mysqlPool.query(insertQuery, [
          this.serverId,
          data.timestamp,
          data.endReason || null,
          data.winnerFactionName || null,
          data.winnerFactionKey || null,
          data.buildVersion || null
        ]);

        logger.verbose(`[${this.name}] Stored RJS game end: Reason ${data.endReason}, Winner ${data.winnerFactionName} (Server: ${this.serverId})`);
      }
    } catch (error) {
      logger.error(`[${this.name}] Error storing RJS game status: ${error.message}`);
    }
  }

  async handleGmStatus(data) {
    if (!data || !data.timestamp) {
      logger.warn(`[${this.name}] Received incomplete rjsGmStatusEvent data`);
      return;
    }

    try {
      const insertQuery = `
        INSERT INTO rjs_gmstatus (
          server_id, timestamp, status, playerBiId, playerName, playerId, duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await process.mysqlPool.query(insertQuery, [
        this.serverId,
        data.timestamp,
        data.status || 'unknown',
        data.playerBiId || '',
        data.playerName || null,
        data.playerId || -1,
        data.duration || null
      ]);

      const statusMessage = data.status === 'enter' 
        ? `${data.playerName} entered GM mode`
        : `${data.playerName} exited GM mode after ${data.duration} seconds`;
      
      logger.verbose(`[${this.name}] Stored RJS GM status: ${statusMessage} (Server: ${this.serverId})`);
    } catch (error) {
      logger.error(`[${this.name}] Error storing RJS GM status: ${error.message}`);
    }
  }

  async handleBaseCapture(data) {
    if (!data || !data.timestamp) {
      logger.warn(`[${this.name}] Received incomplete rjsBaseCaptureEvent data`);
      return;
    }

    try {
      const insertQuery = `
        INSERT INTO rjs_basecaptures (
          server_id, timestamp, factionKey, baseName, factionName
        ) VALUES (?, ?, ?, ?, ?)
      `;

      await process.mysqlPool.query(insertQuery, [
        this.serverId,
        data.timestamp,
        data.factionKey || '',
        data.baseName || '',
        data.factionName || null
      ]);

      logger.verbose(`[${this.name}] Stored RJS base capture: ${data.baseName} captured by ${data.factionName} (${data.factionKey}) (Server: ${this.serverId})`);
    } catch (error) {
      logger.error(`[${this.name}] Error storing RJS base capture: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.serverInstance) {
      this.serverInstance.removeAllListeners('rjsChatMessageEvent');
      this.serverInstance.removeAllListeners('rjsPlayerKilledEvent');
      this.serverInstance.removeAllListeners('rjsAIKilledEvent');
      this.serverInstance.removeAllListeners('rjsEditorActionEvent');
      this.serverInstance.removeAllListeners('rjsGameStatusEvent');
      this.serverInstance.removeAllListeners('rjsGmStatusEvent');
      this.serverInstance.removeAllListeners('rjsBaseCaptureEvent');
      this.serverInstance = null;
    }
    this.isInitialized = false;
    this.serverId = null;
    logger.verbose(`[${this.name}] Cleanup completed.`);
  }
}

module.exports = RJS_DBEvents;