const { EventEmitter } = require('events');

class BaseCaptureEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] BASE_CAPTURE = (.+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("BASE_CAPTURE =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const data = this.parseKeyValuePairs(match[2]);

            this.emit('baseCaptureEvent', {
                timestamp,
                factionKey: data.factionKey,
                baseName: data.baseName,
                factionName: data.factionName,
                raw: {
                    timestamp,
                    factionKey: data.factionKey,
                    baseName: data.baseName,
                    factionName: data.factionName
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
}

module.exports = BaseCaptureEventHandler;