import { describe, expect, test } from 'bun:test';
import { createAuthFileModelRulesSessions } from '@/features/authFiles/hooks/useAuthFileModelRules';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setup() {
  let connectionRevision = 0;
  const sessions = createAuthFileModelRulesSessions(() => connectionRevision);
  const state = { original: '', error: '', loading: false, saving: false, saved: 0 };
  const loadCallbacks = {
    start: () => {
      state.loading = true;
    },
    success: (value: string) => {
      state.original = value;
    },
    error: (error: unknown) => {
      state.error = String(error);
    },
    finish: () => {
      state.loading = false;
    },
  };
  const saveCallbacks = {
    start: () => {
      state.saving = true;
    },
    success: (value: string) => {
      state.original = value;
      state.saved += 1;
    },
    error: (error: unknown) => {
      state.error = String(error);
    },
    finish: () => {
      state.saving = false;
    },
  };
  return {
    sessions,
    state,
    loadCallbacks,
    saveCallbacks,
    switchConnection: () => {
      connectionRevision += 1;
    },
  };
}

describe('auth-file model rules asynchronous session isolation', () => {
  for (const switchKind of ['file', 'connection']) {
    test(`${switchKind} switch discards an old load after the replacement load succeeds`, async () => {
      const h = setup();
      const old = h.sessions.begin();
      const oldResponse = deferred<string>();
      const oldLoad = old.load(() => oldResponse.promise, h.loadCallbacks);
      if (switchKind === 'connection') h.switchConnection();
      const current = h.sessions.begin();
      await current.load(() => Promise.resolve('new-file-rules'), h.loadCallbacks);

      oldResponse.resolve('old-file-rules');
      await oldLoad;

      expect(h.state.original).toBe('new-file-rules');
      expect(h.state.error).toBe('');
      expect(h.state.loading).toBe(false);
    });

    test(`${switchKind} switch ignores an old load rejection and its final loading update`, async () => {
      const h = setup();
      const oldResponse = deferred<string>();
      const oldLoad = h.sessions.begin().load(() => oldResponse.promise, h.loadCallbacks);
      if (switchKind === 'connection') h.switchConnection();
      const newResponse = deferred<string>();
      const newLoad = h.sessions.begin().load(() => newResponse.promise, h.loadCallbacks);

      oldResponse.reject(new Error('old backend failed'));
      await oldLoad;
      expect(h.state.error).toBe('');
      expect(h.state.loading).toBe(true);

      newResponse.resolve('new-file-rules');
      await newLoad;
      expect(h.state.original).toBe('new-file-rules');
      expect(h.state.loading).toBe(false);
    });

    for (const outcome of ['success', 'failure']) {
      test(`${switchKind} switch allows saving immediately while stale ${outcome} cannot unlock the new save`, async () => {
        const h = setup();
        let writes = 0;
        const oldResponse = deferred<string>();
        const oldSave = h.sessions.begin().save(() => {
          writes += 1;
          return oldResponse.promise;
        }, h.saveCallbacks);
        if (switchKind === 'connection') h.switchConnection();
        const current = h.sessions.begin();
        const newResponse = deferred<string>();
        const newSave = current.save(() => {
          writes += 1;
          return newResponse.promise;
        }, h.saveCallbacks);
        expect(writes).toBe(2);
        expect(h.state.saving).toBe(true);

        if (outcome === 'success') oldResponse.resolve('old-save-result');
        else oldResponse.reject(new Error('old write failed'));
        await oldSave;
        expect(h.state.original).toBe('');
        expect(h.state.saved).toBe(0);
        expect(h.state.error).toBe('');
        expect(h.state.saving).toBe(true);

        await current.save(async () => {
          writes += 1;
          return 'duplicate-write';
        }, h.saveCallbacks);
        expect(writes).toBe(2);
        expect(h.state.saved).toBe(0);

        newResponse.resolve('new-save-result');
        await newSave;
        expect(h.state.original).toBe('new-save-result');
        expect(h.state.saved).toBe(1);
        expect(h.state.saving).toBe(false);
      });
    }
  }

  test('a connection revision change fences requests even before the next effect starts', async () => {
    const h = setup();
    const current = h.sessions.begin();
    const response = deferred<string>();
    const loading = current.load(() => response.promise, h.loadCallbacks);
    h.switchConnection();
    let writes = 0;
    await current.save(async () => {
      writes += 1;
      return 'wrong-server';
    }, h.saveCallbacks);
    response.resolve('old-server');
    await loading;
    expect(writes).toBe(0);
    expect(h.state.original).toBe('');
    expect(h.state.saved).toBe(0);
  });

  test('closing the session suppresses save callbacks and late cleanup cannot cancel a replacement', async () => {
    const h = setup();
    const old = h.sessions.begin();
    const response = deferred<string>();
    const saving = old.save(() => response.promise, h.saveCallbacks);
    old.invalidate();
    const current = h.sessions.begin();
    old.invalidate();
    response.resolve('closed-file');
    await saving;
    expect(h.state.original).toBe('');
    expect(h.state.saved).toBe(0);
    await current.save(() => Promise.resolve('current-file'), h.saveCallbacks);
    expect(h.state.original).toBe('current-file');
    expect(h.state.saved).toBe(1);
  });

  test('a current save failure reports the error and releases its own lock for retry', async () => {
    const h = setup();
    const current = h.sessions.begin();
    await current.save(() => Promise.reject(new Error('current write failed')), h.saveCallbacks);
    expect(h.state.error).toContain('current write failed');
    expect(h.state.saving).toBe(false);
    expect(h.state.saved).toBe(0);
    await current.save(() => Promise.resolve('retried-rules'), h.saveCallbacks);
    expect(h.state.original).toBe('retried-rules');
    expect(h.state.saved).toBe(1);
  });
});
