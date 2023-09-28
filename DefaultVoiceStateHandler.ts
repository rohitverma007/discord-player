import { ChannelType, VoiceState } from 'discord.js';
import { GuildQueue, GuildQueueEvent } from './manager';
import { Player } from './Player';
import { Util } from './utils/Util';

export class DefaultVoiceStateHandler {
  constructor(private player: Player) {}

  async handle(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (!queue || !queue.connection || !queue.channel) return;

    if (this.isMemberLeftChannel(oldState, newState)) {
      this.handleMemberLeftChannel(queue);
      return;
    }

    if (queue.options.pauseOnEmpty) {
      this.handlePauseOnEmpty(queue);
    }

    if (this.isMemberJoinedChannel(oldState, newState)) {
      this.handleMemberJoinedChannel(queue, oldState, newState);
    }

    if (this.isMemberLeftQueueChannel(oldState, newState, queue)) {
      this.handleMemberLeftQueueChannel(queue, oldState);
    }

    if (this.isMemberJoinedQueueChannel(newState, queue)) {
      this.handleMemberJoinedQueueChannel(queue, oldState);
    }

    if (this.isMemberSwitchedChannel(oldState, newState)) {
      this.handleMemberSwitchedChannel(queue, oldState, newState);
    }
  }

  private isMemberLeftChannel(oldState: VoiceState, newState: VoiceState) {
    return oldState.channelId && !newState.channelId && newState.member?.id === newState.guild.members.me?.id;
  }

  private handleMemberLeftChannel(queue: GuildQueue) {
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

  private isMemberJoinedChannel(oldState: VoiceState, newState: VoiceState) {
    return !oldState.channelId && newState.channelId && newState.member?.id === newState.guild.members.me?.id;
  }

  private handleMemberJoinedChannel(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (newState.serverMute != null && oldState.serverMute !== newState.serverMute) {
      queue.node.setPaused(newState.serverMute);
    } else if (newState.channel?.type === ChannelType.GuildStageVoice && newState.suppress != null && oldState.suppress !== newState.suppress) {
      queue.node.setPaused(newState.suppress);
      if (newState.suppress) {
        newState.guild.members.me?.voice.setRequestToSpeak(true).catch(Util.noop);
      }
    }
  }

  private isMemberLeftQueueChannel(oldState: VoiceState, newState: VoiceState, queue: GuildQueue) {
    return !newState.channelId && oldState.channelId === queue.channel.id;
  }

  private handleMemberLeftQueueChannel(queue: GuildQueue, oldState: VoiceState) {
    if (!Util.isVoiceEmpty(queue.channel)) return;
    const timeout = setTimeout(() => {
      if (!Util.isVoiceEmpty(queue.channel!)) return;
      if (!this.player.nodes.has(queue.guild.id)) return;
      if (queue.options.leaveOnEmpty) queue.delete();
      this.player.events.emit(GuildQueueEvent.emptyChannel, queue);
    }, queue.options.leaveOnEmptyCooldown || 0).unref();
    queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
  }

  private isMemberJoinedQueueChannel(newState: VoiceState, queue: GuildQueue) {
    return newState.channelId && newState.channelId === queue.channel.id;
  }

  private handleMemberJoinedQueueChannel(queue: GuildQueue, oldState: VoiceState) {
    const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
    const channelEmpty = Util.isVoiceEmpty(queue.channel);
    if (!channelEmpty && emptyTimeout) {
      clearTimeout(emptyTimeout);
      queue.timeouts.delete(`empty_${oldState.guild.id}`);
      this.player.events.emit(GuildQueueEvent.channelPopulate, queue);
    }
  }

  private isMemberSwitchedChannel(oldState: VoiceState, newState: VoiceState) {
    return oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;
  }

  private handleMemberSwitchedChannel(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (newState.member?.id === newState.guild.members.me?.id) {
      this.handleMemberSwitchedChannelAsBot(queue, oldState, newState);
    } else {
      this.handleMemberSwitchedChannelAsUser(queue, oldState, newState);
    }
  }

  private handleMemberSwitchedChannelAsBot(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (queue.connection && newState.member?.id === newState.guild.members.me?.id) queue.channel = newState.channel!;
    const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
    const channelEmpty = Util.isVoiceEmpty(queue.channel);
    if (!channelEmpty && emptyTimeout) {
      clearTimeout(emptyTimeout);
      queue.timeouts.delete(`empty_${oldState.guild.id}`);
      this.player.events.emit(GuildQueueEvent.channelPopulate, queue);
    } else {
      this.handleMemberLeftQueueChannel(queue, oldState);
    }
  }

  private handleMemberSwitchedChannelAsUser(queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
    if (newState.channelId !== queue.channel.id) {
      this.handleMemberLeftQueueChannel(queue, oldState);
    } else {
      this.handleMemberJoinedQueueChannel(queue, oldState);
    }
  }
}
