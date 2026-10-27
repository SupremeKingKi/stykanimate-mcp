/**
 * The render tools, over an in-memory MCP connection.
 *
 * They draw with the optional @napi-rs/canvas package; without it every
 * test here skips itself.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer, createSession } from '../src/server.js';
import { canRender } from '../src/render.js';

const EXAMPLE = fileURLToPath(new URL('../assets/python-vs-java.styk', import.meta.url));
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const available = await canRender();
const skip = available ? false : '@napi-rs/canvas is not installed';

async function connect(t) {
  const server = createServer(createSession({ pivot: false }));
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  t.after(async () => client.close());
  const call = (name, args = {}) => client.callTool({ name, arguments: args });
  const opened = await call('project_open', { path: EXAMPLE });
  assert.equal(opened.isError, undefined, opened.content?.[0]?.text);
  return call;
}

function picture(result) {
  const image = result.content.find(item => item.type === 'image');
  assert.ok(image, 'the result carries no picture');
  assert.equal(image.mimeType, 'image/png');
  const bytes = Buffer.from(image.data, 'base64');
  assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE);
  return { bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('capabilities says whether pictures can be rendered', async t => {
  const call = await connect(t);
  const capabilities = await call('capabilities');
  assert.equal(capabilities.structuredContent.render, available);
});

test('render_frame draws one frame at the size asked for', { skip }, async t => {
  const call = await connect(t);
  const frame = await call('render_frame', { tick: 60, width: 480 });
  assert.equal(frame.isError, undefined, frame.content[0].text);
  const png = picture(frame);
  assert.equal(png.width, 480);
  assert.equal(png.height, 270);
  assert.equal(frame.structuredContent.tick, 60);
  assert.equal(frame.structuredContent.seconds, 2.5);

  const byFrame = await call('render_frame', { frame: 3, showJoints: true });
  assert.equal(byFrame.isError, undefined, byFrame.content[0].text);
  assert.equal(picture(byFrame).width, 960);
  assert.equal(byFrame.structuredContent.tick, 20);
});

test('rendering leaves the playhead where it was', { skip }, async t => {
  const call = await connect(t);
  await call('project_seek', { tick: 20 });
  await call('render_frame', { tick: 100 });
  await call('render_sheet', { count: 4 });
  const pose = await call('pose_evaluate');
  assert.equal(pose.structuredContent.tick, 20);
});

test('render_sheet lays frames out in rows', { skip }, async t => {
  const call = await connect(t);
  const spread = await call('render_sheet', { count: 6, columns: 3, cellWidth: 200 });
  assert.equal(spread.isError, undefined, spread.content[0].text);
  assert.deepEqual(spread.structuredContent.ticks, [0, 26, 51, 77, 102, 128]);
  assert.equal(spread.structuredContent.rows, 2);
  assert.equal(spread.structuredContent.columns, 3);
  const png = picture(spread);
  assert.equal(png.width, spread.structuredContent.width);
  assert.equal(png.height, spread.structuredContent.height);

  const every = await call('render_sheet', { everyFrame: true });
  assert.equal(every.isError, undefined, every.content[0].text);
  assert.equal(every.structuredContent.ticks.length, 14);
  assert.equal(every.structuredContent.ticks[0], 0);

  const chosen = await call('render_sheet', { ticks: [5, 50] });
  assert.deepEqual(chosen.structuredContent.ticks, [5, 50]);
  assert.equal(chosen.structuredContent.columns, 2);
});

test('the render tools refuse what they cannot draw', { skip }, async t => {
  const call = await connect(t);
  const outside = await call('render_frame', { tick: 500 });
  assert.equal(outside.isError, true);
  assert.equal(outside.structuredContent.error.code, 'bad_tick');

  const tooMany = await call('render_sheet', { ticks: Array.from({ length: 40 }, (_, index) => index) });
  assert.equal(tooMany.isError, true);
  assert.equal(tooMany.structuredContent.error.code, 'render_too_large');

  const backwards = await call('render_sheet', { fromTick: 50, toTick: 10 });
  assert.equal(backwards.isError, true);
  assert.equal(backwards.structuredContent.error.code, 'bad_tick');
});

test('a picture is saved only where it will not replace a file', { skip }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'stykanimate-render-'));
  t.after(async () => rm(folder, { recursive: true, force: true }));
  const call = await connect(t);
  const target = path.join(folder, 'pose');

  const saved = await call('render_frame', { tick: 0, width: 320, savePath: target });
  assert.equal(saved.isError, undefined, saved.content[0].text);
  assert.equal(saved.structuredContent.savedTo, `${target}.png`);
  assert.deepEqual((await readFile(`${target}.png`)).subarray(0, 8), PNG_SIGNATURE);

  const again = await call('render_frame', { tick: 0, savePath: target });
  assert.equal(again.isError, true);
  assert.equal(again.structuredContent.error.code, 'file_exists');

  const replaced = await call('render_sheet', { count: 2, savePath: target, overwrite: true });
  assert.equal(replaced.isError, undefined, replaced.content[0].text);
});
