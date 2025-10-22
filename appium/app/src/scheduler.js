/**
 * Task Scheduler with Min Heap
 *
 * Uses a min heap to efficiently manage scheduled tasks based on:
 * - period: 周期(秒),例如 24*60*60 表示一天
 * - position: 位置(秒),例如 12*60*60 表示一天中的12点
 * - offset: 偏移(秒),例如 3600 表示前后一小时内随机执行
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Min Heap for Task Scheduling
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  parent(i) {
    return Math.floor((i - 1) / 2);
  }

  left(i) {
    return 2 * i + 1;
  }

  right(i) {
    return 2 * i + 2;
  }

  swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  push(task) {
    this.heap.push(task);
    this.heapifyUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.heapifyDown(0);
    return min;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  size() {
    return this.heap.length;
  }

  heapifyUp(i) {
    while (i > 0 && this.heap[this.parent(i)].nextRun > this.heap[i].nextRun) {
      this.swap(i, this.parent(i));
      i = this.parent(i);
    }
  }

  heapifyDown(i) {
    let minIndex = i;
    const l = this.left(i);
    const r = this.right(i);

    if (l < this.heap.length && this.heap[l].nextRun < this.heap[minIndex].nextRun) {
      minIndex = l;
    }

    if (r < this.heap.length && this.heap[r].nextRun < this.heap[minIndex].nextRun) {
      minIndex = r;
    }

    if (i !== minIndex) {
      this.swap(i, minIndex);
      this.heapifyDown(minIndex);
    }
  }

  getAll() {
    return [...this.heap];
  }
}

/**
 * Task Scheduler
 */
class TaskScheduler {
  constructor(scriptsDir) {
    this.scriptsDir = scriptsDir;
    this.heap = new MinHeap();
    this.initialized = false;
  }

  /**
   * Calculate next run time based on period, position, and offset
   * @param {number} period - 周期(秒)
   * @param {number} position - 位置(秒)
   * @param {number} offset - 偏移(秒)
   * @returns {number} Next run timestamp (milliseconds)
   */
  calculateNextRun(period, position, offset) {
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);

    // Calculate which period we're in
    const currentPeriodStart = Math.floor(nowSeconds / period) * period;

    // Calculate the target time in this period
    let targetTime = currentPeriodStart + position;

    // Add random offset within the range
    const randomOffset = Math.floor(Math.random() * (offset * 2 + 1)) - offset;
    targetTime += randomOffset;

    // If target time has passed, move to next period
    if (targetTime <= nowSeconds) {
      targetTime += period;
    }

    return targetTime * 1000; // Convert to milliseconds
  }

  /**
   * Initialize the heap with all scheduled tasks
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('[Scheduler] Initializing task heap...');

      const files = await fs.readdir(this.scriptsDir);
      const scriptFiles = files.filter(file => file.endsWith('.js'));

      for (const file of scriptFiles) {
        const scriptPath = path.join(this.scriptsDir, file);

        try {
          // Load script module
          const scriptModule = await import(`file://${scriptPath}?t=${Date.now()}`);
          const script = scriptModule.default || scriptModule;

          // Check if script has schedule configuration
          if (!script.schedule || !script.schedule.enabled) {
            continue;
          }

          const { period, position, offset } = script.schedule;

          if (!period || position === undefined) {
            console.warn(`[Scheduler] Invalid schedule config for "${script.name || file}"`);
            continue;
          }

          // Calculate next run time
          const nextRun = this.calculateNextRun(period, position, offset || 0);

          // Add to heap
          this.heap.push({
            name: script.name || file,
            scriptPath,
            script,
            schedule: script.schedule,
            nextRun
          });

          const nextRunDate = new Date(nextRun);
          console.log(`[Scheduler] Added task "${script.name || file}" - next run: ${nextRunDate.toLocaleString()}`);

        } catch (error) {
          console.error(`[Scheduler] Error loading script ${file}:`, error.message);
        }
      }

      this.initialized = true;
      console.log(`[Scheduler] Heap initialized with ${this.heap.size()} task(s)`);

    } catch (error) {
      console.error('[Scheduler] Error initializing heap:', error);
    }
  }

  /**
   * Check and execute due tasks from the heap
   */
  async checkAndExecuteTasks() {
    // Initialize heap if not already done
    if (!this.initialized) {
      await this.initialize();
    }

    const now = Date.now();
    const executedTasks = [];

    console.log(`[Scheduler] Checking tasks... (${this.heap.size()} in queue)`);

    // Pop all due tasks from the heap
    while (this.heap.peek() && this.heap.peek().nextRun <= now) {
      const task = this.heap.pop();
      executedTasks.push(task);

      console.log(`[Scheduler] Task "${task.name}" is due, executing...`);

      // Execute task in background
      this.executeTask(task).catch(error => {
        console.error(`[Scheduler] Error executing task "${task.name}":`, error);
      });
    }

    if (executedTasks.length === 0) {
      const nextTask = this.heap.peek();
      if (nextTask) {
        const timeUntil = Math.floor((nextTask.nextRun - now) / 1000 / 60);
        console.log(`[Scheduler] No due tasks. Next task "${nextTask.name}" in ${timeUntil} minutes`);
      } else {
        console.log('[Scheduler] No tasks in queue');
      }
    } else {
      console.log(`[Scheduler] Executed ${executedTasks.length} task(s)`);
    }
  }

  /**
   * Execute a task and reschedule it
   */
  async executeTask(task) {
    try {
      console.log(`[Scheduler] Executing "${task.name}"...`);

      // Import appium wrapper
      const { default: AppiumWrapper } = await import('./appium.js');
      const configModule = await import('../../config.json', { assert: { type: 'json' } });
      const config = configModule.default;

      // Create appium instance
      const appium = new AppiumWrapper(config.webdriverio, config.capabilities);

      // Connect to appium
      await appium.connect();
      console.log(`[Scheduler] Connected to Appium for "${task.name}"`);

      // Execute the script
      const result = await task.script.execute(appium);

      // Disconnect
      await appium.disconnect();
      console.log(`[Scheduler] Disconnected from Appium for "${task.name}"`);

      console.log(`[Scheduler] Task "${task.name}" completed:`, result.success ? 'SUCCESS' : 'FAILED');
      if (!result.success) {
        console.error(`[Scheduler] Error message: ${result.message}`);
      }

      // Calculate next run time
      const { period, position, offset } = task.schedule;
      const nextRun = this.calculateNextRun(period, position, offset || 0);

      // Add back to heap with new time
      this.heap.push({
        ...task,
        nextRun
      });

      const nextRunDate = new Date(nextRun);
      console.log(`[Scheduler] Rescheduled "${task.name}" for ${nextRunDate.toLocaleString()}`);

    } catch (error) {
      console.error(`[Scheduler] Error executing task "${task.name}":`, error);

      // Still reschedule even if failed
      const { period, position, offset } = task.schedule;
      const nextRun = this.calculateNextRun(period, position, offset || 0);
      this.heap.push({
        ...task,
        nextRun
      });
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      queueSize: this.heap.size(),
      tasks: this.heap.getAll().map(task => ({
        name: task.name,
        nextRun: new Date(task.nextRun).toISOString(),
        schedule: task.schedule
      }))
    };
  }
}

export default TaskScheduler;
