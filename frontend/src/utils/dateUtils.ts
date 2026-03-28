/**
 * 统一的日期处理工具函数
 * 确保所有图表使用相同的日期逻辑
 */

/**
 * 安全解析日期，避免返回epoch时间
 * @param dateValue 日期值（字符串、数字、Date对象等）
 * @returns 解析后的Date对象，如果无效返回null
 */
export function parseDateSafe(dateValue: any): Date | null {
  if (dateValue === null || dateValue === undefined || dateValue === '') {
    return null;
  }
  
  // 如果是数字0，返回null（避免epoch时间）
  if (dateValue === 0 || dateValue === '0') {
    return null;
  }
  
  try {
    let date: Date;
    
    // 处理字符串日期
    if (typeof dateValue === 'string') {
      // 如果是YYYY-MM-DD格式，直接解析
      if (dateValue.includes('-')) {
        const parts = dateValue.split('-');
        if (parts.length >= 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // 月份从0开始
          const day = parseInt(parts[2], 10);
          
          // 验证日期有效性
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            return null;
          }
          
          date = new Date(year, month, day);
        } else {
          date = new Date(dateValue);
        }
      } else {
        date = new Date(dateValue);
      }
    } else if (typeof dateValue === 'number') {
      // 如果是时间戳
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      // 已经是Date对象
      date = dateValue;
    } else {
      // 其他类型尝试转换
      date = new Date(dateValue);
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // 检查是否为epoch时间（1970-01-01）
    if (date.getTime() === 0) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.warn('日期解析失败:', dateValue, error);
    return null;
  }
}

/**
 * 格式化日期为YYYY-MM-DD字符串
 * @param dateValue 日期值
 * @returns 格式化后的日期字符串，如果无效返回空字符串
 */
export function formatDateToYYYYMMDD(dateValue: any): string {
  const date = parseDateSafe(dateValue);
  if (!date) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期为图表显示的短格式（M/D）
 * @param dateValue 日期值
 * @returns 格式化后的短日期字符串，如果无效返回空字符串
 */
export function formatDateForChart(dateValue: any): string {
  const date = parseDateSafe(dateValue);
  if (!date) {
    return '';
  }
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${month}/${day}`;
}

/**
 * 验证日期数据，过滤无效日期
 * @param data 数据数组
 * @param dateField 日期字段名，默认为'date'
 * @returns 过滤后的数据数组
 */
export function filterValidDates<T extends Record<string, any>>(
  data: T[],
  dateField: string = 'date'
): T[] {
  if (!Array.isArray(data)) {
    return [];
  }
  
  return data.filter(item => {
    const dateValue = item[dateField];
    const date = parseDateSafe(dateValue);
    return date !== null;
  });
}

/**
 * 排序数据按日期升序（最早在前）
 * @param data 数据数组
 * @param dateField 日期字段名，默认为'date'
 * @returns 排序后的数据数组
 */
export function sortByDateAsc<T extends Record<string, any>>(
  data: T[],
  dateField: string = 'date'
): T[] {
  if (!Array.isArray(data) || data.length === 0) {
    return data;
  }
  
  return [...data].sort((a, b) => {
    const dateA = parseDateSafe(a[dateField]);
    const dateB = parseDateSafe(b[dateField]);
    
    // 无效日期放在最后
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * 获取tooltip显示的日期
 * 优先使用payload中的date字段，如果没有则使用label
 * @param payload tooltip的payload数组
 * @param label tooltip的label
 * @returns 显示的日期字符串
 */
export function getTooltipDate(payload: any[], label: any): string {
  // 调试：打印输入参数
  console.log('🔍 getTooltipDate 调用:', { 
    payloadLength: payload?.length,
    payloadFirstItem: payload?.[0],
    label: label,
    labelType: typeof label
  });
  
  // 优先使用payload中的date字段
  if (payload && payload.length > 0) {
    // 尝试多种可能的payload结构
    const possibleDataPoints = [
      payload[0]?.payload,           // 标准结构
      payload[0]?.payload?.payload,  // 嵌套结构
      payload[0]?.data,              // 其他可能的结构
      payload[0]                     // payload本身
    ];
    
    for (const dataPoint of possibleDataPoints) {
      if (dataPoint && dataPoint.date) {
        const formatted = formatDateToYYYYMMDD(dataPoint.date);
        if (formatted) {
          console.log('✅ 从payload找到有效日期:', { dataPoint, formatted });
          return formatted;
        }
      }
    }
    
    // 如果payload有value但没date，检查是否是直接的数据点
    if (payload[0] && typeof payload[0] === 'object') {
      const formatted = formatDateToYYYYMMDD(payload[0]);
      if (formatted) {
        console.log('✅ 从payload[0]解析到日期:', formatted);
        return formatted;
      }
    }
  }
  
  // 其次使用label
  if (label !== null && label !== undefined && label !== '') {
    const formatted = formatDateToYYYYMMDD(label);
    if (formatted) {
      console.log('✅ 从label解析到日期:', formatted);
      return formatted;
    } else {
      console.log('❌ label解析失败:', label);
    }
  }
  
  // 都无效返回N/A
  console.log('❌ 所有日期解析都失败，返回N/A');
  return 'N/A';
}

/**
 * 调试函数：打印数据中的日期信息
 * @param data 数据数组
 * @param dataName 数据名称（用于日志）
 * @param dateField 日期字段名，默认为'date'
 */
export function debugDates<T extends Record<string, any>>(
  data: T[],
  dataName: string,
  dateField: string = 'date'
): void {
  console.log(`=== ${dataName} 日期调试 ===`);
  console.log(`数据长度: ${data?.length || 0}`);
  
  if (!data || data.length === 0) {
    console.log('数据为空');
    return;
  }
  
  // 前5个点
  console.log('前5个点:');
  data.slice(0, 5).forEach((item, index) => {
    const dateValue = item[dateField];
    const date = parseDateSafe(dateValue);
    console.log(`  [${index}] date字段: ${dateValue}, 类型: ${typeof dateValue}, 解析结果: ${date ? date.toISOString() : '无效'}`);
  });
  
  // 后5个点
  if (data.length > 5) {
    console.log('后5个点:');
    data.slice(-5).forEach((item, index) => {
      const dateValue = item[dateField];
      const date = parseDateSafe(dateValue);
      const actualIndex = data.length - 5 + index;
      console.log(`  [${actualIndex}] date字段: ${dateValue}, 类型: ${typeof dateValue}, 解析结果: ${date ? date.toISOString() : '无效'}`);
    });
  }
  
  // 统计无效日期
  const invalidDates = data.filter(item => {
    const dateValue = item[dateField];
    return parseDateSafe(dateValue) === null;
  });
  
  console.log(`无效日期数量: ${invalidDates.length}/${data.length}`);
  
  if (invalidDates.length > 0) {
    console.log('无效日期示例:');
    invalidDates.slice(0, 3).forEach(item => {
      console.log(`  date字段: ${item[dateField]}, 类型: ${typeof item[dateField]}`);
    });
  }
}