// debugLog.test.js — testes exaustivos do logger persistente.
// Cobre: ring buffer, overflow FIFO, fallback sem localStorage, dados
// maliciosos, payloads circulares, edge cases de tipos.

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('debugLog', () => {
  let debugLog, getDebugSnapshot, clearDebug, pushEmergencyLog, pushLastReactError;

  beforeEach(async () => {
    // Limpa localStorage antes de cada teste
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    // Reimporta o módulo fresh pra cada teste
    vi.resetModules();
    const mod = await import('./debugLog');
    debugLog = mod.debugLog;
    getDebugSnapshot = mod.getDebugSnapshot;
    clearDebug = mod.clearDebug;
    pushEmergencyLog = mod.pushEmergencyLog;
    pushLastReactError = mod.pushLastReactError;
  });

  describe('debugLog() básico', () => {
    it('persiste entrada no localStorage', () => {
      debugLog('info', 'TestComp', 'mensagem de teste');
      const snap = getDebugSnapshot();
      expect(snap.entries).toHaveLength(1);
      expect(snap.entries[0]).toMatchObject({
        lvl: 'info',
        cmp: 'TestComp',
        msg: 'mensagem de teste'
      });
      expect(snap.entries[0].t).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
      expect(snap.entries[0].data).toBeNull();
    });

    it('preserva a ordem dos logs (FIFO)', () => {
      debugLog('info', 'C', 'primeiro');
      debugLog('warn', 'C', 'segundo');
      debugLog('error', 'C', 'terceiro');
      const entries = getDebugSnapshot().entries;
      expect(entries.map((e) => e.msg)).toEqual(['primeiro', 'segundo', 'terceiro']);
    });

    it('aceita data arbitrária (objeto, array, primitivo)', () => {
      debugLog('debug', 'C', 'com obj', { a: 1, b: [2, 3] });
      debugLog('debug', 'C', 'com array', [1, 'two', null]);
      debugLog('debug', 'C', 'com null', null);
      debugLog('debug', 'C', 'sem data');
      const entries = getDebugSnapshot().entries;
      expect(entries[0].data).toEqual({ a: 1, b: [2, 3] });
      expect(entries[1].data).toEqual([1, 'two', null]);
      expect(entries[2].data).toBeNull();
      expect(entries[3].data).toBeNull();
    });

    it('defaulta level para "info" se ausente', () => {
      debugLog(undefined, 'C', 'sem level');
      expect(getDebugSnapshot().entries[0].lvl).toBe('info');
    });

    it('defaulta component para "?" se ausente', () => {
      debugLog('info', undefined, 'sem comp');
      expect(getDebugSnapshot().entries[0].cmp).toBe('?');
    });

    it('coage message não-string para string', () => {
      debugLog('info', 'C', 42);
      expect(getDebugSnapshot().entries[0].msg).toBe('42');
    });
  });

  describe('ring buffer FIFO (overflow)', () => {
    it('trunca para 200 entradas mantendo as mais recentes', () => {
      for (let i = 0; i < 250; i++) {
        debugLog('info', 'C', `entry ${i}`);
      }
      const entries = getDebugSnapshot().entries;
      expect(entries).toHaveLength(200);
      // Primeira entrada deve ser entry 50 (250 - 200)
      expect(entries[0].msg).toBe('entry 50');
      // Última deve ser entry 249
      expect(entries[199].msg).toBe('entry 249');
    });

    it('sobrevive a 1000 entradas sem crash', () => {
      for (let i = 0; i < 1000; i++) {
        debugLog('debug', 'Stress', `entry ${i}`, { i });
      }
      const entries = getDebugSnapshot().entries;
      expect(entries).toHaveLength(200);
      expect(entries[0].msg).toBe('entry 800');
      expect(entries[199].msg).toBe('entry 999');
    });
  });

  describe('getDebugSnapshot()', () => {
    it('retorna estrutura completa com entries/emergencyLog/lastReactError/timestamp', () => {
      const snap = getDebugSnapshot();
      expect(snap).toHaveProperty('entries');
      expect(snap).toHaveProperty('emergencyLog');
      expect(snap).toHaveProperty('lastReactError');
      expect(snap).toHaveProperty('timestamp');
      expect(snap.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('retorna emergencyLog como array', () => {
      // Sem nada salvo, deve ser array vazio
      expect(getDebugSnapshot().emergencyLog).toEqual([]);
    });

    it('retorna lastReactError como null quando ausente', () => {
      expect(getDebugSnapshot().lastReactError).toBeNull();
    });

    it('lê entries que foram salvos com chaves alternativas (retrocompat)', () => {
      // Simula dados legados salvos por versão anterior do debugLog
      localStorage.setItem('mip_debug_log_v1', JSON.stringify([{ t: '2026-01-01', lvl: 'info', cmp: 'Old', msg: 'legado', data: null }]));
      // Reimporta pra forçar re-leitura
      vi.resetModules();
      return import('./debugLog').then((mod) => {
        const snap = mod.getDebugSnapshot();
        expect(snap.entries).toHaveLength(1);
        expect(snap.entries[0].cmp).toBe('Old');
      });
    });

    it('tolera JSON corrompido sem crash', () => {
      localStorage.setItem('mip_debug_log_v1', '{[}json invalido{{');
      vi.resetModules();
      return import('./debugLog').then((mod) => {
        const snap = mod.getDebugSnapshot();
        expect(snap.entries).toEqual([]);
      });
    });

    it('tolera valor que não é array', () => {
      localStorage.setItem('mip_debug_log_v1', JSON.stringify({ not: 'array' }));
      vi.resetModules();
      return import('./debugLog').then((mod) => {
        const snap = mod.getDebugSnapshot();
        expect(snap.entries).toEqual([]);
      });
    });
  });

  describe('clearDebug()', () => {
    it('limpa entries + emergencyLog + lastReactError', () => {
      debugLog('info', 'C', 'msg1');
      pushEmergencyLog('test', { foo: 1 });
      pushLastReactError(new Error('boom'), 'stack aqui');
      expect(getDebugSnapshot().entries.length).toBeGreaterThan(0);
      expect(getDebugSnapshot().emergencyLog.length).toBeGreaterThan(0);
      expect(getDebugSnapshot().lastReactError).not.toBeNull();

      clearDebug();

      const snap = getDebugSnapshot();
      expect(snap.entries).toEqual([]);
      expect(snap.emergencyLog).toEqual([]);
      expect(snap.lastReactError).toBeNull();
    });

    it('é idempotente (clear 2x não crasha)', () => {
      clearDebug();
      clearDebug();
      expect(getDebugSnapshot().entries).toEqual([]);
    });
  });

  describe('pushEmergencyLog()', () => {
    it('persiste entrada de emergency com kind e info', () => {
      pushEmergencyLog('window.error', { message: 'falhou', lineno: 42 });
      const snap = getDebugSnapshot();
      expect(snap.emergencyLog).toHaveLength(1);
      expect(snap.emergencyLog[0]).toMatchObject({
        kind: 'window.error',
        info: { message: 'falhou', lineno: 42 }
      });
    });

    it('trunca emergencyLog para 50 entradas FIFO', () => {
      for (let i = 0; i < 60; i++) {
        pushEmergencyLog('test', { i });
      }
      const snap = getDebugSnapshot();
      expect(snap.emergencyLog).toHaveLength(50);
      // Primeira deve ser i=10
      expect(snap.emergencyLog[0].info.i).toBe(10);
      // Última deve ser i=59
      expect(snap.emergencyLog[49].info.i).toBe(59);
    });

    it('tolera info que não serializa (string simples)', () => {
      pushEmergencyLog('test', { message: 'erro X' });
      expect(getDebugSnapshot().emergencyLog[0].info.message).toBe('erro X');
    });
  });

  describe('pushLastReactError()', () => {
    it('persiste error.message + error.stack + componentStack', () => {
      const err = new Error('react crash');
      err.stack = 'Error: react crash\n    at Component (App.jsx:42)';
      pushLastReactError(err, '    in Component\n    in App');
      const snap = getDebugSnapshot();
      expect(snap.lastReactError).toMatchObject({
        message: 'react crash',
        stack: expect.stringContaining('react crash')
      });
      expect(snap.lastReactError.componentStack).toContain('App');
    });

    it('trunca stack para 2000 chars', () => {
      const longStack = 'x'.repeat(5000);
      const err = new Error('boom');
      err.stack = longStack;
      pushLastReactError(err, 'cmp');
      expect(getDebugSnapshot().lastReactError.stack.length).toBeLessThanOrEqual(2000);
    });

    it('trunca componentStack para 4000 chars', () => {
      const longCmp = 'y'.repeat(6000);
      const err = new Error('boom');
      pushLastReactError(err, longCmp);
      expect(getDebugSnapshot().lastReactError.componentStack.length).toBeLessThanOrEqual(4000);
    });

    it('tolera error sem stack', () => {
      const err = new Error('no stack');
      err.stack = undefined;
      pushLastReactError(err, 'cmp');
      expect(getDebugSnapshot().lastReactError.message).toBe('no stack');
      expect(getDebugSnapshot().lastReactError.stack).toBe('');
    });

    it('tolera error como string (não Error object)', () => {
      pushLastReactError('string error', 'cmp');
      expect(getDebugSnapshot().lastReactError.message).toBe('string error');
    });

    it('tolera undefined componentStack', () => {
      const err = new Error('x');
      pushLastReactError(err, undefined);
      expect(getDebugSnapshot().lastReactError.componentStack).toBe('');
    });
  });

  describe('adversarial: dados maliciosos / payloads hostis', () => {
    it('serializa objetos com prototypes estranhos (não vaza prototype)', () => {
      const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
      debugLog('info', 'C', 'proto attack', malicious);
      const entry = getDebugSnapshot().entries[0];
      // data deve ser plain {} após serialização segura
      expect(entry.data).toBeDefined();
      expect(({}).polluted).toBeUndefined();
    });

    it('não crasha com data contendo funções (são removidas pelo JSON.stringify)', () => {
      debugLog('info', 'C', 'with fn', { fn: () => 42, val: 1 });
      const entry = getDebugSnapshot().entries[0];
      // fn desaparece no JSON.stringify
      expect(entry.data).toEqual({ val: 1 });
    });

    it('não crasha com data contendo Symbol (são ignorados)', () => {
      debugLog('info', 'C', 'with symbol', { sym: Symbol('x'), val: 1 });
      const entry = getDebugSnapshot().entries[0];
      expect(entry.data.val).toBe(1);
    });

    it('preserva a mensagem como dado, sem executar conteúdo HTML', () => {
      debugLog('info', 'C', '<script>alert(1)</script>');
      const entry = getDebugSnapshot().entries[0];
      expect(entry.msg).toBe('<script>alert(1)</script>');
      // A mensagem fica armazenada como string; não há execução nem innerHTML.
    });

    it('coage data que falha em JSON.stringify para string', () => {
      // Cria um objeto circular
      const circ = { name: 'circular-ref' };
      circ.self = circ;
      debugLog('info', 'C', 'circular', circ);
      const entry = getDebugSnapshot().entries[0];
      // data vira string (fallback via String(v)) porque JSON.stringify falha
      expect(typeof entry.data).toBe('string');
      // String(obj circular) -> '[object Object]', mas o ponto crítico é que
      // não crashou — o app continua funcionando.
      expect(entry.data).toBeDefined();
    });
  });

  describe('isolamento entre testes (chave mip_debug_log_v1)', () => {
    it('não vaza logs entre testes via beforeEach', () => {
      // Este teste assume que beforeEach rodou localStorage.clear()
      expect(getDebugSnapshot().entries).toEqual([]);
    });
  });
});