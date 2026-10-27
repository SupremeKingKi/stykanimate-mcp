#!/usr/bin/env node
/**
 * Call the server's tools from the command line, without an MCP client.
 *
 * The server runs in this process over an in-memory connection, so open
 * projects last only for one run: pass every call that needs the same
 * project in one command, and they run in order.
 *
 * Usage:
 *   node scripts/call.mjs --list
 *   node scripts/call.mjs <tool> '<json arguments>' [<tool> '<json arguments>' ...]
 *   node scripts/call.mjs --file calls.json      a JSON array of { "tool", "arguments" }
 *
 * Options:
 *   --no-pivot   Do not start the Python codec, so Pivot files cannot be read
 *   --json       Print each result's structured content instead of its text
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createServer, createSession } = await import(pathToFileURL(path.join(packageRoot, 'src/server.js')).href);

const USAGE = `Usage:
  node scripts/call.mjs --list
  node scripts/call.mjs <tool> '<json arguments>' [<tool> '<json arguments>' ...]
  node scripts/call.mjs --file calls.json
Options: --no-pivot, --json`;

async function parseArgs(argv) {
  const options = { list: false, pivot: true, json: false, calls: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--list') options.list = true;
    else if (argument === '--no-pivot') options.pivot = false;
    else if (argument === '--json') options.json = true;
    else if (argument === '--file') {
      const calls = JSON.parse(await readFile(argv[++index], 'utf8'));
      if (!Array.isArray(calls)) throw new Error('The calls file must hold a JSON array.');
      for (const entry of calls) options.calls.push({ tool: entry.tool, arguments: entry.arguments ?? {} });
    } else if (argument.startsWith('--')) throw new Error(`Unknown option "${argument}".`);
    else {
      // A tool name, optionally followed by its arguments as JSON.
      const next = argv[index + 1];
      const hasArguments = next !== undefined && next.trimStart().startsWith('{');
      options.calls.push({ tool: argument, arguments: hasArguments ? JSON.parse(argv[++index]) : {} });
    }
  }
  if (!options.list && options.calls.length === 0) throw new Error('Name at least one tool, or pass --list.');
  return options;
}

let options;
try {
  options = await parseArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n\n${USAGE}\n`);
  process.exit(2);
}

const session = createSession({ pivot: options.pivot, log: message => process.stderr.write(`[stykanimate] ${message}\n`) });
const server = createServer(session);
const client = new Client({ name: 'call', version: '1.0.0' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

let failed = false;
try {
  if (options.list) {
    const { tools } = await client.listTools();
    for (const tool of tools) console.log(`${tool.name.padEnd(22)} ${tool.title ?? ''}`);
  }
  for (const { tool, arguments: args } of options.calls) {
    const result = await client.callTool({ name: tool, arguments: args });
    console.log(`\n▸ ${tool}(${JSON.stringify(args)})${result.isError ? '  [error]' : ''}`);
    if (options.json && result.structuredContent) console.log(JSON.stringify(result.structuredContent, null, 2));
    else {
      for (const part of result.content ?? []) {
        // Images come back as base64; save them with the render tools' path option instead.
        console.log(part.type === 'text' ? part.text : `[${part.type} ${part.mimeType ?? ''}]`);
      }
    }
    if (result.isError) {
      failed = true;
      break;
    }
  }
} finally {
  await client.close();
  await session.codec?.stop().catch(() => {});
}
process.exitCode = failed ? 1 : 0;
