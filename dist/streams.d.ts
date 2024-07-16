import { CLOSE, COMPLETE, PING, SEND } from "./constants";
export type SignalRMessage = Record<string, never> | {
    type: typeof PING | typeof CLOSE;
} | {
    type: typeof COMPLETE;
    invocationId: string;
    result: any;
    error?: string | undefined;
} | {
    type: typeof SEND;
    invocationId?: string;
    target: string;
    arguments: unknown[];
};
export declare const keepAliveStream: (keepAliveInterval?: number) => TransformStream<SignalRMessage, Record<string, unknown>>;
export declare const signalRencoderStream: () => TransformStream<Record<string, unknown>, string>;
export declare const eventStreamEncoderStream: () => TransformStream<string, string>;
export declare const write: <W>(stream: WritableStream<W>, chunk: W) => Promise<void>;
