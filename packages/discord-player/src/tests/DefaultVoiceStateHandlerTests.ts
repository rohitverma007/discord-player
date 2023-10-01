import { DefaultVoiceStateHandler } from '../DefaultVoiceStateHandler';
import { Player } from '../Player';
import { VoiceState } from 'discord.js';

describe('DefaultVoiceStateHandler', () => {
  let handler: DefaultVoiceStateHandler;
  let player: Player;

  beforeEach(() => {
    player = new Player();
    handler = new DefaultVoiceStateHandler(player);
  });

  it('should handle voice state update', () => {
    const oldState = new VoiceState();
    const newState = new VoiceState();

    handler.handleVoiceStateUpdate(oldState, newState);

    expect(player.handleVoiceStateUpdate).toHaveBeenCalledWith(oldState, newState);
  });

  it('should not handle voice state update if state did not change', () => {
    const oldState = new VoiceState();
    oldState.channelID = 'same';
    const newState = new VoiceState();
    newState.channelID = 'same';

    handler.handleVoiceStateUpdate(oldState, newState);

    expect(player.handleVoiceStateUpdate).not.toHaveBeenCalled();
  });
});