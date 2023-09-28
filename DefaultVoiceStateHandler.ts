import { ChannelType, VoiceState } from 'discord.js';
import { GuildQueue, GuildQueueEvent } from './manager';
import { Player } from './Player';
import { Util } from './utils/Util';

export class DefaultVoiceStateHandler {
  constructor(private player: Player) {}

  async handleVoiceState(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (!this.isValidState(queue)) return;

    if (this.isBotLeftVoiceChannel(oldState, newState)) {
      this.handleBotLeftVoiceChannel(queue);
      return;
    }

    if (queue.options.pauseOnEmpty) {
      this.handleVoiceChannelEmpty(queue);
    }

    if (this.isBotJoinedVoiceChannel(oldState, newState)) {
      this.handleBotJoinedVoiceChannel(queue, oldState, newState);
    }

    if (this.isBotLeftQueueChannel(oldState, newState, queue)) {
      this.handleBotLeftQueueChannel(queue, oldState);
    }

    if (this.isBotJoinedQueueChannel(newState, queue)) {
      this.handleBotJoinedQueueChannel(queue, oldState);
    }

    if (this.isBotSwitchedVoiceChannel(oldState, newState, queue)) {
      this.handleBotSwitchedVoiceChannel(queue, oldState, newState);
    }
  }

  private isValidState(queue: GuildQueue): boolean {
    return queue && queue.connection && queue.channel;
  }

  private isBotLeftVoiceChannel(oldState: VoiceState, newState: VoiceState): boolean {
    return oldState.channelId && !newState.channelId && newState.member?.id === newState.guild.members.me?.id;
  }

  private handleBotLeftVoiceChannel(queue: GuildQueue): void {
    try {
      queue.delete();
    } catch {
      /* noop */
    }
    this.player.events.emit(GuildQueueEvent.disconnect, queue);
  }

  private handleVoiceChannelEmpty(queue: GuildQueue): void {
    const isEmpty = Util.isVoiceEmpty(queue.channel);

    if (isEmpty) {
      this.pauseQueue(queue);
      if (queue.hasDebugger) {
        queue.debug('Voice channel is empty and options#pauseOnEmpty is true, pausing...');
      }
    } else {
      this.resumeQueue(queue);
    }
  }

  private pauseQueue(queue: GuildQueue): void {
    queue.node.setPaused(true);
    Reflect.set(queue, '__pausedOnEmpty', true);
  }

  private resumeQueue(queue: GuildQueue): void {
    if (Reflect.get(queue, '__pausedOnEmpty')) {
      queue.node.setPaused(false);
      Reflect.set(queue, '__pausedOnEmpty', false);
      if (queue.hasDebugger) {
        queue.debug('Voice channel is not empty and options#pauseOnEmpty is true, resuming...');
      }
    }
  }

  private isBotJoinedVoiceChannel(oldState: VoiceState, newState: VoiceState): boolean {
    return !oldState.channelId && newState.channelId && newState.member?.id === newState.guild.members.me?.id;
  }

  private handleBotJoinedVoiceChannel(queue: GuildQueue, oldState: VoiceState, newState: VoiceState): void {
    if (newState.serverMute != null && oldState.serverMute !== newState.serverMute) {
      queue.node.setPaused(newState.serverMute);
    } else if (newState.channel?.type === ChannelType.GuildStageVoice && newState.suppress != null && oldState.suppress !== newState.suppress) {
      queue.node.setPaused(newState.suppress);
      if (newState.suppress) {
        newState.guild.members.me?.voice.setRequestToSpeak(true).catch(Util.noop);
      }
    }
  }

  private isBotLeftQueueChannel(oldState: VoiceState, newState: VoiceState, queue: GuildQueue): boolean {
    return !newState.channelId && oldState.channelId === queue.channel.id;
  }

  private handleBotLeftQueueChannel(queue: GuildQueue, oldState: VoiceState): void {
    if (!Util.isVoiceEmpty(queue.channel)) return;
    const timeout = setTimeout(() => {
      if (!Util.isVoiceEmpty(queue.channel!)) return;
      if (!this.player.nodes.has(queue.guild.id)) return;
      if (queue.options.leaveOnEmpty) queue.delete();
      this.player.events.emit(GuildQueueEvent.emptyChannel, queue);
    }, queue.options.leaveOnEmptyCooldown || 0).unref();
    queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
  }

  private isBotJoinedQueueChannel(newState: VoiceState, queue: GuildQueue): boolean {
    return newState.channelId && newState.channelId === queue.channel.id;
  }

  private handleBotJoinedQueueChannel(queue: GuildQueue, oldState: VoiceState): void {
    const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
    const channelEmpty = Util.isVoiceEmpty(queue.channel);
    if (!channelEmpty && emptyTimeout) {
      clearTimeout(emptyTimeout);
      queue.timeouts.delete(`empty_${oldState.guild.id}`);
      this.player.events.emit(GuildQueueEvent.channelPopulate, queue);
    }
  }

  private isBotSwitchedVoiceChannel(oldState: VoiceState, newState: VoiceState, queue: GuildQueue): boolean {
    return oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;
  }

  private handleBotSwitchedVoiceChannel(queue: GuildQueue, oldState: VoiceState, newState: VoiceState): void {
    if (newState.member?.id === newState.guild.members.me?.id) {
      this.handleBotSwitchedVoiceChannelAsMember(queue, oldState, newState);
    } else {
      this.handleBotSwitchedVoiceChannelAsNonMember(queue, oldState, newState);
    }
  }

  private handleBotSwitchedVoiceChannelAsMember(queue: GuildQueue, oldState: VoiceState, newState: VoiceState): void {
    if (queue.connection && newState.member?.id === newState.guild.members.me?.id) queue.channel = newState.channel!;
    const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
    const channelEmpty = Util.isVoiceEmpty(queue.channel);
    if (!channelEmpty && emptyTimeout) {
      clearTimeout(emptyTimeout);
      queue.timeouts.delete(`empty_${oldState.guild.id}`);
      this.player.events.emit(GuildQueueEvent.channelPopulate, queue);
    } else {
      this.handleBotLeftQueueChannel(queue, oldState);
    }
  }

  private handleBotSwitchedVoiceChannelAsNonMember(queue: GuildQueue, oldState: VoiceState, newState: VoiceState): void {
    if (newState.channelId !== queue.channel.id) {
      this.handleBotLeftQueueChannel(queue, oldState);
    } else {
      this.handleBotJoinedQueueChannel(queue, oldState);
    }
  }
}
