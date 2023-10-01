import { DefaultVoiceStateHandler } from '../DefaultVoiceStateHandler';
import { VoiceState } from 'discord.js';
import { GuildQueue } from '../manager';
import { Player } from '../Player';

describe('DefaultVoiceStateHandler', () => {
    let handler: DefaultVoiceStateHandler;
    let player: Player;
    let queue: GuildQueue;

    beforeEach(() => {
        player = new Player();
        queue = new GuildQueue();
        handler = new DefaultVoiceStateHandler(player, queue);
    });

    it('should handle bot leaving channel', () => {
        const oldState = new VoiceState();
        const newState = new VoiceState();
        oldState.channelId = '123';
        newState.channelId = null;
        newState.member.id = 'botId';
        newState.guild.members.me.id = 'botId';
        handler.handleVoiceState(oldState, newState);
        expect(queue.delete).toHaveBeenCalled();
        expect(player.events.emit).toHaveBeenCalledWith('disconnect', queue);
    });

    // Add more tests here
});