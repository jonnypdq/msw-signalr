import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { setupServer } from "msw/node";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import signalR from "./signalR";

const hubUrl = "http://localhost/hub";
const hub = signalR(hubUrl);
const server = setupServer(...hub.handlers);
const builder = new HubConnectionBuilder()
  .withUrl(hubUrl)
  .configureLogging(LogLevel.Error);
hub.server.on('invoke', ({connection, id, target, parameters}) => {
  if (target === "add") {
    let result = null, error = null;
    let [x, y] = parameters;
    if (typeof(x) === 'number' && typeof(y) === 'number') {
      result = x + y;
    } else {
      error = "Arguments must be numbers";
    }

    if (id) {
      connection.complete(id, result, error);
    }
  }
})

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  return () => {
    server.close();
  };
});

afterEach(() => {
  server.resetHandlers();
});

describe("signalR handler", () => {
  it("can negotiate a connection with the client", async () => {
    const connection = builder.build();
    await connection.start();
    expect(connection.state).toBe(HubConnectionState.Connected);
  });

  it("disconnects gracefully", async () => {
    const connection = builder.build();
    await connection.start();
    await connection.stop();
    expect(connection.state).toBe(HubConnectionState.Disconnected);
  });

  it("can send messages", async () => {
    const connection = builder.build();

    const received = new Promise<unknown[]>((res) => {
      connection.on("test", (...args) => {
        res(args);
      });
    });
    await connection.start();
    hub.connections.forEach((c) => {
      c.send("test", "hello", "world").catch(console.error);
    });
    expect(await received).toStrictEqual(["hello", "world"]);
  });

  it("can send messages to multiple receivers", async () => {
    const connections = [builder.build(), builder.build()];
    const received = connections.map(
      (c) =>
        new Promise<unknown[]>((res) => {
          c.on("test", (...args) => {
            res(args);
          });
        })
    );
    for (const c of connections) {
      await c.start();
    }

    hub.connections.forEach((c) => {
      c.send("test", "hello", "world").catch(console.error);
    });
    for (const r of received) {
      expect(await r).toStrictEqual(["hello", "world"]);
    }
  });

  it("can handle an invocation", async () => {
    const connection = builder.build();
    await connection.start();
    let res = await connection.invoke("add", 40, 2);
    expect(res).toStrictEqual(42);

    res = await connection.invoke("add", 400, 9);
    expect(res).toStrictEqual(409);

    await expect(connection.invoke("add", 400, {junk: 100})).rejects.
      toThrow("must be numbers");
  });

  it("can handle an invocation without response", async () => {
    const connection = builder.build();
    await connection.start();
    let res = await connection.send("add", 40, 2);
    expect(res).toStrictEqual(undefined);
  });
});
