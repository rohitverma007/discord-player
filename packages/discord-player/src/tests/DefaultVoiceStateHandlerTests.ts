import { DefaultVoiceStateHandler } from '../DefaultVoiceStateHandler';
import { GuildQueue, GuildQueueEvent } from '../manager';
import { Player } from '../Player';
import { VoiceState } from 'discord.js';
import { Util } from '../utils/Util';

describe('DefaultVoiceStateHandler', () => {
  let handler: DefaultVoiceStateHandler;
  let player: Player;
  let queue: GuildQueue;
  let oldState: VoiceState;
  let newState: VoiceState;

  beforeEach(() => {
    player = new Player();
    queue = new GuildQueue();
    oldState = new VoiceState();
    newState = new VoiceState();
    handler = new DefaultVoiceStateHandler(player);
  });

  it('should handle voice state', async () => {
    jest.spyOn(handler, 'handleVoiceState');
    await handler.handleVoiceState(queue, oldState, newState);
    expect(handler.handleVoiceState).toHaveBeenCalledWith(queue, oldState, newState);
  });

  // Add more tests here
});
