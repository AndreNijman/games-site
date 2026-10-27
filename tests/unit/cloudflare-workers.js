// Stand-in for the Workers runtime module, so worker code that defines a
// Durable Object class can be imported by unit tests in Node.
export class DurableObject {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}
export class WorkerEntrypoint {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}
