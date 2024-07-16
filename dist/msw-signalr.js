import { http as y, HttpResponse as s } from "msw";
function k(e) {
  return { all: e = e || /* @__PURE__ */ new Map(), on: function(t, n) {
    var a = e.get(t);
    a ? a.push(n) : e.set(t, [n]);
  }, off: function(t, n) {
    var a = e.get(t);
    a && (n ? a.splice(a.indexOf(n) >>> 0, 1) : e.set(t, []));
  }, emit: function(t, n) {
    var a = e.get(t);
    a && a.slice().map(function(l) {
      l(n);
    }), (a = e.get("*")) && a.slice().map(function(l) {
      l(t, n);
    });
  } };
}
const L = 15e3, v = 1, O = 3, I = 6, T = 7, f = 400, h = 404;
function R(e) {
  const t = {
    connectionId: crypto.randomUUID(),
    availableTransports: [
      {
        transport: "ServerSentEvents",
        transferFormats: ["Text"]
      }
    ]
  };
  return e === 0 ? { ...t, negotiateVersion: 0 } : { ...t, negotiateVersion: 1, connectionToken: crypto.randomUUID() };
}
const U = (e = L) => {
  let t;
  return new TransformStream({
    start(n) {
      n.enqueue({}), t = window.setInterval(
        () => {
          n.enqueue({ type: I });
        },
        e
      );
    },
    flush() {
      window.clearInterval(t);
    }
  });
}, x = () => new TransformStream({
  transform(e, t) {
    t.enqueue(JSON.stringify(e) + "");
  }
}), V = () => new TransformStream({
  transform(e, t) {
    t.enqueue("data: " + e + `

`);
  }
}), g = async (e, t) => {
  const n = e.getWriter();
  await n.ready, await n.write(t), n.releaseLock();
};
function D(e, t = {}) {
  const n = /* @__PURE__ */ new Map(), a = k(), l = (c) => {
    const i = new URL(c.url).searchParams.get("id");
    return i !== null ? n.get(i) : void 0;
  };
  return {
    connections: n,
    server: a,
    broadcast(c, ...o) {
      n.forEach((i) => {
        i.send(c, ...o).catch(console.error);
      });
    },
    handlers: [
      y.post(`${e}/negotiate`, async ({ request: c }) => {
        var w;
        await ((w = t.delay) == null ? void 0 : w.call(t));
        const i = new URL(c.url).searchParams.get("negotiateVersion");
        if (i === null)
          return new s(null, { status: f });
        const u = Number.parseInt(i);
        if (u !== 0 && u !== 1)
          return new s(null, { status: f });
        const r = R(u), m = r.negotiateVersion === 0 ? r.connectionId : r.connectionToken;
        return n.set(m, {
          key: m,
          id: r.connectionId,
          stream: new TransformStream(),
          async send(p, ...d) {
            await g(this.stream.writable, {
              type: v,
              target: p,
              arguments: d
            });
          },
          async complete(p, d, N) {
            await g(this.stream.writable, {
              type: O,
              invocationId: p,
              result: d,
              error: N
            });
          },
          async close() {
            await g(this.stream.writable, { type: T });
          }
        }), s.json(r);
      }),
      y.get(e, async ({ request: c }) => {
        var i;
        await ((i = t.delay) == null ? void 0 : i.call(t));
        const o = l(c);
        return o ? (o.stream = U(t.keepAliveInterval), new s(
          o.stream.readable.pipeThrough(x()).pipeThrough(V()).pipeThrough(new TextEncoderStream()),
          {
            headers: { "Content-Type": "text/event-stream" }
          }
        )) : new s(null, { status: h });
      }),
      y.post(e, async ({ request: c }) => {
        var m;
        await ((m = t.delay) == null ? void 0 : m.call(t));
        const o = l(c);
        if (!o) return new s(null, { status: h });
        const i = (await c.text()).replace(/\x1e$/, "");
        let u, r = {};
        try {
          if (r = JSON.parse(i), S(r) || E(r)) u = r;
          else return new s(null, { status: f });
        } catch {
          return new s(null, { status: f });
        }
        if (S(u) && u.protocol.toUpperCase() === "JSON" && [0, 1].includes(u.version))
          return new s();
        if (E(u)) {
          if (r.type === v) {
            let w = r.invocationId;
            return a.emit("invoke", {
              connection: o,
              target: r.target,
              id: w,
              parameters: r.arguments
            }), new s();
          }
          if (r.type === I)
            return new s();
          if (r.type === T)
            return await o.stream.writable.close(), n.delete(o.key), new s();
        }
        return new s(null, { status: f });
      })
    ]
  };
}
const S = (e) => e !== null && typeof e == "object" && "protocol" in e && typeof e.protocol == "string" && "version" in e && typeof e.version == "number", E = (e) => e !== null && typeof e == "object" && "type" in e && typeof e.type == "number";
export {
  D as signalRHub
};
