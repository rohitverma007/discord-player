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

  it('should handle member left channel', async () => {
    jest.spyOn(handler, 'handleMemberLeftChannel');
    await handler.handle(queue, oldState, newState);
    expect(handler.handleMemberLeftChannel).toHaveBeenCalled();
  });

  it('should handle pause on empty', async () => {
    jest.spyOn(handler, 'handlePauseOnEmpty');
    await handler.handle(queue, oldState, newState);
    expect(handler.handlePauseOnEmpty).toHaveBeenCalled();
  });

  it('should handle member joined channel', async () => {
    jest.spyOn(handler, 'handleMemberJoinedChannel');
    await handler.handle(queue, oldState, newState);
    expect(handler.handleMemberJoinedChannel).toHaveBeenCalled();
  });

  it('should handle member left queue channel', async () => {
    jest.spyOn(handler, 'handleMemberLeftQueueChannel');
    await handler.handle(queue, oldState, newState);
    expect(handler.handleMemberLeftQueueChannel).toHaveBeenCalled();
  });

  it('should handle member joined queue channel', async () => {
    jest.spyOn(handler, 'handleMemberJoinedQueueChannel');
    await handler.handle(queue, oldState, newState);
    expect(handler.handleMemberJoinedQueueChannel).toHaveBeenCalled();
  });

  it('should handle member switched channel', async () => {
    jest.spyOn(handler, 'handleMemberSwitchedChannel');
    await handler.handle(queue, oldState, newState);
    expect(handler.handleMemberSwitchedChannel).toHaveBeenCalled();
  });
});
