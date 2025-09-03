/**
 * 日志系统
 * 提供系统日志记录和输出管理
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  module?: string | undefined;
  data?: unknown;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private enableConsole = true;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * 设置是否启用控制台输出
   */
  setConsoleEnabled(enabled: boolean): void {
    this.enableConsole = enabled;
  }

  /**
   * 设置最大日志数量
   */
  setMaxLogs(maxLogs: number): void {
    this.maxLogs = maxLogs;
  }

  /**
   * 记录调试信息
   */
  debug(message: string, module?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, module, data);
  }

  /**
   * 记录信息
   */
  info(message: string, module?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, module, data);
  }

  /**
   * 记录警告
   */
  warn(message: string, module?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, module, data);
  }

  /**
   * 记录错误
   */
  error(message: string, module?: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, module, data);
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, module?: string, data?: unknown): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      module,
      data,
    };

    // 添加到日志列表
    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 输出到控制台
    if (this.enableConsole) {
      this.outputToConsole(entry);
    }
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const moduleStr = entry.module ? `[${entry.module}] ` : '';
    const message = `${timestamp} ${moduleStr}${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        console.debug(message, entry.data);
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.info(message, entry.data);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(message, entry.data);
        break;
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        console.error(message, entry.data);
        break;
    }
  }

  /**
   * 获取所有日志
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 获取指定级别的日志
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * 获取指定模块的日志
   */
  getLogsByModule(module: string): LogEntry[] {
    return this.logs.filter(log => log.module === module);
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * 导出日志为JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * 导出日志为文本
   */
  exportToText(): string {
    return this.logs
      .map(entry => {
        const timestamp = entry.timestamp.toISOString();
        const level = LogLevel[entry.level];
        const moduleStr = entry.module ? `[${entry.module}] ` : '';
        const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
        return `${timestamp} [${level}] ${moduleStr}${entry.message}${dataStr}`;
      })
      .join('\n');
  }
}

// 创建全局日志实例
export const logger = Logger.getInstance();
