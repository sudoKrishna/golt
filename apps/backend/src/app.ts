import express from 'express';
import cors from 'cors';
import authRouter from './auth';
import projectsRouter from './project';
import filesRouter from './files';
import chatRouter from './chat';
import sandboxRouter from './sandbox.route';
import githubRouter from "./connectors/github";
export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.use('/github', githubRouter);


app.use('/auth', authRouter);
app.use('/projects', projectsRouter);
app.use('/projects', filesRouter);
app.use('/projects', chatRouter);
app.use('/projects', sandboxRouter);
