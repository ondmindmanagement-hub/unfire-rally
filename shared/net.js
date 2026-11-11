/* Unfire Rally · net.js — TV (host) <-> phone controllers.
   Two transports, same API:
   - 'peer'  : WebRTC DataChannel via PeerJS (MIT). Only the tiny signalling handshake uses the public PeerJS broker;
               all motion data then flows peer-to-peer, normally inside the local Wi-Fi (lowest latency).
   - 'local' : BroadcastChannel between tabs of the same browser (development / automated QA, zero network).
   Messages are small JSON objects. Unreliable-ordered channel would be ideal; PeerJS reliable is fine at <50 msg/s. */
(function () {
  const PREFIX = 'unfire-rally-';
  const code = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

  class Host {
    constructor({ onJoin, onLeave, onMsg, transport }) {
      this.onJoin = onJoin; this.onLeave = onLeave; this.onMsg = onMsg;
      this.players = new Map(); // id -> {conn, slot, name}
      this.code = code(); this.transport = transport || (location.search.includes('local') ? 'local' : 'peer');
      if (this.transport === 'local') this._local(); else this._peer();
    }
    _slot() { for (let s = 0; s < 4; s++) if (![...this.players.values()].some(p => p.slot === s)) return s; return -1; }
    _add(id, send, name) {
      const slot = this._slot(); if (slot < 0) { send({ t: 'full' }); return; }
      this.players.set(id, { send, slot, name }); send({ t: 'welcome', slot, code: this.code });
      this.onJoin && this.onJoin(slot, name || 'Jugador ' + (slot + 1));
    }
    _drop(id) { const p = this.players.get(id); if (!p) return; this.players.delete(id); this.onLeave && this.onLeave(p.slot); }
    _in(id, m, send) {
      if (m.t === 'hello') return this._add(id, send, String(m.name || '').slice(0, 16));
      const p = this.players.get(id); if (!p) return;
      if (m.t === 'ping') return send({ t: 'pong', c: m.c });
      this.onMsg && this.onMsg(p.slot, m);
    }
    sendTo(slot, m) { for (const p of this.players.values()) if (p.slot === slot) p.send(m); }
    broadcast(m) { for (const p of this.players.values()) p.send(m); }
    _local() {
      this.ready = Promise.resolve(this.code);
      this.bc = new BroadcastChannel(PREFIX + this.code);
      this.bc.onmessage = (e) => { const { from, m } = e.data || {}; if (!from || e.data.to !== 'host') return; this._in(from, m, (x) => this.bc.postMessage({ to: from, m: x })); };
    }
    _peer() {
      this.ready = new Promise((res, rej) => {
        this.peer = new Peer(PREFIX + this.code, { debug: 0 });
        this.peer.on('open', () => res(this.code));
        this.peer.on('error', (e) => { if (e.type === 'unavailable-id') { this.code = code(); this.peer.destroy(); this._peer(); this.ready.then(res); } else rej(e); });
        this.peer.on('connection', (c) => {
          c.on('data', (m) => this._in(c.peer, m, (x) => c.open && c.send(x)));
          c.on('close', () => this._drop(c.peer)); c.on('error', () => this._drop(c.peer));
        });
      });
    }
  }

  class Pad {
    constructor({ code, name, onMsg, onState, transport }) {
      this.code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); this.name = name; this.onMsg = onMsg; this.onState = onState;
      this.id = 'pad-' + Math.random().toString(36).slice(2, 10); this.rtt = 0;
      this.transport = transport || (location.search.includes('local') ? 'local' : 'peer');
      this.transport === 'local' ? this._local() : this._peer();
      setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
    }
    _in(m) { if (m.t === 'pong') { this.rtt = performance.now() - m.c; return; } this.onMsg && this.onMsg(m); }
    _local() {
      this.bc = new BroadcastChannel(PREFIX + this.code);
      this.bc.onmessage = (e) => { if (e.data && e.data.to === this.id) this._in(e.data.m); };
      this.send = (m) => this.bc.postMessage({ to: 'host', from: this.id, m });
      setTimeout(() => { this.send({ t: 'hello', name: this.name }); this.onState && this.onState('open'); }, 50);
    }
    _peer() {
      this.send = () => {};
      this.onState && this.onState('connecting');
      this.peer = new Peer(undefined, { debug: 0 });
      this.peer.on('open', () => {
        const c = this.peer.connect(PREFIX + this.code, { reliable: true });
        c.on('open', () => { this.send = (m) => c.open && c.send(m); this.send({ t: 'hello', name: this.name }); this.onState && this.onState('open'); });
        c.on('data', (m) => this._in(m));
        c.on('close', () => this.onState && this.onState('closed'));
        c.on('error', () => this.onState && this.onState('error'));
      });
      this.peer.on('error', (e) => this.onState && this.onState('error', e.type));
    }
  }
  window.KinektNet = { Host, Pad };
})();
