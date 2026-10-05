import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import authRouter from './auth';
import projectsRouter from './project';
import filesRouter from './files';
import chatRouter from './chat';
import sandboxRouter from './sandbox.route';
import githubRouter from "./connectors/github";
import { HttpError } from './errors';
export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.use('/github', githubRouter);


app.use('/auth', authRouter);
app.use('/projects', projectsRouter);
app.use('/projects', filesRouter);
app.use('/projects', chatRouter);
app.use('/projects', sandboxRouter);

// Unknown route -> JSON 404 (instead of Express' default HTML page).
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler. Must be registered last and keep all four args so
// Express recognises it as an error handler. Never leak stack traces to
// clients; log them server-side instead.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : 'Internal server error';
  const code = err instanceof HttpError ? err.code : undefined;

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json(code ? { error: message, code } : { error: message });
});
