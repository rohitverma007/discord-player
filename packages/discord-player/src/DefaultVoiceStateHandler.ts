import { ChannelType, VoiceState } from 'discord.js';
import { GuildQueue, GuildQueueEvent } from './manager';
import { Player } from './Player';
import { Util } from './utils/Util';

export class DefaultVoiceStateHandler {
    player: Player;
    queue: GuildQueue;
    oldState: VoiceState;
    newState: VoiceState;

    constructor(player: Player, queue: GuildQueue, oldState: VoiceState, newState: VoiceState) {
        this.player = player;
        this.queue = queue;
        this.oldState = oldState;
        this.newState = newState;
    }

    async handle() {
        if (!this.queue || !this.queue.connection || !this.queue.channel) return;

        if (this.oldState.channelId && !this.newState.channelId && this.newState.member?.id === this.newState.guild.members.me?.id) {
            try {
                this.queue.delete();
            } catch {
                /* noop */
            }
            return void this.player.events.emit(GuildQueueEvent.disconnect, this.queue);
        }

        if (this.queue.options.pauseOnEmpty) {
            const isEmpty = Util.isVoiceEmpty(this.queue.channel);

            if (isEmpty) {
                this.queue.node.setPaused(true);
                Reflect.set(this.queue, '__pausedOnEmpty', true);
                if (this.queue.hasDebugger) {
                    this.queue.debug('Voice channel is empty and options#pauseOnEmpty is true, pausing...');
                }
            } else {
                if (Reflect.get(this.queue, '__pausedOnEmpty')) {
                    this.queue.node.setPaused(false);
                    Reflect.set(this.queue, '__pausedOnEmpty', false);
                    if (this.queue.hasDebugger) {
                        this.queue.debug('Voice channel is not empty and options#pauseOnEmpty is true, resuming...');
                    }
                }
            }
        }

        if (!this.oldState.channelId && this.newState.channelId && this.newState.member?.id === this.newState.guild.members.me?.id) {
            if (this.newState.serverMute != null && this.oldState.serverMute !== this.newState.serverMute) {
                this.queue.node.setPaused(this.newState.serverMute);
            } else if (this.newState.channel?.type === ChannelType.GuildStageVoice && this.newState.suppress != null && this.oldState.suppress !== this.newState.suppress) {
                this.queue.node.setPaused(this.newState.suppress);
                if (this.newState.suppress) {
                    this.newState.guild.members.me?.voice.setRequestToSpeak(true).catch(Util.noop);
                }
            }
        }

        this.handleEmptyChannel();
        this.handleChannelPopulate();
        this.handleChannelChange();
    }

    handleEmptyChannel() {
        if (!this.newState.channelId && this.oldState.channelId === this.queue.channel.id) {
            if (!Util.isVoiceEmpty(this.queue.channel)) return;
            const timeout = setTimeout(() => {
                if (!Util.isVoiceEmpty(this.queue.channel!)) return;
                if (!this.player.nodes.has(this.queue.guild.id)) return;
                if (this.queue.options.leaveOnEmpty) this.queue.delete();
                this.player.events.emit(GuildQueueEvent.emptyChannel, this.queue);
            }, this.queue.options.leaveOnEmptyCooldown || 0).unref();
            this.queue.timeouts.set(`empty_${this.oldState.guild.id}`, timeout);
        }
    }

    handleChannelPopulate() {
        if (this.newState.channelId && this.newState.channelId === this.queue.channel.id) {
            const emptyTimeout = this.queue.timeouts.get(`empty_${this.oldState.guild.id}`);
            const channelEmpty = Util.isVoiceEmpty(this.queue.channel);
            if (!channelEmpty && emptyTimeout) {
                clearTimeout(emptyTimeout);
                this.queue.timeouts.delete(`empty_${this.oldState.guild.id}`);
                this.player.events.emit(GuildQueueEvent.channelPopulate, this.queue);
            }
        }
    }

    handleChannelChange() {
        if (this.oldState.channelId && this.newState.channelId && this.oldState.channelId !== this.newState.channelId) {
            if (this.newState.member?.id === this.newState.guild.members.me?.id) {
                if (this.queue.connection && this.newState.member?.id === this.newState.guild.members.me?.id) this.queue.channel = this.newState.channel!;
                const emptyTimeout = this.queue.timeouts.get(`empty_${this.oldState.guild.id}`);
                const channelEmpty = Util.isVoiceEmpty(this.queue.channel);
                if (!channelEmpty && emptyTimeout) {
                    clearTimeout(emptyTimeout);
                    this.queue.timeouts.delete(`empty_${this.oldState.guild.id}`);
                    this.player.events.emit(GuildQueueEvent.channelPopulate, this.queue);
                } else {
                    const timeout = setTimeout(() => {
                        if (this.queue.connection && !Util.isVoiceEmpty(this.queue.channel!)) return;
                        if (!this.player.nodes.has(this.queue.guild.id)) return;
                        if (this.queue.options.leaveOnEmpty) this.queue.delete();
                        this.player.events.emit(GuildQueueEvent.emptyChannel, this.queue);
                    }, this.queue.options.leaveOnEmptyCooldown || 0).unref();
                    this.queue.timeouts.set(`empty_${this.oldState.guild.id}`, timeout);
                }
            } else {
                this.handleOtherMemberChannelChange();
            }
        }
    }

    handleOtherMemberChannelChange() {
        if (this.newState.channelId !== this.queue.channel.id) {
            const channelEmpty = Util.isVoiceEmpty(this.queue.channel!);
            if (!channelEmpty) return;
            if (this.queue.timeouts.has(`empty_${this.oldState.guild.id}`)) return;
            const timeout = setTimeout(() => {
                if (!Util.isVoiceEmpty(this.queue.channel!)) return;
                if (!this.player.nodes.has(this.queue.guild.id)) return;
                if (this.queue.options.leaveOnEmpty) this.queue.delete();
                this.player.events.emit(GuildQueueEvent.emptyChannel, this.queue);
            }, this.queue.options.leaveOnEmptyCooldown || 0).unref();
            this.queue.timeouts.set(`empty_${this.oldState.guild.id}`, timeout);
        } else {
            const emptyTimeout = this.queue.timeouts.get(`empty_${this.oldState.guild.id}`);
            const channelEmpty = Util.isVoiceEmpty(this.queue.channel!);
            if (!channelEmpty && emptyTimeout) {
                clearTimeout(emptyTimeout);
                this.queue.timeouts.delete(`empty_${this.oldState.guild.id}`);
                this.player.events.emit(GuildQueueEvent.channelPopulate, this.queue);
            }
        }
    }
}