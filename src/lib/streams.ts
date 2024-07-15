import { CLOSE, DEFAULT_KEEPALIVE_INTERVAL, PING, SEND } from "./constants";

export type SignalRMessage =
  | Record<string, never>
  | { type: typeof PING | typeof CLOSE }
  | {
      type: typeof SEND;
      invocationId?: string;
      target: string;
      arguments: unknown[];
    };

export const keepAliveStream = (
  keepAliveInterval = DEFAULT_KEEPALIVE_INTERVAL
) => {
  let interval: number;

  return new TransformStream<SignalRMessage, Record<string, unknown>>({
    start(controller) {
      controller.enqueue({});
      interval = window.setInterval(
        () => { controller.enqueue({ type: PING }); },
        keepAliveInterval
      );
    },
    flush() {
      window.clearInterval(interval);
    },
  });
};

export const signalRencoderStream = () =>
  new TransformStream<Record<string, unknown>, string>({
    transform(chunk, controller) {
      controller.enqueue(JSON.stringify(chunk) + "\x1e");
    },
  });

export const eventStreamEncoderStream = () =>
  new TransformStream<string, string>({
    transform(chunk, controller) {
      controller.enqueue("data: " + chunk + "\n\n");
    },
  });

export const write = async <W>(stream: WritableStream<W>, chunk: W) => {
  const writer = stream.getWriter();
  await writer.ready;
  await writer.write(chunk);
  writer.releaseLock();
};
