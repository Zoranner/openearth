import {binaryInsert, stamp} from "./utils/shared";

export type EventCallback = (((...args: any[]) => boolean) | ((...args: any[]) => void));

export type EventCallbackStamp = EventCallback & { _openglobus_id?: number; _openglobus_priority?: number };

type EventCallbacks = Array<EventCallback>;
type EventCallbackHandler = { active: boolean; handlers: EventCallbacks };

export type EventsMap<T extends string[]> = {
    [K in T[number]]?: EventCallbackHandler
}

export type EventsHandler<T extends string[]> = Events<T> & EventsMap<T>;

export function createEvents<T extends string[]>(methodNames: T, sender?: any) {
    return new Events(methodNames, sender) as EventsHandler<T>;
}

/**
 * Base events class to handle custom events.
 * @class
 * @param {Array.<string>} [eventNames] - Event names that could be dispatched.
 * @param {*} [sender]
 */
export class Events<T extends string[]> {

    static __counter__: number = 0;

    protected __id: number;

    /**
     * Registered event names.
     * @protected
     * @type {T}
     */
    protected _eventNames: T;

    protected _sender: any;

    /**
     * Stop propagation flag
     * @protected
     * @type {boolean}
     */
    protected _stopPropagation: boolean;
    protected _stampCache: any;

    constructor(eventNames: T, sender?: any) {

        this.__id = Events.__counter__++;

        this._eventNames = [] as any;

        eventNames && this.registerNames(eventNames);

        this._sender = sender || this;

        this._stopPropagation = false;

        this._stampCache = {};
    }

    public bindSender(sender?: any) {
        this._sender = sender || this;
    }

    /**
     * Function that creates event object properties that would be dispatched.
     * @public
     * @param {Array.<string>} eventNames - Specified event names list.
     */
    public registerNames(eventNames: T): this {
        for (let i = 0; i < eventNames.length; i++) {
            (this as any)[eventNames[i]] = {
                active: true,
                handlers: []
            };
            this._eventNames.push(eventNames[i]);
        }
        return this;
    }

    protected _getStamp(name: string, id: number, ogid: number) {
        return `${name}_${id}_${ogid}`;
    }

    /**
     * Returns true if event callback has stamped.
     * @protected
     * @param {Object} name - Event identifier.
     * @param {Object} obj - Event callback.
     * @return {boolean} -
     */
    protected _stamp(name: string, obj: any) {
        let ogid = stamp(obj);
        let st = this._getStamp(name, this.__id, ogid);

        if (!this._stampCache[st]) {
            this._stampCache[st] = ogid;
            return true;
        }

        return false;
    }

    /**
     * Attach listener.
     * @public
     * @param {string} name - Event name to listen.
     * @param {EventCallback} callback - Event callback function.
     * @param {any} [sender] - Event callback function owner.
     * @param {number} [priority] - Priority of event callback.
     */
    public on(name: string, callback: EventCallback, sender?: any, priority: number = 0) {
        if (this._stamp(name, callback)) {
            if ((this as any)[name]) {
                let c = callback.bind(sender || this._sender) as EventCallbackStamp;
                c._openglobus_id = (callback as EventCallbackStamp)._openglobus_id;
                c._openglobus_priority = priority;
                binaryInsert((this as any)[name].handlers, c, (a: EventCallbackStamp, b: EventCallbackStamp) => {
                    return (b._openglobus_priority || 0) - (a._openglobus_priority || 0);
                });
            }
        }
    }

    /**
     * Stop listening event name with specified callback function.
     * @public
     * @param {string} name - Event name.
     * @param {EventCallback | null} callback - Attached  event callback.
     */
    public off(name: string, callback?: EventCallback | null) {
        if (callback) {
            let st = this._getStamp(name, this.__id, (callback as EventCallbackStamp)._openglobus_id!);
            if ((callback as EventCallbackStamp)._openglobus_id && this._stampCache[st]) {
                let h = (this as any)[name].handlers;
                let i = h.length;
                let indexToRemove = -1;
                while (i--) {
                    let hi = h[i];
                    if (hi._openglobus_id === (callback as EventCallbackStamp)._openglobus_id) {
                        indexToRemove = i;
                        break;
                    }
                }

                if (indexToRemove !== -1) {
                    h.splice(indexToRemove, 1);
                    this._stampCache[st] = undefined;
                    delete this._stampCache[st];
                }
            }
        }
    }

    /**
     * Dispatch event.
     * @public
     * @param {EventCallbackHandler} event - Event instance property that created by event name.
     * @param {Object} [args] - Callback parameters.
     */
    public dispatch(event: EventCallbackHandler | undefined, ...args: any[]) {
        let result = true;
        if (event && event.active && !this._stopPropagation) {
            let h = event.handlers.slice(0),
                i = h.length;
            while (i--) {
                if ((h[i] as any)(...args) === false) {
                    result = false;
                }
            }
        }
        this._stopPropagation = false;
        return result;
    }

    /**
     * Brakes events propagation.
     * @public
     */
    public stopPropagation() {
        this._stopPropagation = true;
    }

    /**
     * Removes all events.
     * @public
     */
    public clear() {
        for (let i = 0; i < this._eventNames.length; i++) {
            let e = (this as any)[this._eventNames[i]];
            e.handlers.length = 0;
            e.handlers = [];
        }
        this._eventNames.length = 0;
        this._eventNames = [] as any;
    }
}
