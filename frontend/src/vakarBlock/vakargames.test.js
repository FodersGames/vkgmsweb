import { VakarBlockRuntime, VakarSprite } from './runtime';

// Verifies the VakarGames extension re-implementation (Fichiers / Texte /
// Play — see runtime.js's VG_API_URL comment) against a mocked `fetch`,
// exercising the real runtime methods directly rather than through
// compiled Blockly code (that path is covered separately in sb3.test.js
// for the import/export mapping). No real network call ever happens here.

function mockFetchOnce(status, body) {
  global.fetch.mockImplementationOnce(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob(['fake-image-bytes']),
  }));
}

function makeRuntime(sprites = new Map()) {
  return new VakarBlockRuntime({ sprites, onRender: () => {}, onError: (e) => { throw e; } });
}

// Drives a generator to completion the way the real requestAnimationFrame
// loop would (one `.next()` per tick), but between each step yields to the
// real JS microtask queue (`await Promise.resolve()`) — required so the
// mocked-fetch Promises inside `awaitPromise` actually get a chance to
// resolve. A tight synchronous `while (!step.done) step = gen.next()` loop
// never yields control back to the event loop at all, so those Promises'
// `.then()` callbacks (microtasks) would never run — the generator would
// spin forever seeing `state.done` stuck at false.
async function drive(gen) {
  let step = gen.next();
  let guard = 0;
  while (!step.done) {
    if (++guard > 1000) throw new Error('drive(): generator never completed');
    await Promise.resolve();
    await Promise.resolve(); // two ticks: one for the fetch mock's own promise, one for .then()
    step = gen.next();
  }
  return step.value;
}

beforeEach(() => {
  global.fetch = jest.fn();
  window.localStorage.clear();
  // jsdom doesn't implement URL.createObjectURL — vgLoadCostumeById needs it.
  if (!global.URL.createObjectURL) global.URL.createObjectURL = () => 'blob:fake';
});

test('vgConfigureFiles + vgLoadCostumeById fetches the file list then the file, adding a real costume', async () => {
  const sprite = new VakarSprite({ id: 's1', name: 'Hero', costumes: [] });
  const rt = makeRuntime(new Map([[sprite.id, sprite]]));
  rt.vgConfigureFiles('mon-jeu', 'secret-key');

  mockFetchOnce(200, { files: [{ id: 'f1', name: 'sword', original_filename: 'sword.png' }] });
  mockFetchOnce(200, {}); // download response — .blob() is what matters

  await drive(rt.vgLoadCostumeById(sprite, 'f1', 'Hero'));

  expect(sprite.costumes).toHaveLength(1);
  expect(sprite.costumes[0].name).toBe('sword');
  expect(sprite.currentCostumeId).toBe(sprite.costumes[0].id);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  const [listUrl, listOpts] = global.fetch.mock.calls[0];
  expect(listUrl).toBe('https://vakargames.com/api/game/mon-jeu/files?version=default');
  expect(listOpts.headers['X-Files-Api-Key']).toBe('secret-key');
});

test('vgLoadCostumeById throws when the file id is unknown', async () => {
  const sprite = new VakarSprite({ id: 's1', name: 'Hero', costumes: [] });
  const rt = makeRuntime(new Map([[sprite.id, sprite]]));
  rt.vgConfigureFiles('mon-jeu', 'key');
  mockFetchOnce(200, { files: [] });

  await expect(drive(rt.vgLoadCostumeById(sprite, 'missing', 'Hero'))).rejects.toThrow(/introuvable/);
});

test('vgRemoveAllCostumes clears a sprite found by name', () => {
  const sprite = new VakarSprite({ id: 's1', name: 'Hero', costumes: [{ id: 'c1', name: 'a', image_url: '/a.png' }] });
  const rt = makeRuntime(new Map([[sprite.id, sprite]]));
  rt.vgRemoveAllCostumes(sprite, 'Hero');
  expect(sprite.costumes).toHaveLength(0);
  expect(sprite.currentCostumeId).toBeNull();
});

test('vgShowText / vgSetTextVisible store real state in runtime.texts', () => {
  const rt = makeRuntime();
  rt.vgShowText('score', { text: 'Score: 0', x: 0, y: 150, size: 24, color: '#fff' });
  expect(rt.texts.get('score').text).toBe('Score: 0');
  rt.vgSetTextVisible('score', false);
  expect(rt.texts.get('score').visible).toBe(false);
});

test('VakarGames Play: full session lifecycle — configure (no stored session), show-login suspends the script, attemptLogin resumes it, save/load round-trip, disconnect clears state', async () => {
  const sprite = new VakarSprite({ id: 's1', name: 'Hero' });
  const rt = makeRuntime(new Map([[sprite.id, sprite]]));

  // vgPlayConfigure — no refresh_token in localStorage, so _vgPlayRestoreSession
  // returns immediately without any fetch call.
  await drive(rt.vgPlayConfigure('mon-jeu'));
  expect(global.fetch).not.toHaveBeenCalled();
  expect(rt.vgPlayIsConnected()).toBe(false);

  // vgPlayShowLogin suspends until vgPlayResolveLogin() is called — driven
  // here the same way the login popup UI would drive it (via a real
  // vgPlayAttemptLogin call, then resolving).
  let popupShown = false;
  rt.onShowLoginPopup = () => { popupShown = true; };
  const loginGen = rt.vgPlayShowLogin();
  let loginStep = loginGen.next();
  expect(loginStep.done).toBe(false); // still suspended, no login yet
  expect(popupShown).toBe(true);

  mockFetchOnce(200, { access_token: 'tok123', refresh_token: 'ref123', player: { id: 'p1', username: 'Ash' }, is_first_time: true });
  const loginResult = await rt.vgPlayAttemptLogin('Ash', 'hunter2');
  expect(loginResult.ok).toBe(true);
  expect(rt.vgPlayIsConnected()).toBe(true);
  expect(window.localStorage.getItem('vg_play_refresh_mon-jeu')).toBe('ref123');

  rt.vgPlayResolveLogin();
  // `resolve()` only schedules the awaited promise's `.then()` as a
  // microtask — it hasn't run yet at this point in the synchronous code,
  // so `state.done` inside awaitPromise isn't true yet either. Yield to
  // the microtask queue before checking the generator again.
  await Promise.resolve();
  await Promise.resolve();
  loginStep = loginGen.next();
  expect(loginStep.done).toBe(true); // resumed and finished

  // Save
  mockFetchOnce(200, {});
  const saveValue = await drive(rt.vgPlaySave('stats', '{"coins":5}'));
  expect(saveValue).toBe(true);
  const [saveUrl, saveOpts] = global.fetch.mock.calls[global.fetch.mock.calls.length - 1];
  expect(saveUrl).toBe('https://vakargames.com/api/play/save');
  expect(JSON.parse(saveOpts.body)).toEqual({ category: 'stats', data: '{"coins":5}', project_slug: 'mon-jeu' });
  expect(saveOpts.headers.Authorization).toBe('Bearer tok123');

  // Saving the exact same payload again is a no-op (no second fetch) —
  // matches the original extension's own cache guard.
  const saveValue2 = await drive(rt.vgPlaySave('stats', '{"coins":5}'));
  expect(saveValue2).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(2); // login(1) + save(1) — configure made none, second save made none

  // Load — writes straight into sprite.vars (command shape, not a reporter
  // — see runtime.js's vgPlayLoad comment)
  mockFetchOnce(200, { data: '{"coins":5}' });
  await drive(rt.vgPlayLoad(sprite, 'stats', 'sauvegarde'));
  expect(sprite.vars.sauvegarde).toBe('{"coins":5}');

  // Disconnect
  rt.vgPlayDisconnect();
  expect(rt.vgPlayIsConnected()).toBe(false);
  expect(window.localStorage.getItem('vg_play_refresh_mon-jeu')).toBeNull();
});

test('VakarGames Play: register goes through the same session-applying path as login', async () => {
  const rt = makeRuntime();
  rt.vgPlayConfigure('mon-jeu'); // sync enough for this test — no need to drain the generator
  mockFetchOnce(200, { access_token: 'tokA', refresh_token: 'refA', player: { id: 'p2', username: 'Newbie' } });
  const res = await rt.vgPlayAttemptRegister('Newbie', 'newbie@example.com', 'password1');
  expect(res.ok).toBe(true);
  expect(rt.vgPlayIsConnected()).toBe(true);
});

test('VakarGames Play: a rejected login surfaces the server error and does not sign in', async () => {
  const rt = makeRuntime();
  rt.vgPlayConfigure('mon-jeu');
  mockFetchOnce(401, { detail: 'Identifiants invalides' });
  const res = await rt.vgPlayAttemptLogin('Ash', 'wrong');
  expect(res.ok).toBe(false);
  expect(res.error).toBe('Identifiants invalides');
  expect(rt.vgPlayIsConnected()).toBe(false);
});

test('VakarGames Play: loading a category while signed out returns the safe default without any fetch', async () => {
  const sprite = new VakarSprite({ id: 's1', name: 'Hero' });
  const rt = makeRuntime(new Map([[sprite.id, sprite]]));
  await drive(rt.vgPlayLoad(sprite, 'stats', 'sauvegarde'));
  expect(sprite.vars.sauvegarde).toBe('{}');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('VakarGames Play: opening/closing the loading screen calls the onLoadingScreen hook with real state', () => {
  const calls = [];
  const rt = new VakarBlockRuntime({ sprites: new Map(), onRender: () => {}, onLoadingScreen: (s) => calls.push(s) });
  rt.vgPlayOpenLoading(25);
  rt.vgPlayCloseLoading();
  expect(calls).toEqual([{ visible: true, max: 25 }, { visible: false }]);
});
