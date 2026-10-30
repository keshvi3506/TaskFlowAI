import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');
app.use(cors());
app.use(express.json({ limit: '20kb' }));

async function readTasks() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function writeTasks(tasks) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2));
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Gemini Task Manager API' }));
app.get('/api/tasks', async (_req, res, next) => {
  try { res.json(await readTasks()); } catch (error) { next(error); }
});
app.post('/api/tasks', async (req, res, next) => {
  try {
    const { title, description = '', priority = 'Medium' } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'Task title is required.' });
    const tasks = await readTasks();
    const task = { id: randomUUID(), title: title.trim(), description: description.trim(), priority, status: 'Pending', createdAt: new Date().toISOString() };
    tasks.unshift(task); await writeTasks(tasks); res.status(201).json(task);
  } catch (error) { next(error); }
});
app.patch('/api/tasks/:id', async (req, res, next) => {
  try {
    const tasks = await readTasks(); const index = tasks.findIndex(t => t.id === req.params.id);
    if (index < 0) return res.status(404).json({ message: 'Task not found.' });
    tasks[index] = { ...tasks[index], ...req.body, id: tasks[index].id };
    await writeTasks(tasks); res.json(tasks[index]);
  } catch (error) { next(error); }
});
app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const tasks = await readTasks(); const filtered = tasks.filter(t => t.id !== req.params.id);
    if (filtered.length === tasks.length) return res.status(404).json({ message: 'Task not found.' });
    await writeTasks(filtered); res.json({ message: 'Task deleted.' });
  } catch (error) { next(error); }
});

// Groq API integration: the request is made only by this backend.
// Keep GROQ_API_KEY in backend/.env; never expose it to React.
const lastAiRequest = new Map();
const AI_RATE_LIMIT_MS = 60_000;

app.get('/api/ai/status', (_req, res) => {
  res.json({
    provider: 'Groq',
    configured: Boolean(process.env.GROQ_API_KEY),
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
  });
});

app.post('/api/ai/generate-description', async (req, res) => {
  const title = String(req.body.title || '').trim();
  const taskKey = String(req.body.taskId || title).trim().toLowerCase();

  if (!title) return res.status(400).json({ description: '', fallback: true, message: 'Enter a task title first.' });
  if (title.length > 120) return res.status(400).json({ description: '', fallback: true, message: 'Task title must be 120 characters or fewer.' });
  if (!process.env.GROQ_API_KEY) {
    return res.status(200).json({ description: '', fallback: true, message: 'Groq is not connected. Add GROQ_API_KEY to backend/.env and restart the backend.' });
  }

  const now = Date.now();
  for (const [key, timestamp] of lastAiRequest.entries()) {
    if (now - timestamp >= AI_RATE_LIMIT_MS) lastAiRequest.delete(key);
  }
  const previous = lastAiRequest.get(taskKey);
  if (previous && now - previous < AI_RATE_LIMIT_MS) {
    const seconds = Math.ceil((AI_RATE_LIMIT_MS - (now - previous)) / 1000);
    return res.status(429).json({ description: '', fallback: true, message: `Please wait ${seconds} seconds before requesting another AI suggestion for this task.` });
  }
  lastAiRequest.set(taskKey, now);

  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const apiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful task-planning assistant. Write a specific, practical task description in 2-3 sentences. Explain the work to be done and what a successful outcome looks like. Do not invent personal information. Return only the description, without a heading.' },
          { role: 'user', content: `Create a task description for: ${title}` }
        ],
        temperature: 0.4,
        max_tokens: 180
      }),
      signal: controller.signal
    });
    const payload = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      const apiMessage = payload.error?.message || `Groq API returned HTTP ${apiResponse.status}`;
      throw new Error(apiMessage);
    }
    const description = payload.choices?.[0]?.message?.content?.trim();
    if (!description) throw new Error('Groq returned an empty response.');
    return res.json({ description, fallback: false, provider: 'Groq', model });
  } catch (error) {
    console.error('Groq generation failed:', error.name === 'AbortError' ? 'Request timed out' : error.message);
    const fallback = `Plan and complete "${title}". Identify the required steps, work through them, and review the result before marking the task complete.`;
    return res.status(200).json({
      description: fallback,
      fallback: true,
      message: error.name === 'AbortError'
        ? 'Groq took too long to respond. A standard description is shown instead.'
        : 'Groq could not generate a response. Check your API key, model access, quota and internet connection. A standard description is shown instead.'
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server. Please try again.' });
});
// Export the app so automated tests can exercise the API without opening a port.
export default app;

// Start the server only when this file is run directly.
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
}
