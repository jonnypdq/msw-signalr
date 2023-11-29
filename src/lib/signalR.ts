import { HttpHandler, HttpResponse, delay, http } from "msw";
import {
  BAD_REQUEST,
  CLOSE,
  NOT_FOUND,
  NOT_IMPLEMENTED,
  PING,
  SEND,
} from "./constants";
import { negotiate } from "./negotiate";
import {
  SignalRMessage,
  eventStreamEncoderStream,
  keepAliveStream,
  signalRencoderStream,
  write,
} from "./streams";

type Connection = {
  key: string;
  id: string;
  stream: TransformStream<SignalRMessage, Record<string, unknown>>;
  send(target: string, ...args: unknown[]): Promise<void>;
  close(): Promise<void>;
};

export default function (
  hubUrl: string,
  options: { keepAliveInterval?: number; delay?: typeof delay } = {}
): {
  connections: Map<string, Connection>;
  broadcast(target: string, ...args: unknown[]): void;
  handlers: HttpHandler[];
} {
  const connections = new Map<string, Connection>();

  const findConnection = (request: Request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    return id !== null ? connections.get(id) : undefined;
  };

  return {
    connections,
    broadcast(target, ...args) {
      connections.forEach((connection) => {
        connection.send(target, ...args).catch(console.error);
      });
    },
    handlers: [
      http.post(`${hubUrl}/negotiate`, async ({ request }) => {
        await options.delay?.();

        const url = new URL(request.url);
        const requestedVersion = url.searchParams.get("negotiateVersion");

        // client needs to specify which version of the protocol they want to use
        if (requestedVersion === null)
          return new HttpResponse(null, { status: BAD_REQUEST });

        // unsupported version returns 400
        const version = Number.parseInt(requestedVersion);
        if (version !== 0 && version !== 1)
          return new HttpResponse(null, { status: BAD_REQUEST });

        // create and remember the connection
        // return the connectionId and available transports
        const response = negotiate(version);
        const key =
          response.negotiateVersion === 0
            ? response.connectionId
            : response.connectionToken;

        connections.set(key, {
          key,
          id: response.connectionId,
          stream: new TransformStream(),
          async send(target, ...args) {
            await write(this.stream.writable, {
              type: 1,
              target,
              arguments: args,
            });
          },
          async close() {
            await write(this.stream.writable, { type: CLOSE });
          },
        });
        return HttpResponse.json(response);
      }),

      http.get(hubUrl, async ({ request }) => {
        await options.delay?.();

        const connection = findConnection(request);
        if (!connection) return new HttpResponse(null, { status: NOT_FOUND });

        connection.stream = keepAliveStream(options.keepAliveInterval);
        return new HttpResponse(
          connection.stream.readable
            .pipeThrough(signalRencoderStream())
            .pipeThrough(eventStreamEncoderStream())
            .pipeThrough(new TextEncoderStream()),
          {
            headers: { "Content-Type": "text/event-stream" },
          }
        );
      }),

      http.post(hubUrl, async ({ request }) => {
        await options.delay?.();

        const connection = findConnection(request);
        if (!connection) return new HttpResponse(null, { status: NOT_FOUND });

        // eslint-disable-next-line no-control-regex
        const payload = (await request.text()).replace(/\x1e$/, "");
        let message: { protocol: string; version: number } | { type: number };
        try {
          const parsed = JSON.parse(payload) as unknown;
          if (isNegotiation(parsed) || isMessage(parsed)) message = parsed;
          else return new HttpResponse(null, { status: BAD_REQUEST });
        } catch {
          return new HttpResponse(null, { status: BAD_REQUEST });
        }
        if (
          isNegotiation(message) &&
          message.protocol.toUpperCase() === "JSON" &&
          [0, 1].includes(message.version)
        ) {
          return new HttpResponse();
        }
        if (isMessage(message)) {
          if (message.type === SEND) {
            return new HttpResponse(null, { status: NOT_IMPLEMENTED });
          }
          if (message.type === PING) {
            return new HttpResponse();
          }
          if (message.type === CLOSE) {
            await connection.stream.writable.close();
            connections.delete(connection.key);
            return new HttpResponse();
          }
        }
        return new HttpResponse(null, { status: BAD_REQUEST });
      }),
    ],
  };
}

const isNegotiation = (
  obj: unknown
): obj is { protocol: string; version: number } =>
  obj !== null &&
  typeof obj === "object" &&
  "protocol" in obj &&
  typeof obj.protocol === "string" &&
  "version" in obj &&
  typeof obj.version === "number";

const isMessage = (obj: unknown): obj is { type: number } =>
  obj !== null &&
  typeof obj === "object" &&
  "type" in obj &&
  typeof obj.type === "number";
