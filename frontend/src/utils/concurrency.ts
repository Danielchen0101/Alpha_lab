/**
 * 并发控制工具
 */

/**
 * 限制并发执行的Promise数量
 * @param tasks 任务函数数组，每个函数返回Promise
 * @param concurrency 最大并发数
 * @returns Promise数组的结果
 */
export async function limitConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  
  for (const task of tasks) {
    // 如果达到并发限制，等待一个任务完成
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
    
    // 创建并执行任务
    const p = task().then(result => {
      results.push(result);
      // 任务完成后从执行数组中移除
      const index = executing.indexOf(p);
      if (index > -1) {
        executing.splice(index, 1);
      }
    });
    
    executing.push(p);
  }
  
  // 等待所有剩余任务完成
  await Promise.all(executing);
  
  return results;
}

/**
 * 分批处理数组，每批限制并发
 * @param items 要处理的项数组
 * @param processFn 处理函数
 * @param batchSize 每批大小
 * @param concurrency 每批内的最大并发数
 * @returns 处理结果数组
 */
export async function processInBatchesWithConcurrency<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  batchSize: number = 10,
  concurrency: number = 3
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}: ${batch.length} 个项目`);
    }

    // 为批次创建任务
    const tasks = batch.map(item => () => processFn(item));
    
    // 限制并发执行
    const batchResults = await limitConcurrency(tasks, concurrency);
    results.push(...batchResults);
    
    // 批次间短暂等待
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}