const { FixedThreadPool } = require("poolifier");
const path = require("path");

class WorkerPool {
  constructor(maxWorkers = 1) {
    this.pool = new FixedThreadPool(
      maxWorkers,
      path.resolve(__dirname, "./Worker.js")
    );
  }

  async runTask(method, args) {
    const result = await this.pool.execute({ method, args });

    if (result?.error) {
      const error = new Error(result.message);
      error.stack = result.stack;
      throw error;
    }

    return result;
  }

  async destroy() {
    return this.pool.destroy();
  }
}

module.exports = WorkerPool;
