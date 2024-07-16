import { HttpHandler, delay } from "msw";
import { Emitter } from "mitt";
import { SignalRMessage } from "./streams";
type Connection = {
    key: string;
    id: string;
    stream: TransformStream<SignalRMessage, Record<string, unknown>>;
    send(target: string, ...args: unknown[]): Promise<void>;
    complete(invocationId: string, result: unknown, error?: unknown): Promise<void>;
    close(): Promise<void>;
};
type SignalRInvoke = {
    connection: Connection;
    id?: string | undefined;
    target: string;
    parameters: unknown[];
};
type SignalREvents = {
    invoke: SignalRInvoke;
};
export default function (hubUrl: string, options?: {
    keepAliveInterval?: number;
    delay?: typeof delay;
}): {
    connections: Map<string, Connection>;
    server: Emitter<SignalREvents>;
    broadcast(target: string, ...args: unknown[]): void;
    handlers: HttpHandler[];
};
export {};
