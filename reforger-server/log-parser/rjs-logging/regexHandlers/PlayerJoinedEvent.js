// log-parser/rjs-logging/regexHandlers/PlayerJoinedEvent.js
const { EventEmitter } = require('events');

class PlayerJoinedEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] PLAYER_JOINED = (.+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("PLAYER_JOINED =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const data = this.parseKeyValuePairs(match[2]);

            const playerId = data.playerId ? parseInt(data.playerId, 10) : null;
            const platformType = this.getPlatformType(data.platform);

            this.emit('playerJoinedEvent', {
                timestamp,
                playerId,
                playerName: data.playerName,
                playerBiId: data.playerBiId,
                profileName: data.profileName,
                platform: data.platform,
                platformType,
                raw: {
                    timestamp,
                    playerBiId: data.playerBiId,
                    platform: data.platform,
                    playerName: data.playerName,
                    playerId,
                    profileName: data.profileName
                }
            });
        }
    }

    parseKeyValuePairs(dataString) {
        const result = {};
        // Match key = value pairs, where value can contain commas
        const regex = /(\w+)\s*=\s*([^,]+?)(?=\s*,\s*\w+\s*=|$)/g;
        let match;

        while ((match = regex.exec(dataString)) !== null) {
            const key = match[1];
            const value = match[2].trim();
            result[key] = value;
        }

        return result;
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
}

module.exports = PlayerJoinedEventHandler;