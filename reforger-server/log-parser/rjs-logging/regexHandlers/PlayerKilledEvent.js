// log-parser/rjs-logging/regexHandlers/PlayerKilledEvent.js
const { EventEmitter } = require('events');

class PlayerKilledEventHandler extends EventEmitter {
    constructor() {
        super();
       this.regex = /\[([^\]]+)\] PLAYER_KILLED = grenadeType = ([^,]+), victimName = ([^,]+), attachments = ([^,]*), sightName = ([^,]+), isTeamKill = (true|false), killerId = (\d+), killerBiId = ([^,]+), victimFaction = ([^,]+), killerFaction = ([^,]+), victimId = (\d+), weaponSource = ([^,]+), killerName = ([^,]+), isFriendlyFire = (true|false), weaponName = ([^,]+), weaponType = ([^,]+), victimBiId = ([^,]+), killDistance = ([0-9.]+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("PLAYER_KILLED =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const grenadeType = match[2];
            const victimName = match[3];
            const attachments = match[4].trim();
            const sightName = match[5];
            const isTeamKill = match[6] === 'true';
            const killerId = parseInt(match[7], 10);
            const killerBiId = match[8];
            const victimFaction = match[9];
            const killerFaction = match[10];
            const victimId = parseInt(match[11], 10);
            const weaponSource = match[12];
            const killerName = match[13];
            const isFriendlyFire = match[14] === 'true';
            const weaponName = match[15];
            const weaponType = match[16];
            const victimBiId = match[17];
            const killDistance = parseFloat(match[18]);
            
            this.emit('playerKilledEvent', { 
                timestamp,
                grenadeType,
                victimName,
                attachments,
                sightName,
                isTeamKill,
                killerId,
                killerBiId,
                victimFaction,
                killerFaction,
                victimId,
                weaponSource,
                killerName,
                isFriendlyFire,
                weaponName,
                weaponType,
                victimBiId,
                killDistance
            });
        }
    }
}

module.exports = PlayerKilledEventHandler;