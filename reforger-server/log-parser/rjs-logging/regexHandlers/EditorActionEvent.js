// log-parser/rjs-logging/regexHandlers/EditorActionEvent.js
const { EventEmitter } = require('events');

class EditorActionEventHandler extends EventEmitter {
    constructor() {
        super();
        this.regex = /\[([^\]]+)\] EDITOR_ACTION = (.+)/;
    }

    test(line) {
        return this.regex.test(line) && line.includes("EDITOR_ACTION =");
    }

    processLine(line) {
        const match = this.regex.exec(line);
        if (match) {
            const timestamp = match[1];
            const data = this.parseKeyValuePairs(match[2]);

            const playerId = data.playerId ? parseInt(data.playerId, 10) : null;
            const hoveredEntityComponentOwnerId = data.hoveredEntityComponentOwnerId ? parseInt(data.hoveredEntityComponentOwnerId, 10) : -1;

            const actionType = this.getActionType(data.action);
            const selectedEntities = this.parseSelectedEntities(
                data.selectedEntityComponentsNames,
                data.selectedEntityComponentsOwnersIds
            );

            this.emit('editorActionEvent', {
                timestamp,
                player: {
                    id: playerId,
                    name: data.playerName,
                    guid: data.playerGUID
                },
                action: {
                    type: data.action,
                    category: actionType
                },
                hoveredEntity: {
                    name: data.hoveredEntityComponentName === 'unknown' ? null : data.hoveredEntityComponentName,
                    ownerId: hoveredEntityComponentOwnerId === -1 ? null : hoveredEntityComponentOwnerId
                },
                selectedEntities: selectedEntities,
                raw: {
                    timestamp,
                    selectedEntityComponentsNames: data.selectedEntityComponentsNames,
                    hoveredEntityComponentOwnerId,
                    selectedEntityComponentsOwnersIds: data.selectedEntityComponentsOwnersIds,
                    action: data.action,
                    hoveredEntityComponentName: data.hoveredEntityComponentName,
                    playerName: data.playerName,
                    playerId,
                    playerGUID: data.playerGUID
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

    parseSelectedEntities(namesString, ownersString) {
        if (!namesString || namesString === 'unknown') {
            return [];
        }

        const names = namesString.split(',');
        const owners = ownersString.split(',');
        
        const entities = [];
        for (let i = 0; i < names.length; i++) {
            const name = names[i] ? names[i].trim() : null;
            const ownerId = owners[i] ? parseInt(owners[i].trim(), 10) : null;
            
            entities.push({
                name: name === 'unknown' ? null : name,
                ownerId: ownerId === -1 ? null : ownerId
            });
        }
        
        return entities;
    }

    getActionType(action) {
        if (action.includes('Delete')) {
            return 'Delete';
        } else if (action.includes('Move') || action.includes('Transform')) {
            return 'Transform';
        } else if (action.includes('Create') || action.includes('Place')) {
            return 'Create';
        } else if (action.includes('Edit') || action.includes('Modify')) {
            return 'Edit';
        } else if (action.includes('Select')) {
            return 'Selection';
        } else if (action.includes('Copy') || action.includes('Duplicate')) {
            return 'Copy';
        } else if (action.includes('Paste')) {
            return 'Paste';
        } else if (action.includes('Undo')) {
            return 'Undo';
        } else if (action.includes('Redo')) {
            return 'Redo';
        } else if (action.includes('Context')) {
            return 'Context';
        } else {
            return 'Other';
        }
    }
}

module.exports = EditorActionEventHandler;