type ProtocolVersion = 0 | 1;
type NegotiateResponse = {
    negotiateVersion: 0;
    connectionId: string;
    availableTransports: Transport[];
} | {
    negotiateVersion: 1;
    connectionId: string;
    availableTransports: Transport[];
    connectionToken: string;
};
type Transport = {
    transport: "LongPolling" | "ServerSentEvents" | "WebSockets";
    transferFormats: readonly ("Text" | "Binary")[];
};
export type HandshakeRequest = {
    protocol: "messagepack" | "json";
    version: 1;
};
export type HandshakeResponse = {
    protocol: "json";
    version: 1;
};
export declare function negotiate(version: ProtocolVersion): NegotiateResponse;
export {};
