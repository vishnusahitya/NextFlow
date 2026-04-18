import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data/mock-db.json');

interface MockDB {
  workflows: Workflow[];
  executions: ExecutionRun[];
  nextId: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionRun {
  id: string;
  workflowId: string;
  scope: string;
  status: string;
  durationMs: number;
  nodeLogs: unknown[];
  createdAt: string;
}

let db: MockDB = {
  workflows: [],
  executions: [],
  nextId: 'wf-1',
};

async function loadDB() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    db = JSON.parse(data);
  } catch {
    // Init with sample
    db.workflows = [
      {
        id: 'sample',
        name: 'Sample Product Marketing Kit Generator',
        description: 'Sample workflow covering all node types.',
        nodes: [], // Load from sample-workflow.ts
        edges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];
    await saveDB();
  }
}

async function saveDB() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

export async function getWorkflows() {
  await loadDB();
  return db.workflows;
}

export async function getWorkflow(id: string) {
  await loadDB();
  return db.workflows.find(w => w.id === id);
}

export async function createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) {
  await loadDB();
  const id = db.nextId;
  db.nextId = `wf-${parseInt(db.nextId.split('-')[1]) + 1}`;
  const newWorkflow = { ...workflow, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.workflows.push(newWorkflow);
  await saveDB();
  return newWorkflow;
}

export async function updateWorkflow(id: string, data: Partial<Workflow>) {
  await loadDB();
  const index = db.workflows.findIndex(w => w.id === id);
  if (index === -1) throw new Error('Not found');
  db.workflows[index] = { ...db.workflows[index], ...data, updatedAt: new Date().toISOString() };
  await saveDB();
  return db.workflows[index];
}

export async function deleteWorkflow(id: string) {
  await loadDB();
  db.workflows = db.workflows.filter(w => w.id !== id);
  await saveDB();
}

// Executions mock
export async function createExecutionRun(run: Omit<ExecutionRun, 'id' | 'createdAt'>) {
  await loadDB();
  const id = `exec-${Date.now()}`;
  const newRun = { ...run, id, createdAt: new Date().toISOString() };
  db.executions.push(newRun);
  await saveDB();
  return newRun;
}
