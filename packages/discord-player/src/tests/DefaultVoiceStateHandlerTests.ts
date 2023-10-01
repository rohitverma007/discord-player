import { DefaultVoiceStateHandler } from '../DefaultVoiceStateHandler';
import { Player } from '../Player';
import { GuildQueue } from '../manager';
import { VoiceState } from 'discord.js';

describe('DefaultVoiceStateHandler', () => {
    let player: Player;
    let queue: GuildQueue;
    let oldState: VoiceState;
    let newState: VoiceState;
    let handler: DefaultVoiceStateHandler;

    beforeEach(() => {
        player = new Player();
        queue = new GuildQueue();
        oldState = new VoiceState();
        newState = new VoiceState();
        handler = new DefaultVoiceStateHandler(player, queue, oldState, newState);
    });

    it('should handle voice state changes', async () => {
        await handler.handle();
        expect(queue.delete).toHaveBeenCalled();
    });

    it('should handle empty channel', () => {
        handler.handleEmptyChannel();
        expect(queue.delete).toHaveBeenCalled();
    });

    it('should handle channel populate', () => {
        handler.handleChannelPopulate();
        expect(queue.delete).toHaveBeenCalled();
    });

    it('should handle channel change', () => {
        handler.handleChannelChange();
        expect(queue.delete).toHaveBeenCalled();
    });

    it('should handle other member channel change', () => {
        handler.handleOtherMemberChannelChange();
        expect(queue.delete).toHaveBeenCalled();
    });
});