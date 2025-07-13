const { EventEmitter } = require('events');

class SquadListEventHandler extends EventEmitter {
    constructor() {
        super();
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

    processData(jsonData) {
        if (!jsonData || !jsonData.groups) {
            return;
        }

        const players = [];
        const timestamp = jsonData.lastUpdated || new Date().toISOString();

        jsonData.groups.forEach(group => {
            group.members.forEach(member => {
                players.push({
                    id: member.id,
                    name: member.name,
                    playerBiId: member.playerBiId,
                    platform: member.platform,
                    platformType: this.getPlatformType(member.platform),
                    rank: member.rank,
                    isLeader: member.isLeader,
                    groupId: group.groupId,
                    groupIndex: group.groupIndex,
                    groupName: group.name,
                    faction: group.faction,
                    radioFrequency: group.radioFrequency,
                    isPrivateGroup: group.isPrivate,
                    groupMemberCount: group.memberCount,
                    groupMaxMembers: group.maxMembers,
                    leaderId: group.leader ? group.leader.id : null,
                    leaderName: group.leader ? group.leader.name : null
                });
            });
        });

        this.emit('squadListEvent', {
            timestamp,
            summary: jsonData.summary,
            players,
            groups: jsonData.groups,
            raw: jsonData
        });
    }
}

module.exports = SquadListEventHandler;