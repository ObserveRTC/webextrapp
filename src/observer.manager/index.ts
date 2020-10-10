import IntervalWorker from '../observer.interval.worker'
import logger from '../observer.logger'
import ObserverPC, { IUserConfig } from '../observer.pc'
import { ObserverPlugin } from '../observer.plugins/base.plugin'
import ConnectionMonitor from '../observer.plugins/internal/connection.monitor.plugin'

abstract class IObserver {
    public abstract addPC(pc: RTCPeerConnection, callId?: string, userId?: string): void
    public abstract resumePC(currentPC: ObserverPC): void
    public abstract pausePC(currentPC: ObserverPC): void
    public abstract attachPlugin(plugin: ObserverPlugin): void
    public abstract disposePC(currentPC: ObserverPC): void
    public abstract getPcList(): ObserverPC[]
}

class Observer implements IObserver{
    private pcList: ObserverPC[] = []
    private pluginList: ObserverPlugin[] = [
        // internal plugins
        new ConnectionMonitor(),
    ]

    // @ts-ignore
    private intervalWorker: IntervalWorker = new IntervalWorker(parseInt(typeof POOLING_INTERVAL_MS === 'undefined' ? 1000 : POOLING_INTERVAL_MS, 10))

    constructor() {
        // @ts-ignore
        console.info('using library version', LIBRARY_VERSION)
    }

    public attachPlugin(plugin: ObserverPlugin): void {
        if ( this.pluginList.find(item => item.id === plugin.id) ) {
            logger.warn('this plugin already attached. omitting re-adding!')
            return
        }
        this.pluginList.push(plugin)
    }

    public addPC(pc: RTCPeerConnection, callId?: string, userId?: string) {
        const userConfig = {
            callId,
            pc,
            userId
        } as IUserConfig
        const currentPC = new ObserverPC(userConfig)
        this.pcList.push( currentPC )
        // call private subscribe manager
        this.subscribe(currentPC)
    }

    public resumePC(currentPC: ObserverPC): void {
        // call private subscribe manager
        this.subscribe(currentPC)
    }

    public pausePC(currentPC: ObserverPC): void {
        currentPC?.dispose()
    }

    public disposePC(currentPC?: ObserverPC) {
        if (currentPC) {
            currentPC.dispose()
            this.pcList = this.pcList.filter( (pc: ObserverPC) => pc.id !== currentPC.id )
            return
        }
        for (const currentPc of this.pcList) {
            currentPc.dispose()
        }
        this.pcList = []
    }

    public getPcList(): ObserverPC[] {
        return this.pcList
    }

    // private helper method
    private subscribe(currentPC: ObserverPC) {
        // is already subscribed
        if (currentPC.subscription) {
            logger.warn('already subscribed. disposing first and resuming', currentPC?.id)
            this.disposePC(currentPC)
        }
        const worker = currentPC.run.bind(currentPC, this.pluginList)
        const currentSubscriber = this.intervalWorker.subscribe(worker)
        currentPC.addSubscription(currentSubscriber)
    }

}

export default Observer