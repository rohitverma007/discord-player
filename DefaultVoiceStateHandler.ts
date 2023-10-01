import { ChannelType, VoiceState } from 'discord.js';
import { GuildQueue, GuildQueueEvent } from './manager';
import { Player } from './Player';
import { Util } from './utils/Util';

export class DefaultVoiceStateHandler {
    player: Player;
    queue: GuildQueue;

    constructor(player: Player, queue: GuildQueue) {
        this.player = player;
        this.queue = queue;
    }

    async handleVoiceState(oldState: VoiceState, newState: VoiceState) {
        if (!this.queue || !this.queue.connection || !this.queue.channel) return;

        if (this.isBotLeavingChannel(oldState, newState)) {
            this.handleBotLeavingChannel();
        }

        if (this.queue.options.pauseOnEmpty) {
            this.handlePauseOnEmpty();
        }

        if (this.isBotJoiningChannel(oldState, newState)) {
            this.handleBotJoiningChannel(oldState, newState);
        }

        if (this.isBotLeavingQueueChannel(oldState, newState)) {
            this.handleBotLeavingQueueChannel(oldState);
        }

        if (this.isBotJoiningQueueChannel(newState)) {
            this.handleBotJoiningQueueChannel(oldState);
        }

        if (this.isBotSwitchingChannel(oldState, newState)) {
            this.handleBotSwitchingChannel(oldState, newState);
        }
    }

    isBotLeavingChannel(oldState: VoiceState, newState: VoiceState) {
        return oldState.channelId && !newState.channelId && newState.member?.id === newState.guild.members.me?.id;
    }

    handleBotLeavingChannel() {
        try {
            this.queue.delete();
        } catch {
            /* noop */
        }
        return void this.player.events.emit(GuildQueueEvent.disconnect, this.queue);
    }

    handlePauseOnEmpty() {
        const isEmpty = Util.isVoiceEmpty(this.queue.channel);

        if (isEmpty) {
            this.pauseQueue();
        } else {
            this.resumeQueue();
        }
    }

    pauseQueue() {
        this.queue.node.setPaused(true);
        Reflect.set(this.queue, '__pausedOnEmpty', true);
        if (this.queue.hasDebugger) {
            this.queue.debug('Voice channel is empty and options#pauseOnEmpty is true, pausing...');
        }
    }

    resumeQueue() {
        if (Reflect.get(this.queue, '__pausedOnEmpty')) {
            this.queue.node.setPaused(false);
            Reflect.set(this.queue, '__pausedOnEmpty', false);
            if (this.queue.hasDebugger) {
                this.queue.debug('Voice channel is not empty and options#pauseOnEmpty is true, resuming...');
            }
        }
    }

    isBotJoiningChannel(oldState: VoiceState, newState: VoiceState) {
        return !oldState.channelId && newState.channelId && newState.member?.id === newState.guild.members.me?.id;
    }

    handleBotJoiningChannel(oldState: VoiceState, newState: VoiceState) {
        if (newState.serverMute != null && oldState.serverMute !== newState.serverMute) {
            this.queue.node.setPaused(newState.serverMute);
        } else if (newState.channel?.type === ChannelType.GuildStageVoice && newState.suppress != null && oldState.suppress !== newState.suppress) {
            this.queue.node.setPaused(newState.suppress);
            if (newState.suppress) {
                newState.guild.members.me?.voice.setRequestToSpeak(true).catch(Util.noop);
            }
        }
    }

    isBotLeavingQueueChannel(oldState: VoiceState, newState: VoiceState) {
        return !newState.channelId && oldState.channelId === this.queue.channel.id;
    }

    handleBotLeavingQueueChannel(oldState: VoiceState) {
        if (!Util.isVoiceEmpty(this.queue.channel)) return;
        const timeout = setTimeout(() => {
            if (!Util.isVoiceEmpty(this.queue.channel!)) return;
            if (!this.player.nodes.has(this.queue.guild.id)) return;
            if (this.queue.options.leaveOnEmpty) this.queue.delete();
            this.player.events.emit(GuildQueueEvent.emptyChannel, this.queue);
        }, this.queue.options.leaveOnEmptyCooldown || 0).unref();
        this.queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
    }

    isBotJoiningQueueChannel(newState: VoiceState) {
        return newState.channelId && newState.channelId === this.queue.channel.id;
    }

    handleBotJoiningQueueChannel(oldState: VoiceState) {
        const emptyTimeout = this.queue.timeouts.get(`empty_${oldState.guild.id}`);
        const channelEmpty = Util.isVoiceEmpty(this.queue.channel);
        if (!channelEmpty && emptyTimeout) {
            clearTimeout(emptyTimeout);
            this.queue.timeouts.delete(`empty_${oldState.guild.id}`);
            this.player.events.emit(GuildQueueEvent.channelPopulate, this.queue);
        }
    }

    isBotSwitchingChannel(oldState: VoiceState, newState: VoiceState) {
        return oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;
    }

    handleBotSwitchingChannel(oldState: VoiceState, newState: VoiceState) {
        if (newState.member?.id === newState.guild.members.me?.id) {
            this.handleBotSwitchingToNewChannel(oldState, newState);
        } else {
            this.handleOtherUserSwitchingChannel(oldState, newState);
        }
    }

    handleBotSwitchingToNewChannel(oldState: VoiceState, newState: VoiceState) {
        if (this.queue.connection && newState.member?.id === newState.guild.members.me?.id) this.queue.channel = newState.channel!;
        const emptyTimeout = this.queue.timeouts.get(`empty_${oldState.guild.id}`);
        const channelEmpty = Util.isVoiceEmpty(this.queue.channel);
        if (!channelEmpty && emptyTimeout) {
            clearTimeout(emptyTimeout);
            this.queue.timeouts.delete(`empty_${oldState.guild.id}`);
            this.player.events.emit(GuildQueueEvent.channelPopulate, this.queue);
        } else {
            this.handleEmptyChannel(oldState);
        }
    }

    handleOtherUserSwitchingChannel(oldState: VoiceState, newState: VoiceState) {
        if (newState.channelId !== this.queue.channel.id) {
            this.handleEmptyChannel(oldState);
        } else {
            this.handleBotJoiningQueueChannel(oldState);
        }
    }

    handleEmptyChannel(oldState: VoiceState) {
        const timeout = setTimeout(() => {
            if (this.queue.connection && !Util.isVoiceEmpty(this.queue.channel!)) return;
            if (!this.player.nodes.has(this.queue.guild.id)) return;
            if (this.queue.options.leaveOnEmpty) this.queue.delete();
            this.player.events.emit(GuildQueueEvent.emptyChannel, this.queue);
        }, this.queue.options.leaveOnEmptyCooldown || 0).unref();
        this.queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
    }
}