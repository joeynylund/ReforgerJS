const mysql = require("mysql2/promise");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

module.exports = async (interaction, serverInstance, discordClient, extraData = {}) => {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }

        const user = interaction.user;
        const identifier = extraData.identifier;
        const value = extraData.value;
        
        logger.info(`[Whois Command] User: ${user.username} (ID: ${user.id}) used /whois with Identifier: ${identifier}, Value: ${value}`);

        if (!serverInstance.config.connectors ||
            !serverInstance.config.connectors.mysql ||
            !serverInstance.config.connectors.mysql.enabled) {
            await interaction.editReply('MySQL is not enabled in the configuration. This command cannot be used.');
            return;
        }

        const pool = process.mysqlPool || serverInstance.mysqlPool;

        if (!pool) {
            await interaction.editReply('Database connection is not initialized.');
            return;
        }

        const fieldMap = {
            beguid: 'beGUID',
            uuid: 'playerUID',
            name: 'playerName',
            steamid: 'steamID'
        };

        const dbField = fieldMap[identifier.toLowerCase()];

        if (!dbField) {
            await interaction.editReply(`Invalid identifier provided: ${identifier}.`);
            return;
        }

        if (identifier.toLowerCase() === 'steamid') {
            if (!/^\d{17}$/.test(value)) {
                await interaction.editReply('Invalid SteamID format. SteamID should be 17 digits long.');
                return;
            }
        }

        try {
            let query;
            let params;
            
            if (dbField === 'playerName') {
                query = `SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE ${dbField} LIKE ?`;
                params = [`%${value}%`];
            } else {
                query = `SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE ${dbField} = ?`;
                params = [value];
            }

            const [rows] = await pool.query(query, params);

            if (rows.length === 0) {
                await interaction.editReply(`No information can be found for ${identifier}: ${value}`);
                return;
            }

            if (dbField === 'playerName' && rows.length > 1) {
                const displayCount = Math.min(rows.length, 10);
                let responseMessage = `Found ${rows.length} players matching "${value}". `;
                
                if (rows.length > 10) {
                    responseMessage += `Showing first 10 results. Please refine your search for more specific results.\n\n`;
                } else {
                    responseMessage += `Full details for each match:\n\n`;
                }
                
                for (let i = 0; i < displayCount; i++) {
                    const player = rows[i];
                    let playerDetails = `${i+1}. ${player.playerName || 'Unknown'}\n` +
                                       `   UUID: ${player.playerUID || 'Missing'}\n` +
                                       `   IP: ${player.playerIP || 'Missing'}\n` +
                                       `   beGUID: ${player.beGUID || 'Missing'}\n` +
                                       `   Device: ${player.device || 'Not Found'}\n`;
                    
                    if (player.device === 'PC') {
                        playerDetails += `   SteamID: ${player.steamID || 'Not Found'}\n`;
                    }
                    
                    responseMessage += playerDetails + '\n';
                }
                
                await interaction.editReply(responseMessage);
                return;
            }

            const player = rows[0];
            const embed = createMainPlayerEmbed(player, value);
            const mainActionRow = createMainActionRow(serverInstance.config);

            await interaction.editReply({
                embeds: [embed],
                components: [mainActionRow]
            });

        } catch (queryError) {
            logger.error(`[Whois Command] Database query error: ${queryError.message}`);
            await interaction.editReply('An error occurred while querying the database.');
        }
    } catch (error) {
        logger.error(`[Whois Command] Unexpected error: ${error.message}`);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An unexpected error occurred while executing the command.',
                ephemeral: true
            });
        } else if (interaction.deferred && !interaction.replied) {
            await interaction.editReply('An unexpected error occurred while executing the command.');
        }
    }
};

function createMainPlayerEmbed(player, searchValue) {
    let playerInfo = `Name: ${player.playerName || 'Missing Player Name'}\n` +
                    `IP Address: ${player.playerIP || 'Missing IP Address'}\n` +
                    `Reforger UUID: ${player.playerUID || 'Missing UUID'}\n` +
                    `be GUID: ${player.beGUID || 'Missing beGUID'}\n` +
                    `Device: ${player.device || 'Not Found'}`;
    
    if (player.device === 'PC') {
        playerInfo += `\nSteamID: ${player.steamID || 'Not Found'}`;
    }

    return new EmbedBuilder()
        .setTitle('Reforger Lookup Directory')
        .setDescription(`🔍 Whois: ${searchValue}\n\n`)
        .setColor(0xFFA500)
        .addFields({
            name: "Player Information",
            value: playerInfo
        })
        .setFooter({ text: 'ReforgerJS' });
}

function createAltCheckerEmbed(mainPlayer, altPlayers, searchValue) {
    const altCheckIP = mainPlayer.playerIP || 'Unknown';
    
    let description = `🔍 Whois: ${searchValue}\n🔀 AltChecks for IP: ${altCheckIP}\n\n`;
    
    let mainPlayerInfo = `Name: ${mainPlayer.playerName || 'Missing Player Name'}\n` +
                        `Reforger UUID: ${mainPlayer.playerUID || 'Missing UUID'}\n` +
                        `Device: ${mainPlayer.device || 'Not Found'}`;
    
    if (mainPlayer.device === 'PC') {
        mainPlayerInfo += `\nSteamID: ${mainPlayer.steamID || 'Not Found'}`;
    }

    const embed = new EmbedBuilder()
        .setTitle('Reforger **AltChecker')
        .setDescription(description)
        .setColor(0xFF6B35)
        .addFields({
            name: "Main Player",
            value: mainPlayerInfo,
            inline: false
        })
        .setFooter({ text: 'ReforgerJS AltChecker' });

    if (altPlayers.length > 0) {
        let altsText = '';
        altPlayers.forEach((alt, index) => {
            let altInfo = `${index + 1}. ${alt.playerName || 'Unknown'}\n` +
                         `   UUID: ${alt.playerUID || 'Missing'}\n` +
                         `   Device: ${alt.device || 'Not Found'}`;
            
            if (alt.device === 'PC') {
                altInfo += `\n   SteamID: ${alt.steamID || 'Not Found'}`;
            }
            altsText += altInfo + '\n\n';
        });

        embed.addFields({
            name: `🔀 Alt Accounts Found (${altPlayers.length})`,
            value: altsText,
            inline: false
        });
    } else {
        embed.addFields({
            name: "🔀 Alt Accounts",
            value: "No alt accounts found for this IP address.",
            inline: false
        });
    }

    return embed;
}

function createMainActionRow(config) {
    const buttons = [
        new ButtonBuilder()
            .setCustomId('whois-altcheck')
            .setLabel('AltCheck')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔀')
    ];

    if (config.customParsers && 
        config.customParsers['rjs-logging'] && 
        config.customParsers['rjs-logging'].enabled === true) {
        
        buttons.push(
            new ButtonBuilder()
                .setCustomId('whois-chatlogs')
                .setLabel('ChatLogs')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💬')
        );

        buttons.push(
            new ButtonBuilder()
                .setCustomId('whois-killlogs')
                .setLabel('KillLogs')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚔️')
        );
    }

    return new ActionRowBuilder().addComponents(...buttons);
}

function createAltCheckerActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('whois-back')
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('↖️')
        );
}

function createChatLogsActionRow(currentPage, totalPages) {
    const buttons = [
        new ButtonBuilder()
            .setCustomId('whois-back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↖️'),
        new ButtonBuilder()
            .setCustomId(`whois-chatlogs-prev-${currentPage}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId(`whois-chatlogs-next-${currentPage}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('▶️')
            .setDisabled(currentPage >= totalPages)
    ];

    return new ActionRowBuilder().addComponents(...buttons);
}

function createKillLogsActionRow(currentPage, totalPages, showFriendlyFireOnly = false) {
    const buttons = [
        new ButtonBuilder()
            .setCustomId('whois-back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↖️'),
        new ButtonBuilder()
            .setCustomId(`whois-killlogs-prev-${currentPage}-${showFriendlyFireOnly}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId(`whois-killlogs-next-${currentPage}-${showFriendlyFireOnly}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('▶️')
            .setDisabled(currentPage >= totalPages),
        new ButtonBuilder()
            .setCustomId(`whois-killlogs-ff-${currentPage}`)
            .setLabel('FriendlyFire')
            .setStyle(showFriendlyFireOnly ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('⚠️')
    ];

    return new ActionRowBuilder().addComponents(...buttons);
}

function createChatLogsEmbed(mainPlayer, chatMessages, searchValue, currentPage, totalPages, totalMessages) {
    try {
        const safeSearchValue = searchValue ? searchValue.substring(0, 50) : 'Unknown';
        const safePlayerName = mainPlayer.playerName ? mainPlayer.playerName.substring(0, 50) : 'Unknown Player';
        
        const embed = new EmbedBuilder()
            .setTitle('Reforger Chat Logs')
            .setDescription(`🔍 Whois: ${safeSearchValue}\n💬 Chat History for: ${safePlayerName}\n\n`)
            .setColor(0x4287f5)
            .setFooter({ text: `ReforgerJS Chat Logs | Page ${currentPage} of ${totalPages} | Total Messages: ${totalMessages}` });

        if (chatMessages.length === 0) {
            embed.addFields({
                name: "Messages",
                value: "No chat messages found for this player.",
                inline: false
            });
        } else {
            let messagesText = '**Legend:** [Time][Server][Channel]: Message\n\n';
            const maxFieldLength = 950;
            let messageCount = 0;
            
            for (const msg of chatMessages) {
                const serverNum = String(msg.server_id || '?').substring(0, 5);
                const channelType = String(msg.channelType || 'Unknown').substring(0, 10);
                const message = String(msg.message || 'Empty message');
                
                let discordTimestamp = '';
                if (msg.timestamp) {
                    try {
                        const timestamp = new Date(msg.timestamp);
                        const unixTimestamp = Math.floor(timestamp.getTime() / 1000);
                        discordTimestamp = `<t:${unixTimestamp}:t>`;
                    } catch (timeError) {
                        discordTimestamp = 'Invalid';
                    }
                } else {
                    discordTimestamp = 'Unknown';
                }
                
                const truncatedMessage = message.length > 150 ? message.substring(0, 150) + '...' : message;
                const newLine = `[${discordTimestamp}][${serverNum}][${channelType}]: ${truncatedMessage}\n`;
                
                if (messagesText.length + newLine.length > maxFieldLength) {
                    break;
                }
                
                messagesText += newLine;
                messageCount++;
            }

            if (messageCount === 0) {
                messagesText += 'Messages too long to display';
            }

            embed.addFields({
                name: `Messages (${messageCount} shown)`,
                value: messagesText.length > 1024 ? messagesText.substring(0, 1021) + '...' : messagesText,
                inline: false
            });
        }

        return embed;
    } catch (error) {
        logger.error(`[ChatLogs Embed Creation] Error: ${error.message}`);
        return new EmbedBuilder()
            .setTitle('Reforger Chat Logs')
            .setDescription('Error creating chat logs embed')
            .setColor(0xFF0000)
            .addFields({
                name: "Error",
                value: "Unable to display chat logs",
                inline: false
            });
    }
}

function createKillLogsEmbed(mainPlayer, killData, searchValue, currentPage, totalPages, totalKills, showFriendlyFireOnly = false) {
    try {
        const safeSearchValue = searchValue ? searchValue.substring(0, 50) : 'Unknown';
        const safePlayerName = mainPlayer.playerName ? mainPlayer.playerName.substring(0, 50) : 'Unknown Player';
        
        const titlePrefix = showFriendlyFireOnly ? 'Reforger Friendly Fire Logs' : 'Reforger Kill Logs';
        const descriptionPrefix = showFriendlyFireOnly ? '⚠️ Friendly Fire History for:' : '⚔️ Kill History for:';
        
        const embed = new EmbedBuilder()
            .setTitle(titlePrefix)
            .setDescription(`🔍 Whois: ${safeSearchValue}\n${descriptionPrefix} ${safePlayerName}\n\n`)
            .setColor(showFriendlyFireOnly ? 0xFF0000 : 0xFF6B35)
            .setFooter({ text: `ReforgerJS Kill Logs | Page ${currentPage} of ${totalPages} | Total ${showFriendlyFireOnly ? 'FF ' : ''}Kills: ${totalKills}` });

        if (killData.length === 0) {
            const noDataMessage = showFriendlyFireOnly ? 'No friendly fire records found for this player.' : 'No kill records found for this player.';
            embed.addFields({
                name: "⚔️ Kills",
                value: noDataMessage,
                inline: false
            });
        } else {
            let killsText = '**Legend:** [Time][Server]: Victim Name\n\n';
            const maxFieldLength = 950;
            let killCount = 0;
            
            for (const kill of killData) {
                const serverNum = String(kill.server_id || '?').substring(0, 5);
                const victimName = String(kill.victimName || 'Unknown Victim').substring(0, 30);
                const victimGuid = String(kill.victimBiId || 'Unknown GUID').substring(0, 36);
                const weapon = String(kill.weapon || 'Unknown').substring(0, 25);
                const distance = kill.distance ? `${parseFloat(kill.distance).toFixed(1)}m` : 'Unknown';
                const killType = String(kill.killType || 'Kill').substring(0, 20);
                const isFriendlyFire = kill.friendlyFire || kill.teamKill;
                const friendlyFireIndicator = isFriendlyFire ? ' ⚠️' : '';
                
                let discordTimestamp = '';
                if (kill.timestamp) {
                    try {
                        const timestamp = new Date(kill.timestamp);
                        const unixTimestamp = Math.floor(timestamp.getTime() / 1000);
                        discordTimestamp = `<t:${unixTimestamp}:t>`;
                    } catch (timeError) {
                        discordTimestamp = 'Invalid';
                    }
                } else {
                    discordTimestamp = 'Unknown';
                }
                
                const killEntry = `[${discordTimestamp}][${serverNum}]: ${victimName}${friendlyFireIndicator}\n` +
                                `Victim GUID: ${victimGuid}\n` +
                                `Weapon: ${weapon} | Distance: ${distance}\n` +
                                `Kill Type: ${killType}\n\n`;
                
                if (killsText.length + killEntry.length > maxFieldLength) {
                    break;
                }
                
                killsText += killEntry;
                killCount++;
            }

            if (killCount === 0) {
                killsText += 'Kill records too long to display';
            }

            embed.addFields({
                name: `⚔️ Kills (${killCount} shown)`,
                value: killsText.length > 1024 ? killsText.substring(0, 1021) + '...' : killsText,
                inline: false
            });
        }

        return embed;
    } catch (error) {
        logger.error(`[KillLogs Embed Creation] Error: ${error.message}`);
        return new EmbedBuilder()
            .setTitle('Reforger Kill Logs')
            .setDescription('Error creating kill logs embed')
            .setColor(0xFF0000)
            .addFields({
                name: "Error",
                value: "Unable to display kill logs",
                inline: false
            });
    }
}

module.exports.handleButton = async (interaction, serverInstance, discordClient, extraData = {}) => {
    try {
        const { buttonId, customId, originalMessage } = extraData;
        
        logger.info(`[Whois Button Handler] User: ${interaction.user.username} (ID: ${interaction.user.id}) clicked button: ${buttonId}`);

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        if (buttonId === 'altcheck') {
            await handleAltCheckButton(interaction, serverInstance, originalMessage);
        } else if (buttonId === 'chatlogs') {
            await handleChatLogsButton(interaction, serverInstance, originalMessage);
        } else if (buttonId === 'killlogs') {
            await handleKillLogsButton(interaction, serverInstance, originalMessage);
        } else if (buttonId.startsWith('chatlogs-prev-') || buttonId.startsWith('chatlogs-next-')) {
            await handleChatLogsPagination(interaction, serverInstance, originalMessage, buttonId);
        } else if (buttonId.startsWith('killlogs-prev-') || buttonId.startsWith('killlogs-next-')) {
            await handleKillLogsPagination(interaction, serverInstance, originalMessage, buttonId);
        } else if (buttonId.startsWith('killlogs-ff-')) {
            await handleKillLogsFriendlyFireToggle(interaction, serverInstance, originalMessage, buttonId);
        } else if (buttonId === 'back') {
            await handleBackButton(interaction, originalMessage, serverInstance);
        } else {
            logger.warn(`[Whois Button Handler] Unknown button ID: ${buttonId}`);
            await interaction.editReply({
                content: 'Unknown button clicked.',
                components: []
            });
        }

    } catch (error) {
        logger.error(`[Whois Button Handler] Error handling button: ${error.message}`);
        logger.debug(`[Whois Button Handler] Stack trace: ${error.stack}`);
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while processing the button.',
                    ephemeral: true
                });
            } else if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    content: 'An error occurred while processing the button.',
                    components: []
                });
            }
        } catch (replyError) {
            logger.error(`[Whois Button Handler] Error sending error response: ${replyError.message}`);
        }
    }
};

async function handleAltCheckButton(interaction, serverInstance, originalMessage) {
    try {
        const originalEmbed = originalMessage.embeds[0];
        const playerInfo = originalEmbed.fields[0].value;
        
        const uuidMatch = playerInfo.match(/Reforger UUID: ([^\n]+)/);
        if (!uuidMatch) {
            await interaction.editReply({
                content: 'Could not extract player UUID from the original message.',
                components: []
            });
            return;
        }

        const playerUUID = uuidMatch[1].trim();
        
        const pool = process.mysqlPool || serverInstance.mysqlPool;
        if (!pool) {
            await interaction.editReply({
                content: 'Database connection is not available.',
                components: []
            });
            return;
        }

        const [mainPlayerRows] = await pool.query(
            'SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE playerUID = ?',
            [playerUUID]
        );

        if (mainPlayerRows.length === 0) {
            await interaction.editReply({
                content: 'Could not find player in database.',
                components: []
            });
            return;
        }

        const mainPlayer = mainPlayerRows[0];
        const searchValue = originalEmbed.description.match(/🔍 Whois: (.+)/)[1];

        let altPlayers = [];
        if (mainPlayer.playerIP) {
            const [altRows] = await pool.query(
                'SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE playerIP = ? AND playerUID != ?',
                [mainPlayer.playerIP, playerUUID]
            );
            altPlayers = altRows;
        }

        const altEmbed = createAltCheckerEmbed(mainPlayer, altPlayers, searchValue);
        const altActionRow = createAltCheckerActionRow();

        await interaction.editReply({
            embeds: [altEmbed],
            components: [altActionRow]
        });

        logger.info(`[Whois AltCheck] Found ${altPlayers.length} alt accounts for player ${mainPlayer.playerName}`);

    } catch (error) {
        logger.error(`[Whois AltCheck] Error: ${error.message}`);
        await interaction.editReply({
            content: 'An error occurred while checking for alt accounts.',
            components: []
        });
    }
}

async function handleChatLogsButton(interaction, serverInstance, originalMessage) {
    try {
        logger.info(`[Whois ChatLogs] Starting chat logs handler`);
        
        const originalEmbed = originalMessage.embeds[0];
        const playerInfo = originalEmbed.fields[0].value;
        
        logger.info(`[Whois ChatLogs] Extracted playerInfo length: ${playerInfo ? playerInfo.length : 'null'}`);
        
        const uuidMatch = playerInfo.match(/Reforger UUID: ([^\n]+)/);
        if (!uuidMatch) {
            logger.error(`[Whois ChatLogs] Could not extract UUID from playerInfo: ${playerInfo}`);
            await interaction.editReply({
                content: 'Could not extract player UUID from the original message.',
                components: []
            });
            return;
        }

        const playerUUID = uuidMatch[1].trim();
        logger.info(`[Whois ChatLogs] Extracted UUID: ${playerUUID}`);
        
        const pool = process.mysqlPool || serverInstance.mysqlPool;
        if (!pool) {
            logger.error(`[Whois ChatLogs] No database pool available`);
            await interaction.editReply({
                content: 'Database connection is not available.',
                components: []
            });
            return;
        }

        logger.info(`[Whois ChatLogs] Checking for rjs_chat table`);
        const [rjsChatTableCheck] = await pool.query(`SHOW TABLES LIKE 'rjs_chat'`);
        if (!rjsChatTableCheck.length) {
            logger.error(`[Whois ChatLogs] RJS chat table missing`);
            await interaction.editReply({
                content: 'RJS chat table is missing. RJS_DBEvents plugin may not be enabled.',
                components: []
            });
            return;
        }

        logger.info(`[Whois ChatLogs] Querying for main player data`);
        const [mainPlayerRows] = await pool.query(
            'SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE playerUID = ?',
            [playerUUID]
        );

        if (mainPlayerRows.length === 0) {
            logger.error(`[Whois ChatLogs] No player found with UUID: ${playerUUID}`);
            await interaction.editReply({
                content: 'Could not find player in database.',
                components: []
            });
            return;
        }

        const mainPlayer = mainPlayerRows[0];
        logger.info(`[Whois ChatLogs] Found player: ${mainPlayer.playerName}, data keys: ${Object.keys(mainPlayer).join(', ')}`);
        
        const searchValue = originalEmbed.description.match(/🔍 Whois: (.+)/)[1];
        logger.info(`[Whois ChatLogs] Search value: ${searchValue}`);

        logger.info(`[Whois ChatLogs] Counting total messages for UUID: ${playerUUID}`);
        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM rjs_chat WHERE playerBiId = ?',
            [playerUUID]
        );
        
        const totalMessages = countResult[0].total;
        logger.info(`[Whois ChatLogs] Total messages found: ${totalMessages}`);
        
        const messagesPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(totalMessages / messagesPerPage));
        const currentPage = 1;

        logger.info(`[Whois ChatLogs] Pagination: ${messagesPerPage} per page, ${totalPages} total pages`);

        logger.info(`[Whois ChatLogs] Querying for message data`);
        const [messageRows] = await pool.query(
            `SELECT channelType, message, timestamp, server_id 
             FROM rjs_chat 
             WHERE playerBiId = ? 
             ORDER BY timestamp DESC 
             LIMIT ? OFFSET ?`,
            [playerUUID, messagesPerPage, 0]
        );

        logger.info(`[Whois ChatLogs] Retrieved ${messageRows.length} messages`);
        
        if (messageRows.length > 0) {
            messageRows.forEach((msg, index) => {
                logger.info(`[Whois ChatLogs] Message ${index}: channelType=${msg.channelType}, messageLength=${msg.message ? msg.message.length : 'null'}, server_id=${msg.server_id}`);
                if (msg.message && msg.message.length > 100) {
                    logger.warn(`[Whois ChatLogs] Long message detected: ${msg.message.substring(0, 100)}...`);
                }
            });
        }

        logger.info(`[Whois ChatLogs] Creating chat embed`);
        const chatEmbed = createChatLogsEmbed(mainPlayer, messageRows, searchValue, currentPage, totalPages, totalMessages);
        
        logger.info(`[Whois ChatLogs] Creating action row`);
        const chatActionRow = createChatLogsActionRow(currentPage, totalPages);

        logger.info(`[Whois ChatLogs] Sending interaction reply`);
        await interaction.editReply({
            embeds: [chatEmbed],
            components: [chatActionRow]
        });

        logger.info(`[Whois ChatLogs] Successfully completed chat logs display for player ${mainPlayer.playerName} (${totalMessages} total messages)`);

    } catch (error) {
        logger.error(`[Whois ChatLogs] Error at: ${error.stack}`);
        logger.error(`[Whois ChatLogs] Error name: ${error.name}`);
        logger.error(`[Whois ChatLogs] Error message: ${error.message}`);
        logger.error(`[Whois ChatLogs] Error code: ${error.code || 'no code'}`);
        
        try {
            await interaction.editReply({
                content: `An error occurred while retrieving chat logs: ${error.message}`,
                components: []
            });
        } catch (replyError) {
            logger.error(`[Whois ChatLogs] Failed to send error reply: ${replyError.message}`);
        }
    }
}

async function handleKillLogsButton(interaction, serverInstance, originalMessage) {
    try {
        const originalEmbed = originalMessage.embeds[0];
        const playerInfo = originalEmbed.fields[0].value;
        
        const uuidMatch = playerInfo.match(/Reforger UUID: ([^\n]+)/);
        if (!uuidMatch) {
            await interaction.editReply({
                content: 'Could not extract player UUID from the original message.',
                components: []
            });
            return;
        }

        const playerUUID = uuidMatch[1].trim();
        
        const pool = process.mysqlPool || serverInstance.mysqlPool;
        if (!pool) {
            await interaction.editReply({
                content: 'Database connection is not available.',
                components: []
            });
            return;
        }

        const [rjsKillsTableCheck] = await pool.query(`SHOW TABLES LIKE 'rjs_playerkills'`);
        if (!rjsKillsTableCheck.length) {
            await interaction.editReply({
                content: 'RJS kills table is missing. RJS_DBEvents plugin may not be enabled.',
                components: []
            });
            return;
        }

        const [mainPlayerRows] = await pool.query(
            'SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE playerUID = ?',
            [playerUUID]
        );

        if (mainPlayerRows.length === 0) {
            await interaction.editReply({
                content: 'Could not find player in database.',
                components: []
            });
            return;
        }

        const mainPlayer = mainPlayerRows[0];
        const searchValue = originalEmbed.description.match(/🔍 Whois: (.+)/)[1];

        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM rjs_playerkills WHERE killerBiId = ?',
            [playerUUID]
        );
        
        const totalKills = countResult[0].total;
        const killsPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(totalKills / killsPerPage));
        const currentPage = 1;

        const [killRows] = await pool.query(
            `SELECT victimName, victimBiId, weapon, distance, friendlyFire, teamKill, killType, timestamp, server_id
             FROM rjs_playerkills 
             WHERE killerBiId = ? 
             ORDER BY timestamp DESC 
             LIMIT ? OFFSET ?`,
            [playerUUID, killsPerPage, 0]
        );

        const killEmbed = createKillLogsEmbed(mainPlayer, killRows, searchValue, currentPage, totalPages, totalKills, false);
        const killActionRow = createKillLogsActionRow(currentPage, totalPages, false);

        await interaction.editReply({
            embeds: [killEmbed],
            components: [killActionRow]
        });

        logger.info(`[Whois KillLogs] Displayed page ${currentPage}/${totalPages} of kill logs for player ${mainPlayer.playerName} (${totalKills} total kills)`);

    } catch (error) {
        logger.error(`[Whois KillLogs] Error: ${error.message}`);
        await interaction.editReply({
            content: 'An error occurred while retrieving kill logs.',
            components: []
        });
    }
}

async function handleChatLogsPagination(interaction, serverInstance, originalMessage, buttonId) {
    try {
        const pageMatch = buttonId.match(/(prev|next)-(\d+)/);
        if (!pageMatch) {
            await interaction.editReply({
                content: 'Invalid pagination button.',
                components: []
            });
            return;
        }

        const direction = pageMatch[1];
        const currentPageFromButton = parseInt(pageMatch[2], 10);
        
        const currentEmbed = originalMessage.embeds[0];
        const searchValue = currentEmbed.description.match(/🔍 Whois: (.+)/)[1];
        const playerNameMatch = currentEmbed.description.match(/💬 Chat History for: ([^\n]+)/);
        
        if (!playerNameMatch) {
            await interaction.editReply({
                content: 'Could not extract player information.',
                components: []
            });
            return;
        }

        const playerName = playerNameMatch[1].trim();
        
        const pool = process.mysqlPool || serverInstance.mysqlPool;
        if (!pool) {
            await interaction.editReply({
                content: 'Database connection is not available.',
                components: []
            });
            return;
        }

        const [playerRows] = await pool.query(
            'SELECT playerUID FROM players WHERE playerName = ? LIMIT 1',
            [playerName]
        );

        if (playerRows.length === 0) {
            await interaction.editReply({
                content: 'Could not find player in database.',
                components: []
            });
            return;
        }

        const playerUUID = playerRows[0].playerUID;

        const newPage = direction === 'next' ? currentPageFromButton + 1 : currentPageFromButton - 1;
        
        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM rjs_chat WHERE playerBiId = ?',
            [playerUUID]
        );
        
        const totalMessages = countResult[0].total;
        const messagesPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(totalMessages / messagesPerPage));

        if (newPage < 1 || newPage > totalPages) {
            await interaction.editReply({
                content: 'Invalid page number.',
                components: []
            });
            return;
        }

        const offset = (newPage - 1) * messagesPerPage;
        const [messageRows] = await pool.query(
            `SELECT channelType, message, timestamp, server_id 
             FROM rjs_chat 
             WHERE playerBiId = ? 
             ORDER BY timestamp DESC 
             LIMIT ? OFFSET ?`,
            [playerUUID, messagesPerPage, offset]
        );

        const [mainPlayerRows] = await pool.query(
            'SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE playerUID = ?',
            [playerUUID]
        );

        const mainPlayer = mainPlayerRows[0];

        const chatEmbed = createChatLogsEmbed(mainPlayer, messageRows, searchValue, newPage, totalPages, totalMessages);
        const chatActionRow = createChatLogsActionRow(newPage, totalPages);

        await interaction.editReply({
            embeds: [chatEmbed],
            components: [chatActionRow]
        });

        logger.info(`[Whois ChatLogs] Navigated to page ${newPage}/${totalPages} for player ${mainPlayer.playerName}`);

    } catch (error) {
        logger.error(`[Whois ChatLogs Pagination] Error: ${error.message}`);
        await interaction.editReply({
            content: 'An error occurred while navigating chat logs.',
            components: []
        });
    }
}

async function handleKillLogsPagination(interaction, serverInstance, originalMessage, buttonId) {
    try {
        const pageMatch = buttonId.match(/(prev|next)-(\d+)-?(true|false)?/);
        if (!pageMatch) {
            await interaction.editReply({
                content: 'Invalid pagination button.',
                components: []
            });
            return;
        }

        const direction = pageMatch[1];
        const currentPageFromButton = parseInt(pageMatch[2], 10);
        const showFriendlyFireOnly = pageMatch[3] === 'true';
        
        const currentEmbed = originalMessage.embeds[0];
        const searchValue = currentEmbed.description.match(/🔍 Whois: (.+)/)[1];
        const playerNameMatch = currentEmbed.description.match(/⚔️ Kill History for: ([^\n]+)|⚠️ Friendly Fire History for: ([^\n]+)/);
        
        if (!playerNameMatch) {
            await interaction.editReply({
                content: 'Could not extract player information.',
                components: []
            });
            return;
        }

        const playerName = (playerNameMatch[1] || playerNameMatch[2]).trim();
        
        const pool = process.mysqlPool || serverInstance.mysqlPool;
        if (!pool) {
            await interaction.editReply({
                content: 'Database connection is not available.',
                components: []
            });
            return;
        }

        const [playerRows] = await pool.query(
            'SELECT playerUID FROM players WHERE playerName = ? LIMIT 1',
            [playerName]
        );

        if (playerRows.length === 0) {
            await interaction.editReply({
                content: 'Could not find player in database.',
                components: []
            });
            return;
        }

        const playerUUID = playerRows[0].playerUID;

        const newPage = direction === 'next' ? currentPageFromButton + 1 : currentPageFromButton - 1;
        
        let countQuery = 'SELECT COUNT(*) as total FROM rjs_playerkills WHERE killerBiId = ?';
        let queryParams = [playerUUID];
        
        if (showFriendlyFireOnly) {
            countQuery += ' AND (friendlyFire = true OR teamKill = true)';
        }
        
        const [countResult] = await pool.query(countQuery, queryParams);
        
        const totalKills = countResult[0].total;
        const killsPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(totalKills / killsPerPage));

        if (newPage < 1 || newPage > totalPages) {
            await interaction.editReply({
                content: 'Invalid page number.',
                components: []
            });
            return;
        }

        const offset = (newPage - 1) * killsPerPage;
        let killQuery = `SELECT victimName, victimBiId, weapon, distance, friendlyFire, teamKill, killType, timestamp, server_id
             FROM rjs_playerkills 
             WHERE killerBiId = ?`;
        
        let killQueryParams = [playerUUID];
        
        if (showFriendlyFireOnly) {
            killQuery += ' AND (friendlyFire = true OR teamKill = true)';
        }
        
        killQuery += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        killQueryParams.push(killsPerPage, offset);
        
        const [killRows] = await pool.query(killQuery, killQueryParams);

        const [mainPlayerRows] = await pool.query(
            'SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE playerUID = ?',
            [playerUUID]
        );

        const mainPlayer = mainPlayerRows[0];

        const killEmbed = createKillLogsEmbed(mainPlayer, killRows, searchValue, newPage, totalPages, totalKills, showFriendlyFireOnly);
        const killActionRow = createKillLogsActionRow(newPage, totalPages, showFriendlyFireOnly);

        await interaction.editReply({
            embeds: [killEmbed],
            components: [killActionRow]
        });

        logger.info(`[Whois KillLogs] Navigated to page ${newPage}/${totalPages} for player ${mainPlayer.playerName} (FF: ${showFriendlyFireOnly})`);

    } catch (error) {
        logger.error(`[Whois KillLogs Pagination] Error: ${error.message}`);
        await interaction.editReply({
            content: 'An error occurred while navigating kill logs.',
            components: []
        });
    }
}

async function handleKillLogsFriendlyFireToggle(interaction, serverInstance, originalMessage, buttonId) {
    try {
        const pageMatch = buttonId.match(/ff-(\d+)/);
        if (!pageMatch) {
            await interaction.editReply({
                content: 'Invalid friendly fire toggle button.',
                components: []
            });
            return;
        }

        const currentPage = parseInt(pageMatch[1], 10);
        
        const currentEmbed = originalMessage.embeds[0];
        const searchValue = currentEmbed.description.match(/🔍 Whois: (.+)/)[1];
        
        const isCurrentlyShowingFF = currentEmbed.title === 'Reforger Friendly Fire Logs';
        const newShowFriendlyFireOnly = !isCurrentlyShowingFF;
        
        const playerNameMatch = currentEmbed.description.match(/⚔️ Kill History for: ([^\n]+)|⚠️ Friendly Fire History for: ([^\n]+)/);
        
        if (!playerNameMatch) {
            await interaction.editReply({
                content: 'Could not extract player information.',
                components: []
            });
            return;
        }

        const playerName = (playerNameMatch[1] || playerNameMatch[2]).trim();
        
        const pool = process.mysqlPool || serverInstance.mysqlPool;
        if (!pool) {
            await interaction.editReply({
                content: 'Database connection is not available.',
                components: []
            });
            return;
        }

        const [playerRows] = await pool.query(
            'SELECT playerUID FROM players WHERE playerName = ? LIMIT 1',
            [playerName]
        );

        if (playerRows.length === 0) {
            await interaction.editReply({
                content: 'Could not find player in database.',
                components: []
            });
            return;
        }

        const playerUUID = playerRows[0].playerUID;

        let countQuery = 'SELECT COUNT(*) as total FROM rjs_playerkills WHERE killerBiId = ?';
        let queryParams = [playerUUID];
        
        if (newShowFriendlyFireOnly) {
            countQuery += ' AND (friendlyFire = true OR teamKill = true)';
        }
        
        const [countResult] = await pool.query(countQuery, queryParams);
        
        const totalKills = countResult[0].total;
        const killsPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(totalKills / killsPerPage));
        const resetPage = 1;

        const offset = (resetPage - 1) * killsPerPage;
        let killQuery = `SELECT victimName, victimBiId, weapon, distance, friendlyFire, teamKill, killType, timestamp, server_id
             FROM rjs_playerkills 
             WHERE killerBiId = ?`;
        
        let killQueryParams = [playerUUID];
        
        if (newShowFriendlyFireOnly) {
            killQuery += ' AND (friendlyFire = true OR teamKill = true)';
        }
        
        killQuery += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        killQueryParams.push(killsPerPage, offset);
        
        const [killRows] = await pool.query(killQuery, killQueryParams);

        const [mainPlayerRows] = await pool.query(
            'SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE playerUID = ?',
            [playerUUID]
        );

        const mainPlayer = mainPlayerRows[0];

        const killEmbed = createKillLogsEmbed(mainPlayer, killRows, searchValue, resetPage, totalPages, totalKills, newShowFriendlyFireOnly);
        const killActionRow = createKillLogsActionRow(resetPage, totalPages, newShowFriendlyFireOnly);

        await interaction.editReply({
            embeds: [killEmbed],
            components: [killActionRow]
        });

        logger.info(`[Whois KillLogs] Toggled friendly fire filter to ${newShowFriendlyFireOnly} for player ${mainPlayer.playerName} (${totalKills} total kills)`);

    } catch (error) {
        logger.error(`[Whois KillLogs FF Toggle] Error: ${error.message}`);
        await interaction.editReply({
            content: 'An error occurred while toggling friendly fire filter.',
            components: []
        });
    }
}

async function handleBackButton(interaction, originalMessage, serverInstance = null) {
    try {
        const currentEmbed = originalMessage.embeds[0];
        const searchValue = currentEmbed.description.match(/🔍 Whois: (.+)/)[1];
        
        let playerUUID;
        
        if (currentEmbed.title === 'Reforger **AltChecker') {
            const mainPlayerField = currentEmbed.fields.find(field => field.name === "Main Player");
            if (!mainPlayerField) {
                await interaction.editReply({
                    content: 'Could not restore original view.',
                    components: []
                });
                return;
            }

            const uuidMatch = mainPlayerField.value.match(/Reforger UUID: ([^\n]+)/);
            if (!uuidMatch) {
                await interaction.editReply({
                    content: 'Could not extract player information.',
                    components: []
                });
                return;
            }
            playerUUID = uuidMatch[1].trim();
        } else if (currentEmbed.title === 'Reforger Chat Logs') {
            const playerNameMatch = currentEmbed.description.match(/💬 Chat History for: ([^\n]+)/);
            if (!playerNameMatch) {
                await interaction.editReply({
                    content: 'Could not extract player information.',
                    components: []
                });
                return;
            }

            const playerName = playerNameMatch[1].trim();
            
            const pool = process.mysqlPool;
            if (!pool) {
                await interaction.editReply({
                    content: 'Database connection is not available.',
                    components: []
                });
                return;
            }

            const [playerRows] = await pool.query(
                'SELECT playerUID FROM players WHERE playerName = ? LIMIT 1',
                [playerName]
            );

            if (playerRows.length === 0) {
                await interaction.editReply({
                    content: 'Could not find player in database.',
                    components: []
                });
                return;
            }

            playerUUID = playerRows[0].playerUID;
        } else if (currentEmbed.title === 'Reforger Kill Logs' || currentEmbed.title === 'Reforger Friendly Fire Logs') {
            const playerNameMatch = currentEmbed.description.match(/⚔️ Kill History for: ([^\n]+)|⚠️ Friendly Fire History for: ([^\n]+)/);
            if (!playerNameMatch) {
                await interaction.editReply({
                    content: 'Could not extract player information.',
                    components: []
                });
                return;
            }

            const playerName = (playerNameMatch[1] || playerNameMatch[2]).trim();
            
            const pool = process.mysqlPool;
            if (!pool) {
                await interaction.editReply({
                    content: 'Database connection is not available.',
                    components: []
                });
                return;
            }

            const [playerRows] = await pool.query(
                'SELECT playerUID FROM players WHERE playerName = ? LIMIT 1',
                [playerName]
            );

            if (playerRows.length === 0) {
                await interaction.editReply({
                    content: 'Could not find player in database.',
                    components: []
                });
                return;
            }

            playerUUID = playerRows[0].playerUID;
        } else {
            await interaction.editReply({
                content: 'Unknown view to navigate back from.',
                components: []
            });
            return;
        }
        
        const pool = process.mysqlPool;
        if (!pool) {
            await interaction.editReply({
                content: 'Database connection is not available.',
                components: []
            });
            return;
        }

        const [playerRows] = await pool.query(
            'SELECT playerName, playerIP, playerUID, beGUID, steamID, device FROM players WHERE playerUID = ?',
            [playerUUID]
        );

        if (playerRows.length === 0) {
            await interaction.editReply({
                content: 'Could not find player in database.',
                components: []
            });
            return;
        }

        const player = playerRows[0];
        const mainEmbed = createMainPlayerEmbed(player, searchValue);
        
        let config = {};
        if (serverInstance && serverInstance.config) {
            config = serverInstance.config;
        } else if (process.config) {
            config = process.config;
        } else if (global.config) {
            config = global.config;
        }
        
        const mainActionRow = createMainActionRow(config);

        await interaction.editReply({
            embeds: [mainEmbed],
            components: [mainActionRow]
        });

        logger.info(`[Whois Back] Restored main view for player ${player.playerName}`);

    } catch (error) {
        logger.error(`[Whois Back] Error: ${error.message}`);
        await interaction.editReply({
            content: 'An error occurred while going back.',
            components: []
        });
    }
}