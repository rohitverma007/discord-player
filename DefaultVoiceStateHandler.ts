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
      this.handlePauseOnEmpty(queue);
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

    if (this.isBotSwitchedChannel(oldState, newState, queue)) {
      this.handleBotSwitchedChannel(queue, oldState, newState);
    }
  }

  private isValidState(queue: GuildQueue) {
    return queue && queue.connection && queue.channel;
  }

  private isBotLeftVoiceChannel(oldState: VoiceState, newState: VoiceState) {
    return oldState.channelId && !newState.channelId && newState.member?.id === newState.guild.members.me?.id;
  }

  private handleBotLeftVoiceChannel(queue: GuildQueue) {
    try {
      queue.delete();
    } catch {
      /* noop */
    }
    this.player.events.emit(GuildQueueEvent.disconnect, queue);
  }

  private handlePauseOnEmpty(queue: GuildQueue) {
    const isEmpty = Util.isVoiceEmpty(queue.channel);

    if (isEmpty) {
      this.pauseQueue(queue);
    } else {
      this.resumeQueue(queue);
    }
  }

  private pauseQueue(queue: GuildQueue) {
    queue.node.setPaused(true);
    Reflect.set(queue, '__pausedOnEmpty', true);
    this.debugQueue(queue, 'Voice channel is empty and options#pauseOnEmpty is true, pausing...');
  }

  private resumeQueue(queue: GuildQueue) {
    if (Reflect.get(queue, '__pausedOnEmpty')) {
      queue.node.setPaused(false);
      Reflect.set(queue, '__pausedOnEmpty', false);
      this.debugQueue(queue, 'Voice channel is not empty and options#pauseOnEmpty is true, resuming...');
    }
  }

  private debugQueue(queue: GuildQueue, message: string) {
    if (queue.hasDebugger) {
      queue.debug(message);
    }
  }

  private isBotJoinedVoiceChannel(oldState: VoiceState, newState: VoiceState) {
    return !oldState.channelId && newState.channelId && newState.member?.id === newState.guild.members.me?.id;
  }

  private handleBotJoinedVoiceChannel(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (newState.serverMute != null && oldState.serverMute !== newState.serverMute) {
      queue.node.setPaused(newState.serverMute);
    } else if (newState.channel?.type === ChannelType.GuildStageVoice && newState.suppress != null && oldState.suppress !== newState.suppress) {
      this.handleBotJoinedStageVoice(queue, newState);
    }
  }

  private handleBotJoinedStageVoice(queue: GuildQueue, newState: VoiceState) {
    queue.node.setPaused(newState.suppress);
    if (newState.suppress) {
      newState.guild.members.me?.voice.setRequestToSpeak(true).catch(Util.noop);
    }
  }

  private isBotLeftQueueChannel(oldState: VoiceState, newState: VoiceState, queue: GuildQueue) {
    return !newState.channelId && oldState.channelId === queue.channel.id;
  }

  private handleBotLeftQueueChannel(queue: GuildQueue, oldState: VoiceState) {
    if (!Util.isVoiceEmpty(queue.channel)) return;
    const timeout = this.setTimeout(queue, oldState, GuildQueueEvent.emptyChannel);
    queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
  }

  private isBotJoinedQueueChannel(newState: VoiceState, queue: GuildQueue) {
    return newState.channelId && newState.channelId === queue.channel.id;
  }

  private handleBotJoinedQueueChannel(queue: GuildQueue, oldState: VoiceState) {
    const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
    const channelEmpty = Util.isVoiceEmpty(queue.channel);
    if (!channelEmpty && emptyTimeout) {
      clearTimeout(emptyTimeout);
      queue.timeouts.delete(`empty_${oldState.guild.id}`);
      this.player.events.emit(GuildQueueEvent.channelPopulate, queue);
    }
  }

  private isBotSwitchedChannel(oldState: VoiceState, newState: VoiceState, queue: GuildQueue) {
    return oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;
  }

  private handleBotSwitchedChannel(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (newState.member?.id === newState.guild.members.me?.id) {
      this.handleBotSwitchedChannelAsMember(queue, oldState, newState);
    } else {
      this.handleBotSwitchedChannelAsNonMember(queue, oldState, newState);
    }
  }

  private handleBotSwitchedChannelAsMember(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (queue.connection && newState.member?.id === newState.guild.members.me?.id) queue.channel = newState.channel!;
    const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
    const channelEmpty = Util.isVoiceEmpty(queue.channel);
    if (!channelEmpty && emptyTimeout) {
      clearTimeout(emptyTimeout);
      queue.timeouts.delete(`empty_${oldState.guild.id}`);
      this.player.events.emit(GuildQueueEvent.channelPopulate, queue);
    } else {
      const timeout = this.setTimeout(queue, oldState, GuildQueueEvent.emptyChannel);
      queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
    }
  }

  private handleBotSwitchedChannelAsNonMember(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (newState.channelId !== queue.channel.id) {
      this.handleBotSwitchedToNonQueueChannel(queue, oldState);
    } else {
      this.handleBotSwitchedToQueueChannel(queue, oldState);
    }
  }

  private handleBotSwitchedToNonQueueChannel(queue: GuildQueue, oldState: VoiceState) {
    const channelEmpty = Util.isVoiceEmpty(queue.channel!);
    if (!channelEmpty) return;
    if (queue.timeouts.has(`empty_${oldState.guild.id}`)) return;
    const timeout = this.setTimeout(queue, oldState, GuildQueueEvent.emptyChannel);
    queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
  }

  private handleBotSwitchedToQueueChannel(queue: GuildQueue, oldState: VoiceState) {
    const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
    const channelEmpty = Util.isVoiceEmpty(queue.channel!);
    if (!channelEmpty && emptyTimeout) {
      clearTimeout(emptyTimeout);
      queue.timeouts.delete(`empty_${oldState.guild.id}`);
      this.player.events.emit(GuildQueueEvent.channelPopulate, queue);
    }
  }

  private setTimeout(queue: GuildQueue, oldState: VoiceState, event: GuildQueueEvent) {
    return setTimeout(() => {
      if (queue.connection && !Util.isVoiceEmpty(queue.channel!)) return;
      if (!this.player.nodes.has(queue.guild.id)) return;
      if (queue.options.leaveOnEmpty) queue.delete();
      this.player.events.emit(event, queue);
    }, queue.options.leaveOnEmptyCooldown || 0).unref();
  }
}